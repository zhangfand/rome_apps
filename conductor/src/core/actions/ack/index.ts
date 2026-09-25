import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { readDecisionInput, writeDecision } from "../../lib/decision.js";

/**
 * Close one coordinator observation cycle without changing the Task's workflow
 * posture. ACK is a processed-through marker that no one is told about; the
 * coordinator uses it to rest while a worker, CI, review, or child Task is
 * outstanding.
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
        summary: { type: "string", description: "Why the observed update requires no workflow change, e.g. what the Task is now waiting on." },
      },
      required: ["taskId", "seenSeq", "summary"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const summary = String(args.summary ?? "").trim();
      if (!summary) return { status: "error", error: "summary is required" };
      return writeDecision(appContext, {
        ...input,
        source: "conductor:acknowledge_task_update",
        fact: { kind: "ACK", payload: { summary } },
      });
    },
  };
}
