import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { foldTask } from "../../lib/fold.js";
import { writePersonFact } from "../../lib/person-fact.js";

const AGENT_RE = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/i;
const MAX_SEED = 24_000;

/**
 * Start a clean coordinator experiment at a historical checkpoint.
 *
 * Copying a ledger prefix looks attractive, but it also copies worker state,
 * external-event identities, obsolete decisions, and possibly credentials.
 * A replay therefore records lineage and a bounded sanitized seed instead.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Source Task whose historical checkpoint is being replayed." },
        throughSeq: { type: "number", description: "Inclusive source-ledger sequence used as the checkpoint." },
        seed: { type: "string", description: "Sanitized, self-contained checkpoint state. Never paste secrets or later source-task outcomes." },
        coordinatorAgent: { type: "string", description: "Registered coordinator Agent/prompt variant pinned to the new Task." },
        brief: { type: "string", description: "Optional replacement brief; defaults to the source Task brief." },
        source: { type: "string", description: "The person's replay request, verbatim." },
      },
      required: ["taskId", "throughSeq", "seed", "coordinatorAgent", "source"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      const throughSeq = Number(args.throughSeq);
      const seed = String(args.seed ?? "").trim();
      const coordinatorAgent = String(args.coordinatorAgent ?? "").trim();
      const source = String(args.source ?? "").trim();
      const briefOverride = typeof args.brief === "string" ? args.brief.trim() : "";
      if (!taskId) return { status: "error", error: "taskId is required" };
      if (!Number.isInteger(throughSeq) || throughSeq < 1) return { status: "error", error: "throughSeq must be a positive integer" };
      if (!seed) return { status: "error", error: "seed is required" };
      if (seed.length > MAX_SEED) return { status: "error", error: `seed must be at most ${MAX_SEED} characters` };
      if (!AGENT_RE.test(coordinatorAgent)) return { status: "error", error: "coordinatorAgent must be a registered app:agent id" };
      if (!source) return { status: "error", error: "source is required: pass the person's replay request verbatim" };

      const ledger = createLedgerRepository(appContext.db);
      const sourceFacts = ledger.factsFor(taskId);
      if (!sourceFacts.length) return { status: "error", error: `no task ${taskId}` };
      const checkpoint = sourceFacts.find((fact) => fact.seq === throughSeq);
      if (!checkpoint) return { status: "error", error: `task ${taskId} has no fact #${throughSeq}` };
      const sourceTask = foldTask(sourceFacts);
      const newTaskId = `t-${crypto.randomUUID().slice(0, 8)}`;
      const workRepoPath = `_experiments/replays/${newTaskId}/design.md`;
      const result = await writePersonFact(appContext, {
        taskId: newTaskId,
        kind: "Created",
        source,
        payload: {
          brief: briefOverride || sourceTask.brief,
          projectId: sourceTask.projectId,
          project: sourceTask.project,
          replay: { sourceTaskId: taskId, sourceThroughSeq: throughSeq, coordinatorAgent, seed, workRepoPath },
        },
      });
      if (result.status !== "ok") return result;
      return {
        status: "ok",
        data: {
          taskId: newTaskId,
          sourceTaskId: taskId,
          sourceThroughSeq: throughSeq,
          coordinatorAgent,
          workRepoPath,
          checkpointKind: checkpoint.kind,
        },
      };
    },
  };
}
