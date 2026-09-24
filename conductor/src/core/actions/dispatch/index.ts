import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import type { CoreComposition } from "../../lib/composition.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { conflictActionResult, loadOpenTask, readDecisionInput } from "../../lib/decision.js";
import { type JobCreatedFact, ORCHESTRATOR } from "../../lib/facts.js";
import { dispatchPendingJobs } from "../../lib/job-scheduler.js";

/**
 * Record one bounded Job chosen by the coordinator. The action does not choose
 * a worker, session, workspace or slot. After the decision is durable it asks
 * the lower-level scheduler for an eager pass; scheduled ticks provide the
 * retry path when capacity is unavailable.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps, composition: CoreComposition): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        seenSeq: { type: "number", description: "The seq of the newest fact you read." },
        agent: { type: "string", description: "The logical agent that should handle this Job." },
        instructions: { type: "string", description: "What this Job must do. When a work-repository artifact already carries the handoff, cite its path and commit instead of restating it; otherwise state the goal, constraints, definition of done, and expected handoff." },
        note: { type: "string", description: "One line for people: why this Job is the next useful work." },
      },
      required: ["taskId", "seenSeq", "agent", "instructions"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const agent = String(args.agent ?? "").trim();
      const instructions = String(args.instructions ?? "").trim();
      const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined;
      if (!instructions) return { status: "error", error: "instructions are required" };

      const settings = createSettingsRepository(appContext.db, composition.parseConfig).get();
      if (!settings) return { status: "error", error: "Conductor is not configured. Run conductor:configure_conductor first." };
      if (!Object.hasOwn(settings.workerAgents, agent)) {
        return { status: "error", error: `agent must be one of: ${Object.keys(settings.workerAgents).join(", ")}` };
      }

      const loaded = loadOpenTask(appContext, input.taskId, input.seenSeq);
      if (!loaded.ok) return loaded.result;
      if (loaded.task.liveWorker) {
        return { status: "error", error: `job ${loaded.task.liveWorker.jobId ?? "(legacy)"} is already running; wait for its result before deciding the next Job` };
      }

      const jobId = `j-${crypto.randomUUID().slice(0, 8)}`;
      const payload: JobCreatedFact["payload"] = {
        jobId,
        agent,
        instructions,
        ...(note ? { note } : {}),
      };
      const result = createLedgerRepository(appContext.db).compareAndAppend(loaded.task.id, input.seenSeq, [{
        taskId: loaded.task.id,
        kind: "JobCreated",
        by: ORCHESTRATOR,
        source: "conductor:create_job",
        payload,
      }]);
      if (result.status === "conflict") return conflictActionResult(result);
      const written = result.facts[0];

      // This is an infrastructure call, not part of the coordinator decision.
      // It may leave the Job pending when all global worker slots are occupied.
      const scheduled = await dispatchPendingJobs({ appContext, composition, config: settings, taskId: loaded.task.id });
      return {
        status: "ok",
        data: {
          taskId: loaded.task.id,
          wrote: "JobCreated",
          seq: written.seq,
          jobId,
          agent,
          scheduling: scheduled.dispatched.some((item) => item.jobId === jobId)
            ? "dispatched"
            : scheduled.failed.some((item) => item.jobId === jobId)
              ? "failed"
              : "pending",
        },
      };
    },
  };
}
