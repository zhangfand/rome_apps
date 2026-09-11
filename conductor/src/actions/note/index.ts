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
        note: { type: "string" },
      },
      required: ["taskId", "seenSeq", "note"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const note = String(args.note ?? "").trim();
      if (!note) return { status: "error", error: "note is required" };
      return writeDecision(appContext, { ...input, source: "conductor:note", fact: { kind: "Noted", payload: { note } } });
    },
  };
}
