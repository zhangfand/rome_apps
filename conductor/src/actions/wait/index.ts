import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { readDecisionInput, writeDecision } from "../../lib/decision.js";

const MIN_MINUTES = 1;
const MAX_MINUTES = 7 * 24 * 60;

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        seenSeq: { type: "number", description: "The seq of the newest fact you read." },
        reason: { type: "string", description: "What you are waiting for and what to check when woken." },
        minutes: { type: "number", description: `Minutes until you want to be woken (${MIN_MINUTES}–${MAX_MINUTES}).` },
      },
      required: ["taskId", "seenSeq", "reason", "minutes"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const reason = String(args.reason ?? "").trim();
      const minutes = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(Number(args.minutes))));
      if (!reason) return { status: "error", error: "reason is required" };
      if (!Number.isFinite(minutes)) return { status: "error", error: "minutes must be a number" };
      const resumeAfter = new Date(Date.now() + minutes * 60_000).toISOString();
      return writeDecision(appContext, { ...input, source: "conductor:wait", fact: { kind: "Waited", payload: { reason, resumeAfter } } });
    },
  };
}
