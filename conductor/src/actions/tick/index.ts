import { createAppLogger, type Action, type ActionConfig, type ActionResult, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, orchestrateLock, TICK_LOCK } from "../../db/repositories/lock.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createWorkerHealthRepository, type WorkerHealthRepository } from "../../db/repositories/worker-health.js";
import type { ConductorConfig } from "../../lib/config.js";
import { fold, needsAttention } from "../../lib/fold.js";
import { issueApiPath } from "../../lib/github-refs.js";
import { intakeApiPath, intakeFacts, type IntakeIssue, MAX_INTAKE_PAGES, toIntakeIssue } from "../../lib/intake.js";
import { issueEvents, type IssueStatus, issuesToWatch } from "../../lib/observe.js";
import { pullApiPaths, pullEvents, type PullObservation, pullsToWatch, unknownTaskPulls } from "../../lib/observe-prs.js";
import { intakeRoutes } from "../../lib/projects.js";

const log = createAppLogger("conductor:tick");
const LOCK_LEASE_MS = 5 * 60_000;

/**
 * The runtime pass. It observes (worker health, GitHub) and transcribes what
 * it saw into the ledger, then wakes the orchestrator for each task that has
 * something new. It decides nothing about any task.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: { type: "object", properties: {}, additionalProperties: true },

    async execute(): Promise<ActionResult> {
      const settings = createSettingsRepository(appContext.db);
      const ledger = createLedgerRepository(appContext.db);
      const locks = createLockRepository(appContext.db);
      if (!ledger.reachable()) return { status: "ok", data: { skipped: "ledger unreachable" } };
      if (!locks.tryAcquire(TICK_LOCK, LOCK_LEASE_MS)) return { status: "ok", data: { skipped: "another tick is running" } };
      try {
        const conductorConfig = settings.get();
        if (!conductorConfig) return { status: "error", error: "Conductor is not configured. Run conductor:setup first." };
        const applied: string[] = [];
        applied.push(...observeWorkerHealth(ledger, createWorkerHealthRepository(appContext.db)));
        applied.push(...await intakeIssues(ledger, conductorConfig, appContext));
        applied.push(...await observeIssues(ledger, conductorConfig, appContext));
        applied.push(...await observeTaskBranches(ledger, appContext));
        applied.push(...await observePulls(ledger, appContext));

        const now = new Date();
        const snapshot = fold(now, ledger.all());
        const woken: string[] = [];
        for (const task of snapshot.tasks) {
          const attention = needsAttention(task, now);
          if (!attention.wake) continue;
          if (task.decisionsSinceLastPersonFact >= conductorConfig.maxDecisionsPerTurn &&
              task.facts.some((f) => f.seq > task.lastPersonFactSeq && f.kind === "Event" && f.payload.type === "circuit_breaker")) continue;
          const held = locks.peek(orchestrateLock(task.id));
          if (held && held.heldUntil > now.getTime()) continue;
          await appContext.runAction("conductor:orchestrate", { taskId: task.id }, { detached: true });
          woken.push(task.id);
        }
        log.info("tick finished", { tasks: snapshot.tasks.length, applied: applied.length, woken });
        return { status: "ok", data: { tasks: snapshot.tasks.length, applied, woken } };
      } finally {
        locks.release(TICK_LOCK);
      }
    },
  };
}

export function observeWorkerHealth(ledger: Pick<LedgerRepository, "all">, health: Pick<WorkerHealthRepository, "expire">, now = new Date()): string[] {
  const applied: string[] = [];
  for (const task of fold(now, ledger.all()).tasks) {
    const worker = task.liveWorker;
    if (!worker) continue;
    try {
      if (health.expire(task.id, worker.workerId, now)) applied.push(`Lost(${task.id}): worker heartbeat expired`);
    } catch (error) {
      log.warn("worker health unavailable; leaving worker unchanged", { taskId: task.id, workerId: worker.workerId, error: String(error) });
    }
  }
  return applied;
}

async function intakeIssues(ledger: Pick<LedgerRepository, "all" | "append">, config: ConductorConfig, appContext: AppActionRuntimeDeps["appContext"]): Promise<string[]> {
  const routes = intakeRoutes(config);
  if (routes.length === 0) return [];
  const issues: IntakeIssue[] = [];
  const polls = [...new Map(routes.map((r) => [JSON.stringify([r.repo, r.labels]), r])).values()];
  for (const { repo, labels } of polls) {
    for (let page = 1; page <= MAX_INTAKE_PAGES; page += 1) {
      const result = await appContext.runAction("connector:connector_proxy", { toolkit: "github", path: intakeApiPath(repo, labels.join(","), page), method: "GET" })
        .catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
      if (result.status !== "ok") {
        log.warn("issue intake failed; skipping repo this pass", { repo, page, reason: result.status === "error" ? result.error : result.status });
        break;
      }
      const rows = (result.data as { data?: unknown } | undefined)?.data;
      if (!Array.isArray(rows)) break;
      for (const row of rows) {
        const issue = toIntakeIssue(repo, (row ?? {}) as Record<string, unknown>);
        if (issue) issues.push(issue);
      }
      if (rows.length < 100) break;
    }
  }
  if (issues.length === 0) return [];
  const facts = intakeFacts({ snapshot: fold(new Date(), ledger.all()), issues, label: config.intakeLabel, routes, newTaskId: () => `t-${crypto.randomUUID().slice(0, 8)}` });
  const applied: string[] = [];
  for (const fact of facts) {
    const written = ledger.append(fact);
    log.info("task taken in from GitHub", { taskId: written.taskId, by: fact.by });
    applied.push(`Created(${written.taskId}) by ${fact.by}`);
  }
  return applied;
}

async function observeIssues(ledger: LedgerRepository, _config: ConductorConfig, appContext: AppActionRuntimeDeps["appContext"]): Promise<string[]> {
  const snapshot = fold(new Date(), ledger.all());
  const watches = issuesToWatch(snapshot);
  if (watches.length === 0) return [];
  const statuses = new Map<string, IssueStatus>();
  const wanted = new Map(watches.flatMap((w) => w.refs.map((ref) => [ref.url, ref] as const)));
  for (const ref of wanted.values()) {
    const result = await appContext.runAction("connector:connector_proxy", { toolkit: "github", path: issueApiPath(ref), method: "GET" })
      .catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
    if (result.status !== "ok") {
      log.warn("issue poll failed", { issue: ref.url, reason: result.status === "error" ? result.error : result.status });
      continue;
    }
    const issue = (result.data as { data?: Record<string, unknown> } | undefined)?.data ?? {};
    if (issue.pull_request) continue;
    statuses.set(ref.url, {
      state: issue.state === "closed" ? "closed" : "open",
      closedAt: typeof issue.closed_at === "string" ? issue.closed_at : undefined,
      stateReason: typeof issue.state_reason === "string" ? issue.state_reason : undefined,
    });
  }
  const applied: string[] = [];
  const byId = new Map(snapshot.tasks.map((task) => [task.id, task]));
  for (const watch of watches) {
    const task = byId.get(watch.taskId);
    if (!task) continue;
    for (const fact of issueEvents(task, watch.refs, statuses)) {
      ledger.append(fact);
      applied.push(`Event(${task.id}) issue_closed`);
    }
  }
  return applied;
}

/** One GET per aspect per PR; a failed sub-request yields fewer events, never a wrong one. */
async function observePulls(ledger: LedgerRepository, appContext: AppActionRuntimeDeps["appContext"]): Promise<string[]> {
  const snapshot = fold(new Date(), ledger.all());
  const watches = pullsToWatch(snapshot);
  if (watches.length === 0) return [];
  const get = async (path: string): Promise<unknown> => {
    const result = await appContext.runAction("connector:connector_proxy", { toolkit: "github", path, method: "GET" })
      .catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
    if (result.status !== "ok") {
      log.warn("pull request poll failed", { path, reason: result.status === "error" ? result.error : result.status });
      return undefined;
    }
    return (result.data as { data?: unknown } | undefined)?.data;
  };
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const login = (v: unknown) => str((v as { login?: unknown } | null)?.login) || "unknown";

  const observed = new Map<string, PullObservation>();
  const applied: string[] = [];
  const byId = new Map(snapshot.tasks.map((task) => [task.id, task]));
  for (const watch of watches) {
    const task = byId.get(watch.taskId);
    if (!task) continue;
    for (const ref of watch.refs) {
      let seen = observed.get(ref.url);
      if (!seen) {
        const paths = pullApiPaths(ref);
        const pull = (await get(paths.pull)) as Record<string, unknown> | undefined;
        if (!pull) continue;
        seen = {
          state: pull.state === "closed" ? "closed" : "open",
          merged: pull.merged === true,
          mergedAt: str(pull.merged_at) || undefined,
          headSha: str((pull.head as { sha?: unknown } | undefined)?.sha) || undefined,
        };
        const reviews = await get(paths.reviews);
        if (Array.isArray(reviews)) seen.reviews = reviews.map((r) => ({ id: Number(r.id), user: login(r.user), state: str(r.state), body: str(r.body), submittedAt: str(r.submitted_at) || undefined }));
        const rcs = await get(paths.reviewComments);
        if (Array.isArray(rcs)) seen.reviewComments = rcs.map((c) => ({ id: Number(c.id), user: login(c.user), path: str(c.path) || undefined, line: typeof c.line === "number" ? c.line : undefined, body: str(c.body) }));
        const ics = await get(paths.comments);
        if (Array.isArray(ics)) seen.comments = ics.map((c) => ({ id: Number(c.id), user: login(c.user), body: str(c.body) }));
        if (seen.headSha) {
          const checks = (await get(paths.checks(seen.headSha))) as { total_count?: unknown; check_runs?: unknown } | undefined;
          if (checks && Array.isArray(checks.check_runs)) {
            const runs = checks.check_runs.map((r) => ({ name: str(r.name), status: str(r.status), conclusion: str(r.conclusion) || undefined, url: str(r.html_url) || undefined }));
            seen.checks = { total: runs.length, completed: runs.filter((r) => r.status === "completed").length, runs };
          }
        }
        observed.set(ref.url, seen);
      }
      for (const fact of pullEvents(task, ref, seen)) {
        ledger.append(fact);
        applied.push(`Event(${task.id}) ${(fact.payload as { type: string }).type}`);
      }
    }
  }
  return applied;
}

/** One list per repository: open PRs whose head branch names one of our tasks. */
async function observeTaskBranches(ledger: LedgerRepository, appContext: AppActionRuntimeDeps["appContext"]): Promise<string[]> {
  const snapshot = fold(new Date(), ledger.all());
  const open = snapshot.tasks.filter((t) => t.state === "open" && t.project?.repo);
  if (!open.length) return [];
  const applied: string[] = [];
  const byRepo = new Map<string, typeof open>();
  for (const task of open) {
    const repo = task.project!.repo!.toLowerCase();
    byRepo.set(repo, [...(byRepo.get(repo) ?? []), task]);
  }
  for (const [repo, tasks] of byRepo) {
    const [owner, name] = repo.split("/");
    const result = await appContext.runAction("connector:connector_proxy", {
      toolkit: "github", path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=open&per_page=100`, method: "GET",
    }).catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
    if (result.status !== "ok") { log.warn("pull request list failed", { repo }); continue; }
    const rows = (result.data as { data?: unknown } | undefined)?.data;
    if (!Array.isArray(rows)) continue;
    const pulls = rows.flatMap((r) => {
      const url = typeof r.html_url === "string" ? r.html_url : "";
      const headRef = typeof r.head?.ref === "string" ? r.head.ref : "";
      return url && headRef ? [{ url, headRef }] : [];
    });
    for (const task of tasks) {
      for (const fact of unknownTaskPulls(task, pulls)) {
        ledger.append(fact);
        applied.push(`Event(${task.id}) pr_opened`);
      }
    }
  }
  return applied;
}
