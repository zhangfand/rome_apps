import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { dispatchFor, foldTask, steerTarget } from "../../lib/fold.js";
import { writePersonFact } from "../../lib/person-fact.js";

/**
 * A person's words for one worker on an open task. The fact wakes the
 * orchestrator like a reply, and the runtime hands the words verbatim to that
 * worker if the orchestrator's next Job resumes its session. It never starts,
 * resumes or stops a worker itself.
 *
 * Not written against the caller's seenSeq: the steer is addressed to a worker,
 * not to the Task's newest state, so a worker returning while the person types
 * does not turn the steer into a conflict. It waits for that worker instead.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task the worker runs on." },
        workerId: { type: "string", description: "Worker the person is writing to." },
        text: { type: "string", description: "The person's message, verbatim." },
      },
      required: ["taskId", "workerId", "text"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      const workerId = String(args.workerId ?? "").trim();
      const text = String(args.text ?? "").trim();
      if (!taskId) return { status: "error", error: "taskId is required" };
      if (!workerId) return { status: "error", error: "workerId is required" };
      if (!text) return { status: "error", error: "text is required" };

      const facts = createLedgerRepository(appContext.db).factsFor(taskId);
      if (!facts.length) return { status: "error", error: `no task ${taskId}` };
      const task = foldTask(facts);
      if (task.state !== "open") return { status: "error", error: `task ${taskId} is already ${task.state}; nothing more can be said on it` };
      if (!dispatchFor(task, workerId)) return { status: "error", error: `no worker ${workerId} has run on task ${taskId}` };

      return await writePersonFact(appContext, {
        taskId,
        kind: "Steered",
        source: text,
        payload: { workerId: steerTarget(task, workerId), text },
      });
    },
  };
}
