import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { loadOpenTask, readDecisionInput } from "../../lib/decision.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { ORCHESTRATOR } from "../../lib/facts.js";

/**
 * Rome has no app-facing way to cancel a detached execution or an agent
 * session, so a stop records the intent as a Lost fact and the runtime stops
 * listening to that worker: its eventual reply is dropped by appendWorkerOutcome.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        seenSeq: { type: "number", description: "The seq of the newest fact you read." },
        why: { type: "string", description: "Why the worker is being stopped." },
      },
      required: ["taskId", "seenSeq", "why"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const why = String(args.why ?? "").trim() || "stopped by orchestrator";
      const loaded = loadOpenTask(appContext, input.taskId, input.seenSeq);
      if (!loaded.ok) return { status: "error", error: loaded.error };
      const worker = loaded.task.liveWorker;
      if (!worker) return { status: "error", error: "no worker is live on this task" };
      const written = createLedgerRepository(appContext.db).appendIfLatest({
        taskId: input.taskId, kind: "Lost", by: ORCHESTRATOR, source: "conductor:stop",
        payload: { workerId: worker.workerId, why: `stopped by orchestrator: ${why}` },
      }, input.seenSeq);
      if (!written) return { status: "error", error: "The ledger changed while writing; read it and decide again." };
      return { status: "ok", data: { taskId: input.taskId, stopped: worker.workerId, seq: written.seq, seenSeq: written.seq } };
    },
  };
}
