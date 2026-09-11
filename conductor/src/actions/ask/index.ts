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
      return writeDecision(appContext, { ...input, source: "conductor:ask", fact: { kind: "Asked", payload: { question } } });
    },
  };
}
