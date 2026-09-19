import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { readDecisionInput, writeDecision } from "../../lib/decision.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        seenSeq: { type: "number", description: "The seq of the newest fact you read." },
        question: { type: "string", description: "The question, concrete enough to answer in one message." },
      },
      required: ["taskId", "seenSeq", "question"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const question = String(args.question ?? "").trim();
      if (!question) return { status: "error", error: "question is required" };
      const result = writeDecision(appContext, { ...input, source: "conductor:ask_person", fact: { kind: "Asked", payload: { question } } });
      if (result.status === "ok") {
        try {
          await appContext.runAction("conductor:dispatch_intervention_notices", {}, { detached: true });
        } catch (error) {
          // The Asked fact is already durable and the next reconcile rebuilds
          // its outbox row. Delivery infrastructure must not rewrite the task
          // decision as a failed action call.
          appContext.log.warn("intervention dispatcher could not be started", {
            taskId: input.taskId,
            error: error instanceof Error ? error.name : "unknown",
          });
        }
      }
      return result;
    },
  };
}
