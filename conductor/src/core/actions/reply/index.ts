import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { loadTask, rejectIfClosed, writePersonFact } from "../../lib/person-fact.js";
import { resolvesAsked } from "../../lib/facts.js";

/**
 * A person's words on an open task. The orchestrator is woken to read them;
 * what they mean for the work is its call, not this action's.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task this answers. Read it from conductor:list_tasks.",
        },
        text: {
          type: "string",
          description: "What the person said, as an instruction or answer, in a sentence or two.",
        },
        source: {
          type: "string",
          description: "The person's message, verbatim. Recorded as the fact's citation.",
        },
        resolvesAskedSeq: {
          type: "number",
          description: "Exact Asked fact seq this directly answers. Omit for unrelated steering or commentary.",
        },
      },
      required: ["taskId", "text", "source"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      const text = String(args.text ?? "").trim();
      const source = String(args.source ?? "").trim();
      const resolvesAskedSeq = args.resolvesAskedSeq === undefined ? undefined : Number(args.resolvesAskedSeq);
      if (!taskId) return { status: "error", error: "taskId is required" };
      if (!text) return { status: "error", error: "text is required" };
      if (!source) {
        return { status: "error", error: "source is required: pass the person's message verbatim" };
      }
      if (resolvesAskedSeq !== undefined && (!Number.isInteger(resolvesAskedSeq) || resolvesAskedSeq < 1)) {
        return { status: "error", error: "resolvesAskedSeq must be the positive seq of the Asked fact this reply answers" };
      }

      const found = loadTask(appContext, taskId);
      if (!found.ok) return { status: "error", error: found.error };
      const closed = rejectIfClosed(found.task);
      if (closed) return { status: "error", error: closed };
      if (resolvesAskedSeq !== undefined) {
        const asked = found.task.facts.find((fact) => fact.seq === resolvesAskedSeq && fact.kind === "Asked");
        if (!asked) return { status: "error", error: `Asked fact #${resolvesAskedSeq} is not on task ${taskId}` };
        if (found.task.facts.some((fact) => resolvesAsked(fact, resolvesAskedSeq))) {
          return { status: "error", error: `Asked fact #${resolvesAskedSeq} is already resolved` };
        }
      }

      return await writePersonFact(appContext, {
        taskId,
        kind: "Reply",
        source,
        payload: { text, ...(resolvesAskedSeq !== undefined ? { resolvesAskedSeq } : {}) },
      });
    },
  };
}
