import { createAppLogger, type Action, type ActionConfig, type ActionResult, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, orchestrateLock } from "../../db/repositories/lock.js";
import { createTaskSessionRepository } from "../../db/repositories/task-sessions.js";
import { foldTask } from "../../lib/fold.js";
import {
  buildLedgerSnapshotPrompt,
  parseLedgerSnapshotReply,
  shouldSnapshotTask,
  SNAPSHOT_AGENT,
} from "../../lib/ledger-snapshot.js";
import { readSummonOutput } from "../run-worker/index.js";
import type { CoreComposition, TaskSnapshotMirrorRef } from "../../lib/composition.js";

const log = createAppLogger("conductor:compact_task_history");
const COMPACTION_LEASE_MS = 15 * 60_000;

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps, composition: CoreComposition): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        force: { type: "boolean", description: "Write a Snapshot even when the automatic threshold has not been reached." },
      },
      required: ["taskId"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      if (!taskId) return { status: "error", error: "taskId is required" };

      const ledger = createLedgerRepository(appContext.db);
      const locks = createLockRepository(appContext.db);
      if (!locks.tryAcquire(orchestrateLock(taskId), COMPACTION_LEASE_MS)) {
        return { status: "ok", data: { taskId, skipped: "task coordinator or compactor is already running" } };
      }

      let wrote = false;
      let writtenSeq: number | undefined;
      try {
        const facts = ledger.factsFor(taskId);
        if (!facts.length) return { status: "error", error: `no task ${taskId}` };
        const task = foldTask(facts);
        if (task.state !== "open") return { status: "ok", data: { taskId, skipped: "task is closed" } };
        if (args.force !== true && !shouldSnapshotTask(task)) {
          return { status: "ok", data: { taskId, skipped: "snapshot threshold not reached" } };
        }

        const { prompt, input } = buildLedgerSnapshotPrompt(task);
        log.info("compacting task ledger", {
          taskId,
          throughSeq: task.latest.seq,
          inputFactCount: input.factCount,
          estimatedInputTokens: input.estimatedTokens,
        });
        const result = await appContext.runAction("system:summon", { agentName: SNAPSHOT_AGENT, prompt })
          .catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
        if (result.status !== "ok") {
          return { status: "error", error: result.status === "error" ? result.error : `summon returned ${result.status}` };
        }

        const output = readSummonOutput(result.data);
        const summary = parseLedgerSnapshotReply(output.reply);
        if (!summary) return { status: "error", error: "ledger compactor returned no valid bounded snapshot" };

        const workRepoRef: TaskSnapshotMirrorRef | undefined = await composition.archiveTaskSnapshot?.(task, {
          coversThroughSeq: task.latest.seq,
          generatedAt: new Date(),
          summary,
        });

        const append = ledger.compareAndAppend(taskId, task.latest.seq, [{
          taskId,
          kind: "Snapshot",
          by: SNAPSHOT_AGENT,
          source: "conductor:compact_task_history",
          payload: {
            coversThroughSeq: task.latest.seq,
            ...(input.previous ? { previousSnapshotSeq: input.previous.seq } : {}),
            summary,
            schemaVersion: 1,
            inputFactCount: input.factCount,
            estimatedInputTokens: input.estimatedTokens,
            ...(workRepoRef ? { workRepo: {
              repo: workRepoRef.repo,
              path: workRepoRef.path,
              commit: workRepoRef.commit,
              sha256: workRepoRef.sha256,
              bytes: workRepoRef.bytes,
              url: workRepoRef.url,
            } } : {}),
          },
        }]);
        if (append.status === "conflict") {
          return { status: "ok", data: { taskId, skipped: "ledger changed during compaction", currentSeq: append.currentSeq } };
        }
        const snapshot = append.facts.find((fact) => fact.kind === "Snapshot");
        wrote = Boolean(snapshot);
        writtenSeq = snapshot?.seq;

        if (output.romeSession) {
          createTaskSessionRepository(appContext.db).record({
            taskId,
            sessionId: output.romeSession.id,
            sessionType: output.romeSession.type,
            role: "compactor",
            triggerSeq: task.latest.seq,
            resultSeq: writtenSeq,
          });
        }
        log.info("task ledger compacted", { taskId, snapshotSeq: writtenSeq, coversThroughSeq: task.latest.seq });
        return {
          status: "ok",
          data: {
            taskId,
            snapshotSeq: writtenSeq,
            coversThroughSeq: task.latest.seq,
            inputFactCount: input.factCount,
            estimatedInputTokens: input.estimatedTokens,
            workRepo: workRepoRef,
          },
        };
      } finally {
        locks.release(orchestrateLock(taskId));
        // If facts were waiting for a decision, continue immediately from the
        // newly bounded context instead of waiting for the next scheduled pass.
        if (wrote) {
          await appContext.runAction("conductor:wake_task_coordinator", { taskId }, { detached: true });
        }
      }
    },
  };
}
