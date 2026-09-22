import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { conflictActionResult, loadOpenTask, readDecisionInput } from "../../lib/decision.js";
import { fold } from "../../lib/fold.js";
import { ORCHESTRATOR, type NewFact, type TaskParent } from "../../lib/facts.js";

const PLAN_ITEM_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_TASKS_PER_DECISION = 10;

/**
 * Materialize only separate outcomes the engineering lead judges runnable
 * now. Agent handoffs on one outcome are Jobs instead. The action records
 * lineage, not dependencies; future work stays in the lead's plan.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "The lead-owned parent task." },
        seenSeq: { type: "number", description: "The seq of the newest parent fact you read." },
        tasks: {
          type: "array",
          minItems: 1,
          maxItems: MAX_TASKS_PER_DECISION,
          items: {
            type: "object",
            properties: {
              planItemId: { type: "string", description: "Stable id in the engineering plan; retries with the same id do not create a second task." },
              brief: { type: "string", description: "Self-contained execution contract: scope, constraints, acceptance, and handoff." },
              specRef: { type: "string", description: "Path or URL of the ready product spec." },
              planRef: { type: "string", description: "Path or URL of the current engineering plan." },
            },
            required: ["planItemId", "brief"],
            additionalProperties: false,
          },
        },
        note: { type: "string", description: "Why this is the runnable set now." },
      },
      required: ["taskId", "seenSeq", "tasks", "note"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const input = readDecisionInput(args);
      if (!input.ok) return { status: "error", error: input.error };
      const loaded = loadOpenTask(appContext, input.taskId, input.seenSeq);
      if (!loaded.ok) return loaded.result;
      const note = String(args.note ?? "").trim();
      if (!note) return { status: "error", error: "note is required" };
      if (!Array.isArray(args.tasks) || args.tasks.length < 1 || args.tasks.length > MAX_TASKS_PER_DECISION) {
        return { status: "error", error: `tasks must contain 1-${MAX_TASKS_PER_DECISION} runnable tasks` };
      }

      const requested: Array<{ planItemId: string; brief: string; specRef?: string; planRef?: string }> = [];
      const ids = new Set<string>();
      for (const raw of args.tasks) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { status: "error", error: "every task must be an object" };
        const item = raw as Record<string, unknown>;
        const planItemId = String(item.planItemId ?? "").trim();
        const brief = String(item.brief ?? "").trim();
        const specRef = typeof item.specRef === "string" && item.specRef.trim() ? item.specRef.trim() : undefined;
        const planRef = typeof item.planRef === "string" && item.planRef.trim() ? item.planRef.trim() : undefined;
        if (!PLAN_ITEM_RE.test(planItemId)) return { status: "error", error: `invalid planItemId: ${planItemId || "(empty)"}` };
        if (ids.has(planItemId)) return { status: "error", error: `duplicate planItemId in request: ${planItemId}` };
        if (!brief) return { status: "error", error: `brief is required for ${planItemId}` };
        ids.add(planItemId);
        requested.push({ planItemId, brief, ...(specRef ? { specRef } : {}), ...(planRef ? { planRef } : {}) });
      }

      const ledger = createLedgerRepository(appContext.db);
      const existing = new Map(
        fold(new Date(), ledger.all()).tasks
          .filter((task) => task.parent?.taskId === input.taskId)
          .map((task) => [task.parent!.planItemId, task.id]),
      );
      const created: Array<{ taskId: string; planItemId: string }> = [];
      const childFacts: NewFact[] = [];
      for (const item of requested) {
        if (existing.has(item.planItemId)) continue;
        const childTaskId = `t-${crypto.randomUUID().slice(0, 8)}`;
        const parent: TaskParent = {
          taskId: input.taskId,
          planItemId: item.planItemId,
          ...(item.specRef ? { specRef: item.specRef } : {}),
          ...(item.planRef ? { planRef: item.planRef } : {}),
          ...(loaded.task.replay?.coordinatorAgent || loaded.task.parent?.coordinatorAgent
            ? { coordinatorAgent: loaded.task.replay?.coordinatorAgent ?? loaded.task.parent?.coordinatorAgent }
            : {}),
        };
        childFacts.push({
          taskId: childTaskId,
          kind: "Created",
          by: ORCHESTRATOR,
          source: "conductor:create_child_tasks",
          payload: {
            brief: item.brief,
            projectId: loaded.task.projectId,
            project: loaded.task.project,
            parent,
          },
        });
        created.push({ taskId: childTaskId, planItemId: item.planItemId });
      }

      const already = requested
        .filter((item) => existing.has(item.planItemId))
        .map((item) => ({ taskId: existing.get(item.planItemId)!, planItemId: item.planItemId }));
      const decision: NewFact = {
        taskId: input.taskId,
        kind: "Noted",
        by: ORCHESTRATOR,
        source: "conductor:create_child_tasks",
        payload: {
          note: `${note}\nRunnable tasks: ${[...already, ...created].map((item) => `${item.planItemId}=${item.taskId}`).join(", ")}`,
        },
      };
      const result = ledger.compareAndAppend(input.taskId, input.seenSeq, [...childFacts, decision]);
      if (result.status === "conflict") return conflictActionResult(result);
      const written = result.facts;
      await appContext.runAction("conductor:reconcile_tasks", {}, { detached: true });
      return { status: "ok", data: { parentTaskId: input.taskId, created, existing: already, decisionSeq: written.at(-1)!.seq } };
    },
  };
}
