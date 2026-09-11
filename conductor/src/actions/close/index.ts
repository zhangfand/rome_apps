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
        outcome: { type: "string", enum: ["completed", "cancelled"] },
        reason: { type: "string", description: "Why the task is over." },
        evidence: { type: "string", description: "What in the ledger or the world proves it (issue/PR URLs, the Event, the person's words)." },
      },
      required: ["taskId", "seenSeq", "outcome", "reason"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const reason = String(args.reason ?? "").trim();
      const evidence = typeof args.evidence === "string" ? args.evidence.trim() : undefined;
      if (!reason) return { status: "error", error: "reason is required" };
      if (args.outcome === "completed") {
        return writeDecision(appContext, { ...input, source: "conductor:close", fact: { kind: "Completed", payload: { reason, ...(evidence ? { evidence } : {}) } } });
      }
      if (args.outcome === "cancelled") {
        return writeDecision(appContext, { ...input, source: "conductor:close", fact: { kind: "Cancelled", payload: { reason } } });
      }
      return { status: "error", error: "outcome must be completed or cancelled" };
    },
  };
}
