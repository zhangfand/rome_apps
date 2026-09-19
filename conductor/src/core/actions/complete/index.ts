import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { writePersonFact } from "../../lib/person-fact.js";
import { loadOpenTask } from "../../lib/decision.js";

/**
 * A person closes the task as done. This action exists only in a turn a person
 * triggered, and the runtime stamps who called it, so the app has no path to
 * Completed on its own judgement.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task to close. Read it from conductor:list_tasks." },
        seenSeq: { type: "number", description: "The seq of the newest fact on this Task when the person's acceptance was resolved." },
        reason: { type: "string", description: "Why it is done, if the person said." },
        source: {
          type: "string",
          description: "The person's message, verbatim. Recorded as the fact's citation.",
        },
      },
      required: ["taskId", "seenSeq", "source"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      const source = String(args.source ?? "").trim();
      const seenSeq = Number(args.seenSeq);
      const reason = typeof args.reason === "string" ? args.reason.trim() : undefined;
      if (!taskId) return { status: "error", error: "taskId is required" };
      if (!Number.isInteger(seenSeq)) return { status: "error", error: "seenSeq is required" };
      if (!source) {
        return { status: "error", error: "source is required: pass the person's message verbatim" };
      }

      const found = loadOpenTask(appContext, taskId, seenSeq);
      if (!found.ok) return found.result;

      return await writePersonFact(appContext, {
        taskId,
        kind: "Completed",
        source,
        payload: reason ? { reason } : {},
      }, seenSeq);
    },
  };
}
