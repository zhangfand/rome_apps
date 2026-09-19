import { createAppLogger, type Action, type ActionConfig, type ActionResult, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import type { CoreComposition } from "../../lib/composition.js";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, orchestrateLock, TICK_LOCK } from "../../db/repositories/lock.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createWorkerHealthRepository, type WorkerHealthRepository } from "../../db/repositories/worker-health.js";
import { createRuntimeControlRepository } from "../../db/repositories/runtime-control.js";
import { fold, needsAttention } from "../../lib/fold.js";
import { isTerminalKind, RUNTIME } from "../../lib/facts.js";
import { describeOutcome, ingestAtomically, type IngestRequest } from "../../lib/ingest.js";
import { dispatchPendingJobs } from "../../lib/job-scheduler.js";

const log = createAppLogger("conductor:reconcile_tasks");
const LOCK_LEASE_MS = 5 * 60_000;

/**
 * The runtime pass, in three steps that never blur into each other:
 *
 *   1. observe — expire silent workers, and ask every source adapter what it
 *      saw. Adapters return requests; they touch neither the ledger nor a task.
 *   2. ingest — hand the batch to the seam, which decides what is new and
 *      writes at most a `Created` or an `Event` per request.
 *   3. dispatch — materialize pending Jobs into worker runs while slots exist.
 *   4. wake — run the orchestrator for each open task with facts it has not
 *      decided on.
 *
 * This action decides nothing about any task, and it is the only thing that
 * wakes the orchestrator: facts arriving by any other door — the ingest API,
 * a person in chat — wait here to be noticed, so the loop keeps one driver.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps, composition: CoreComposition): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: { type: "object", properties: {}, additionalProperties: true },

    async execute(): Promise<ActionResult> {
      const settings = createSettingsRepository(appContext.db, composition.parseConfig);
      const ledger = createLedgerRepository(appContext.db);
      const locks = createLockRepository(appContext.db);
      if (!ledger.reachable()) return { status: "ok", data: { skipped: "ledger unreachable" } };
      if (!locks.tryAcquire(TICK_LOCK, LOCK_LEASE_MS)) return { status: "ok", data: { skipped: "another tick is running" } };
      try {
        const conductorConfig = settings.get();
        if (!conductorConfig) return { status: "error", error: "Conductor is not configured. Run conductor:configure_conductor first." };
        if (createRuntimeControlRepository(appContext.db).get().paused) {
          return { status: "ok", data: { skipped: "runtime paused" } };
        }
        const applied: string[] = [];

        // 1. observe
        applied.push(...observeWorkerHealth(ledger, createWorkerHealthRepository(appContext.db)));
        applied.push(...observeChildOutcomes(ledger));
        const observedAt = new Date();
        const snapshot = fold(observedAt, ledger.all());
        const requests: IngestRequest[] = [];
        const claimed = new Map<string, string>();
        for (const adapter of composition.sourceAdapters) {
          if (!adapter.enabled(conductorConfig)) continue;
          try {
            const result = await adapter.poll({
              snapshot,
              config: conductorConfig,
              now: observedAt,
              runAction: appContext.runAction.bind(appContext),
              log,
            });
            requests.push(...result.requests);
            for (const [key, taskId] of result.claimed ?? []) claimed.set(key, taskId);
          } catch (error) {
            log.warn("source adapter failed; skipping it this pass", { source: adapter.source, error: String(error) });
          }
        }

        // 2. ingest
        if (requests.length) {
          for (const outcome of ingestAtomically(ledger, { config: conductorConfig, requests, claimed })) {
            if (outcome.status === "recorded") applied.push(describeOutcome(outcome));
            else if (outcome.status === "rejected") log.warn("ingest rejected an observation", { ...outcome });
          }
        }

        // 3. dispatch Jobs. The coordinator chose the agent and instructions;
        // runtime alone chooses workers, sessions, workspaces and slots.
        const scheduled = await dispatchPendingJobs({ appContext, composition, config: conductorConfig });
        applied.push(...scheduled.dispatched.map((item) => `Dispatched(${item.taskId}): ${item.jobId} as ${item.workerId}`));
        applied.push(...scheduled.failed.map((item) => `JobFailed(${item.taskId}): ${item.jobId}`));

        // 4. wake
        const now = new Date();
        const current = fold(now, ledger.all());
        const woken: string[] = [];
        for (const task of current.tasks) {
          const attention = needsAttention(task, now);
          if (!attention.wake) continue;
          if (task.decisionsSinceLastPersonFact >= conductorConfig.maxDecisionsPerTurn &&
              task.facts.some((f) => f.seq > task.lastPersonFactSeq && f.kind === "Event" && f.payload.type === "circuit_breaker")) continue;
          const held = locks.peek(orchestrateLock(task.id));
          if (held && held.heldUntil > now.getTime()) continue;
          await appContext.runAction("conductor:wake_task_coordinator", { taskId: task.id }, { detached: true });
          woken.push(task.id);
        }
        log.info("tick finished", { tasks: current.tasks.length, applied: applied.length, woken });
        return { status: "ok", data: { tasks: current.tasks.length, applied, woken } };
      } finally {
        locks.release(TICK_LOCK);
      }
    },
  };
}

/**
 * Reflect completed child outcome Tasks back to their lead-owned parent. This is
 * observation, not dependency scheduling: the engineering lead decides what
 * the outcome changes and whether any later task is now runnable.
 */
export function observeChildOutcomes(ledger: Pick<LedgerRepository, "all" | "append">, now = new Date()): string[] {
  const applied: string[] = [];
  const snapshot = fold(now, ledger.all());
  const byId = new Map(snapshot.tasks.map((task) => [task.id, task]));
  for (const child of snapshot.tasks) {
    if (!child.parent || child.state === "open") continue;
    const parent = byId.get(child.parent.taskId);
    if (!parent || parent.state !== "open") continue;
    const terminal = [...child.facts].reverse().find((fact) => isTerminalKind(fact.kind));
    if (!terminal) continue;
    const key = `child:${child.id}:${terminal.seq}`;
    const already = parent.facts.some((fact) =>
      fact.kind === "Event" && fact.payload.source === "conductor" && fact.payload.type === "child_finished" && fact.payload.data?.key === key,
    );
    if (already) continue;
    ledger.append({
      taskId: parent.id,
      kind: "Event",
      by: RUNTIME,
      source: "conductor:reconcile_tasks, observing a materialized task",
      payload: {
        source: "conductor",
        type: "child_finished",
        summary: `plan item ${child.parent.planItemId} (${child.id}) is ${child.state}`,
        data: { key, childTaskId: child.id, planItemId: child.parent.planItemId, state: child.state, terminalSeq: terminal.seq },
      },
    });
    applied.push(`Event(${parent.id}): child ${child.id} ${child.state}`);
  }
  return applied;
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
