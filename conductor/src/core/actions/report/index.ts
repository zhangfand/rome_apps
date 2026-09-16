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
        report: { type: "string", description: "What was delivered, where to find it, how it was verified, and what the person should do next." },
      },
      required: ["taskId", "seenSeq", "report"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const report = String(args.report ?? "").trim();
      if (!report) return { status: "error", error: "report is required" };
      return writeDecision(appContext, { ...input, source: "conductor:report", fact: { kind: "Reported", payload: { report } } });
    },
  };
}
