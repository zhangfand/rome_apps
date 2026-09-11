import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createBoardRepository } from "../../db/repositories/board.js";
import { createLockRepository, RECONCILE_LOCK } from "../../db/repositories/lock.js";
import { createWorkerHealthRepository, type WorkerHealthRepository } from "../../db/repositories/worker-health.js";
import { HEARTBEAT_PROTOCOL } from "../../lib/worker-health.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import type { ManagerConfig } from "../../lib/config.js";
import { RUNTIME, type CompletedFact, isWorkerTerminalKind } from "../../lib/facts.js";
import { syncRepository } from "../../lib/board-sync.js";
import { fold } from "../../lib/fold.js";
import { issueApiPath } from "../../lib/github-refs.js";
import {
  intakeApiPath,
  intakeFacts,
  type IntakeIssue,
  MAX_INTAKE_PAGES,
  toIntakeIssue,
} from "../../lib/intake.js";
import { judge } from "../../lib/judge.js";
import { endedByIssues, type IssueStatus, issuesToWatch } from "../../lib/observe.js";
import { LOST_STOPPED, reconcile, type ReconcileAction } from "../../lib/reconcile.js";

import { prepareWorkerStart } from "../../lib/worker-start.js";
import { intakeRoutes, legacyBindingFacts } from "../../lib/projects.js";

const log = createAppLogger("manager:reconcile");

/**
 * How long a pass may hold the lock. Long enough that a slow pass is never cut
 * off mid-list, short enough that a killed process does not stall the loop for
 * more than a couple of scheduled ticks.
 */
const LOCK_LEASE_MS = 5 * 60_000;

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: { type: "object", properties: {}, additionalProperties: true },

    async execute(): Promise<ActionResult> {
      const settings = createSettingsRepository(appContext.db);
      const ledger = createLedgerRepository(appContext.db);
      const locks = createLockRepository(appContext.db);

      // No ledger, no pass. Nothing is written and nothing is inferred from
      // anywhere else; the next tick tries again.
      if (!ledger.reachable()) {
        log.warn("ledger unreachable; skipping");
        return { status: "ok", data: { skipped: "ledger unreachable" } };
      }

      // A second pass arriving while one runs returns immediately; the pass
      // that holds the lock, or the next tick, sees whatever it missed.
      if (!locks.tryAcquire(RECONCILE_LOCK, LOCK_LEASE_MS)) {
        return { status: "ok", data: { skipped: "another reconcile is running" } };
      }

      try {
        const managerConfig = settings.get();
        if (!managerConfig) return { status: "error", error: "manager is not configured. Run manager:setup first." };
        for (const fact of legacyBindingFacts(ledger.all(), managerConfig)) ledger.append(fact);
        // Supervise workers before any external polling. A health read failure
        // is unknown, never permission to declare a worker dead.
        const healthFacts = observeWorkerHealth(ledger, createWorkerHealthRepository(appContext.db));
        // Ask GitHub next. Intake before observe, so an issue labeled and
        // closed between two passes is opened and then ended in the same one,
        // leaving a complete record rather than no task at all. Both run
        // before the rules below, so a task taken in here is started this
        // pass, and a task whose issue closed is seen as terminal and has its
        // worker stopped — the same as after a person's Completed or
        // Cancelled. A poll that cannot reach GitHub writes nothing.
        const taken = await intakeIssues(ledger, managerConfig, appContext);
        // The board is a cached read model, never task state. Refresh every
        // configured repo after intake; a provider failure is logged per repo
        // and cannot prevent issue observation or the Manager runtime below.
        const refreshed = await refreshBoardSnapshots(managerConfig, appContext);
        const observed = await observeIssues(ledger, managerConfig, appContext);

        const snapshot = fold(new Date(), ledger.all());
        const actions = reconcile({
          snapshot,
          config: managerConfig,
          judge,
          newWorkerId: () => `w-${crypto.randomUUID().slice(0, 8)}`,
        });

        const applied: string[] = [...healthFacts, ...taken, ...observed];
        for (const action of actions) {
          applied.push(await apply(action, ledger, appContext, managerConfig));
        }

        log.info("reconcile finished", { tasks: snapshot.tasks.length, applied: applied.length });
        return { status: "ok", data: { tasks: snapshot.tasks.length, applied, refreshed } };
      } finally {
        locks.release(RECONCILE_LOCK);
      }
    },
  };
}

/** No model calls, no heartbeat writes, and no manual task steering. */
export function observeWorkerHealth(
  ledger: Pick<LedgerRepository, "all">,
  health: Pick<WorkerHealthRepository, "expire">,
  now = new Date(),
): string[] {
  const applied: string[] = [];
  for (const task of fold(now, ledger.all()).tasks) {
    const worker = task.liveWorker;
    const started = worker && task.facts.find((fact) => fact.seq === worker.startedSeq);
    if (!worker || started?.kind !== "Started" || started.payload.heartbeatProtocol !== HEARTBEAT_PROTOCOL) continue;
    try {
      if (health.expire(task.id, worker.workerId, now)) applied.push(`Lost(${task.id}): worker heartbeat expired`);
    } catch (error) {
      log.warn("worker health unavailable; leaving worker unchanged", { taskId: task.id, workerId: worker.workerId, error: String(error) });
    }
  }
  return applied;
}

async function refreshBoardSnapshots(
  config: ManagerConfig,
  appContext: AppActionRuntimeDeps["appContext"],
): Promise<string[]> {
  const board = createBoardRepository(appContext.db);
  const repos = [...new Set([board.getSelectedRepo(), ...intakeRoutes(config).map((r) => r.repo)].filter((repo): repo is string => Boolean(repo)))];
  const refreshed: string[] = [];
  for (const repo of repos) {
    try {
      await syncRepository(
        { runAction: appContext.runAction.bind(appContext), db: appContext.db, log: appContext.log },
        repo,
      );
      refreshed.push(repo);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log.warn("board snapshot refresh failed; preserving last good snapshot", { repo, reason });
    }
  }
  return refreshed;
}

/**
 * List each watched repo's open issues carrying the intake label and open a
 * task for every one that has none yet. One GET per page of 100, through
 * `connector:connector_proxy` so the app never holds a GitHub token. A repo whose list
 * cannot be read — GitHub not connected, a 404, a network error — is logged
 * and skipped until the next pass; the loop must never stall on the poll.
 */
export async function intakeIssues(
  ledger: Pick<LedgerRepository, "all" | "append">,
  config: ManagerConfig,
  appContext: AppActionRuntimeDeps["appContext"],
): Promise<string[]> {
  const routes = intakeRoutes(config);
  if (routes.length === 0) return [];

  const issues: IntakeIssue[] = [];
  const polls = [...new Map(routes.map((r) => [JSON.stringify([r.repo, r.labels]), r])).values()];
  for (const { repo, labels } of polls) {
    for (let page = 1; page <= MAX_INTAKE_PAGES; page += 1) {
      const result = await appContext.runAction("connector:connector_proxy", {
        toolkit: "github",
        path: intakeApiPath(repo, labels.join(","), page),
        method: "GET",
      }).catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
      if (result.status !== "ok") {
        const reason = result.status === "error" ? result.error : `returned ${result.status}`;
        log.warn("issue intake failed; skipping repo this pass", { repo, page, reason });
        break;
      }
      const rows = (result.data as { data?: unknown } | undefined)?.data;
      if (!Array.isArray(rows)) {
        log.warn("issue intake returned no list; skipping repo this pass", { repo, page });
        break;
      }
      for (const row of rows) {
        const issue = toIntakeIssue(repo, (row ?? {}) as Record<string, unknown>);
        if (issue) issues.push(issue);
      }
      if (rows.length < 100) break;
      if (page === MAX_INTAKE_PAGES) {
        log.warn("issue intake stopped at the page cap; the rest waits for the next pass", { repo });
      }
    }
  }
  if (issues.length === 0) return [];

  const snapshot = fold(new Date(), ledger.all());
  const facts = intakeFacts({
    snapshot,
    issues,
    label: config.intakeLabel,
    routes,
    newTaskId: () => `t-${crypto.randomUUID().slice(0, 8)}`,
  });

  const applied: string[] = [];
  for (const fact of facts) {
    const written = ledger.append(fact);
    const issue = (fact.payload as { issue?: { url: string } }).issue;
    log.info("task taken in from GitHub", { taskId: written.taskId, by: fact.by, issue: issue?.url });
    applied.push(`Created(${written.taskId}) by ${fact.by}`);
  }
  return applied;
}

/**
 * Poll the issues that open tasks name in their briefs and end each task whose
 * issues are all closed: Completed when closed as done, Cancelled when closed
 * as not planned. One GET per issue,
 * through `connector:connector_proxy` so the app never holds a GitHub token. Any failure
 * — GitHub not connected, a 404, a network error — is logged and that task is
 * left alone until the next pass; the loop must never stall on the poll.
 */
async function observeIssues(
  ledger: LedgerRepository,
  config: ManagerConfig,
  appContext: AppActionRuntimeDeps["appContext"],
): Promise<string[]> {
  if (!config.closeOnIssueClosed) return [];

  const snapshot = fold(new Date(), ledger.all());
  const watches = issuesToWatch(snapshot);
  if (watches.length === 0) return [];

  const statuses = new Map<string, IssueStatus>();
  const wanted = new Map(watches.flatMap((w) => w.refs.map((ref) => [ref.url, ref] as const)));
  for (const ref of wanted.values()) {
    const result = await appContext.runAction("connector:connector_proxy", {
      toolkit: "github",
      path: issueApiPath(ref),
      method: "GET",
    });
    if (result.status !== "ok") {
      const reason = result.status === "error" ? result.error : `returned ${result.status}`;
      log.warn("issue poll failed; leaving task open", { issue: ref.url, reason });
      continue;
    }
    const issue = (result.data as { data?: Record<string, unknown> } | undefined)?.data ?? {};
    // A pull request also answers on /issues/N; it is not an issue and does
    // not close a task, so it is treated as unknown.
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
    const fact = endedByIssues(task, watch.refs, statuses);
    if (!fact) continue;
    ledger.append(fact);
    log.info("task ended from GitHub", { taskId: task.id, kind: fact.kind, issues: watch.refs.map((r) => r.url) });
    applied.push(`${fact.kind}(${task.id}) by github`);
  }
  return applied;
}

/**
 * Carry out one item from reconcile's list. The order matters: a Started is
 * appended before its worker is launched, so a pass that dies in between leaves
 * a worker the next pass can see rather than one it cannot.
 */
async function apply(
  action: ReconcileAction,
  ledger: LedgerRepository,
  appContext: AppActionRuntimeDeps["appContext"],
  managerConfig: ManagerConfig,
): Promise<string> {
  switch (action.type) {
    case "append": {
      if (action.fact.kind === "Started") {
        return prepareWorkerStart(action.fact, ledger, managerConfig);
      }
      const completion = action.fact.kind === "Completed" ? (action.fact.payload as CompletedFact["payload"]).completion : undefined;
      if (completion) {
        const fact = ledger.appendIfLatest(action.fact, completion.resultSeq);
        return fact ? `${fact.kind}(${fact.taskId}) by completion check` : `skipped stale completion(${action.fact.taskId})`;
      }
      const fact = ledger.append(action.fact);
      return `${fact.kind}(${fact.taskId})`;
    }

    case "launch": {
      if (ledger.factsFor(action.taskId).some((fact) => isWorkerTerminalKind(fact.kind) &&
          (fact.payload as { workerId?: string }).workerId === action.workerId)) {
        return `skip launch(${action.workerId}): worker already closed`;
      }
      // Detached, so the worker's run is a root execution with its own
      // lifetime: this pass returns as soon as main accepts it.
      const receipt = await appContext.runAction(
        "manager:run_worker",
        { taskId: action.taskId, workerId: action.workerId },
        { detached: true },
      );
      log.info("worker launched", { ...action, executionId: receipt.executionId });
      return `launch(${action.workerId})`;
    }

    case "stop": {
      // Rome has no app-facing way to cancel a detached execution or an agent
      // session, so the runtime records the stop it intended and stops reading
      // that worker. The worker itself runs on; `appendWorkerOutcome` drops its
      // late reply because this Lost already closed it.
      ledger.append({
        taskId: action.taskId,
        kind: "Lost",
        by: RUNTIME,
        payload: { workerId: action.workerId, why: action.why },
      });
      log.warn("worker stop recorded as Lost", { ...action, gap: LOST_STOPPED });
      return `stop(${action.workerId})`;
    }
  }
}
