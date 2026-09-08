import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, RECONCILE_LOCK } from "../../db/repositories/lock.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import type { ManagerConfig } from "../../lib/config.js";
import { RUNTIME } from "../../lib/facts.js";
import { fold } from "../../lib/fold.js";
import { issueApiPath } from "../../lib/github-refs.js";
import { judge } from "../../lib/judge.js";
import { endedByIssues, type IssueStatus, issuesToWatch } from "../../lib/observe.js";
import { LOST_STOPPED, reconcile, type ReconcileAction } from "../../lib/reconcile.js";

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

      const managerConfig = settings.get();
      if (!managerConfig) {
        return { status: "error", error: "manager is not configured. Run manager:setup first." };
      }

      // A second pass arriving while one runs returns immediately; the pass
      // that holds the lock, or the next tick, sees whatever it missed.
      if (!locks.tryAcquire(RECONCILE_LOCK, LOCK_LEASE_MS)) {
        return { status: "ok", data: { skipped: "another reconcile is running" } };
      }

      try {
        // Ask GitHub first, so a task whose issue closed since the last pass
        // is ended before the rules below look at it — the rules then see a
        // terminal task and stop its worker, the same as after a person's
        // Completed or Cancelled. A poll that cannot reach GitHub writes nothing.
        const observed = await observeIssues(ledger, managerConfig, appContext);

        const snapshot = fold(new Date(), ledger.all());
        const actions = reconcile({
          snapshot,
          config: managerConfig,
          judge,
          newWorkerId: () => `w-${crypto.randomUUID().slice(0, 8)}`,
        });

        const applied: string[] = [...observed];
        for (const action of actions) {
          applied.push(await apply(action, ledger, appContext));
        }

        log.info("reconcile finished", { tasks: snapshot.tasks.length, applied: applied.length });
        return { status: "ok", data: { tasks: snapshot.tasks.length, applied } };
      } finally {
        locks.release(RECONCILE_LOCK);
      }
    },
  };
}

/**
 * Poll the issues that open tasks name in their briefs and end each task whose
 * issues are all closed: Completed when closed as done, Cancelled when closed
 * as not planned. One GET per issue,
 * through `connector_proxy` so the app never holds a GitHub token. Any failure
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
): Promise<string> {
  switch (action.type) {
    case "append": {
      const fact = ledger.append(action.fact);
      return `${fact.kind}(${fact.taskId})`;
    }

    case "launch": {
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
