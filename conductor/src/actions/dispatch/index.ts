import { createAppLogger, type Action, type ActionConfig, type ActionResult, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { loadOpenTask, readDecisionInput } from "../../lib/decision.js";
import { type DispatchedFact, ORCHESTRATOR } from "../../lib/facts.js";
import { fold, sessionLeftBy } from "../../lib/fold.js";
import { buildWorkerPrompt } from "../../lib/prompts.js";
import { prepareWorkspace, reusableWorkspace } from "../../lib/worktree.js";

const log = createAppLogger("conductor:dispatch");

/**
 * The orchestrator starts a worker. The runtime's part is mechanical: check
 * the slot budget, prepare an isolated worktree, frame the orchestrator's
 * instructions into a worker prompt, record the Dispatched fact, and launch
 * run_worker detached. What the worker is told to do is entirely the
 * orchestrator's.
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
        agent: { type: "string", description: "One of the configured worker agents, e.g. coding:coding." },
        instructions: { type: "string", description: "Self-contained instructions for the worker: context, goal, constraints, definition of done, how to deliver." },
        resumeWorkerId: { type: "string", description: "An earlier worker on this task whose session this one should continue. Only works if that worker returned cleanly." },
        note: { type: "string", description: "One line for people: why this worker is being started." },
      },
      required: ["taskId", "seenSeq", "agent", "instructions"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const agent = String(args.agent ?? "").trim();
      const instructions = String(args.instructions ?? "").trim();
      const resumeWorkerId = typeof args.resumeWorkerId === "string" && args.resumeWorkerId.trim() ? args.resumeWorkerId.trim() : undefined;
      const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : undefined;
      if (!instructions) return { status: "error", error: "instructions are required" };

      const settings = createSettingsRepository(appContext.db).get();
      if (!settings) return { status: "error", error: "Conductor is not configured. Run conductor:setup first." };
      if (!Object.hasOwn(settings.workerAgents, agent)) {
        return { status: "error", error: `agent must be one of: ${Object.keys(settings.workerAgents).join(", ")}` };
      }

      const loaded = loadOpenTask(appContext, input.taskId, input.seenSeq);
      if (!loaded.ok) return { status: "error", error: loaded.error };
      const { task } = loaded;
      if (task.liveWorker) {
        return { status: "error", error: `worker ${task.liveWorker.workerId} is live on this task; call conductor:stop first if it must change course, or wait for it to return` };
      }
      if (!task.project) return { status: "error", error: "task has no project binding; it cannot be given a worktree" };

      const ledger = createLedgerRepository(appContext.db);
      const running = fold(new Date(), ledger.all()).tasks.filter((t) => t.liveWorker).length;
      if (running >= settings.maxWorkers) {
        return { status: "error", error: `no free worker slot (${running}/${settings.maxWorkers} running); wait a few minutes and try again` };
      }

      let resumeSessionId: string | undefined;
      if (resumeWorkerId && settings.reuseSessions) resumeSessionId = sessionLeftBy(task, resumeWorkerId);

      const workerId = `w-${crypto.randomUUID().slice(0, 8)}`;
      let workspace;
      try {
        workspace = await prepareWorkspace({
          workingDir: task.project.workingDir, taskId: task.id, workerId, previous: reusableWorkspace(task.facts),
        });
      } catch (err) {
        return { status: "error", error: `Could not prepare an isolated worktree: ${err instanceof Error ? err.message : String(err)}` };
      }
      const prompt = buildWorkerPrompt({ task, instructions, workspace, resuming: Boolean(resumeSessionId) });

      const payload: DispatchedFact["payload"] = {
        workerId, agent, instructions, prompt,
        ...(note ? { note } : {}),
        ...(resumeSessionId ? { resumeWorkerId, resumeSessionId } : {}),
        workspace, projectId: task.projectId, project: task.project,
      };
      const written = ledger.appendIfLatest({ taskId: task.id, kind: "Dispatched", by: ORCHESTRATOR, source: "conductor:dispatch", payload }, input.seenSeq);
      if (!written) return { status: "error", error: "The ledger changed while writing; read it and decide again." };

      // Detached: the worker's run is a root execution with its own lifetime.
      const receipt = await appContext.runAction("conductor:run_worker", { taskId: task.id, workerId }, { detached: true });
      log.info("worker dispatched", { taskId: task.id, workerId, agent, resumed: Boolean(resumeSessionId), executionId: receipt.executionId });
      return { status: "ok", data: { taskId: task.id, wrote: "Dispatched", seq: written.seq, workerId, agent, resumed: Boolean(resumeSessionId), workingDir: workspace.workingDir } };
    },
  };
}
