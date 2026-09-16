import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { describeFact } from "../../lib/facts.js";
import { foldTask } from "../../lib/fold.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"], additionalProperties: false },
    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      const facts = createLedgerRepository(appContext.db).factsFor(taskId);
      if (!facts.length) return { status: "error", error: `no task ${taskId}` };
      const task = foldTask(facts);
      return { status: "ok", data: {
        taskId, state: task.state, seenSeq: task.latest.seq, liveWorker: task.liveWorker?.workerId,
        facts: task.facts.map((f) => describeFact(f, { full: true })),
      } };
    },
  };
}
