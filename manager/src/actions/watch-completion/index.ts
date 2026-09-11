import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createLockRepository, RECONCILE_LOCK } from "../../db/repositories/lock.js";
import { configRevision } from "../../lib/config-edit.js";
import { foldTask, isTerminal } from "../../lib/fold.js";
import { personFromContext } from "../../lib/identity.js";
import { bindProject } from "../../lib/projects.js";
import { hooksOf, lastStart } from "../../lib/lifecycle.js";

export function createAction(config: ActionConfig, { appContext }: AppActionRuntimeDeps): Action {
  return { config, inputSchema: {
    type: "object", additionalProperties: false, required: ["tasks", "configRevision", "source"],
    properties: {
      tasks: { type: "array", minItems: 1, maxItems: 50, items: {
        type: "object", additionalProperties: false, required: ["taskId", "expectedSeq"],
        properties: { taskId: { type: "string", minLength: 1 }, expectedSeq: { type: "integer", minimum: 1 } },
      } },
      configRevision: { type: "string", description: "Revision from GET /config." },
      source: { type: "string", minLength: 1, description: "The user's explicit request, verbatim." },
    },
  }, async execute(args): Promise<ActionResult> {
    const source = typeof args.source === "string" ? args.source.trim() : "";
    const targets = args.tasks as Array<{ taskId: string; expectedSeq: number }>;
    if (!source || !Array.isArray(targets) || !targets.length || targets.length > 50 || targets.some((t) => !t || typeof t.taskId !== "string" || !t.taskId.trim() || !Number.isSafeInteger(t.expectedSeq) || t.expectedSeq < 1)) return { status: "error", error: "Provide task IDs, exact latest ledger sequences and the user's request." };
    const locks = createLockRepository(appContext.db);
    if (!locks.tryAcquire(RECONCILE_LOCK, 5 * 60_000)) return { status: "error", error: "Manager is busy; retry shortly. Nothing changed." };
    const results: Array<{ taskId: string; status: string; reason?: string }> = [];
    try {
      const current = createSettingsRepository(appContext.db).get();
      if (!current || configRevision(current) !== args.configRevision) return { status: "error", error: "Configuration changed or is missing; refresh before adopting a completion check." };
      const ledger = createLedgerRepository(appContext.db);
      if (!ledger.reachable()) return { status: "error", error: "Ledger unavailable." };
      for (const target of targets) {
        try {
          const facts = ledger.factsFor(target.taskId);
          const task = foldTask(facts);
          if (isTerminal(task.state)) throw new Error("Task is already closed.");
          if (!task.projectId || !task.project) throw new Error("Task has no durable project binding.");
          const hook = bindProject(current, task.projectId).project.hooks?.completion;
          if (!hook) throw new Error("Configure a Completion check for this project first.");
          if (JSON.stringify(hooksOf(task).completion) === JSON.stringify(hook)) {
            results.push({ taskId: task.id, status: "already_enabled" }); continue;
          }
          if (task.liveWorker && lastStart(task)?.payload.phase === "completion") throw new Error("Completion check is running; wait before replacing its policy.");
          if (facts.at(-1)?.seq !== target.expectedSeq) throw new Error("Task changed; refresh before enabling completion.");
          const saved = ledger.appendIfLatest({ taskId: task.id, kind: "CompletionEnabled", by: personFromContext(), source, payload: { hook: structuredClone(hook) } }, target.expectedSeq);
          results.push({ taskId: task.id, status: saved ? "enabled" : "skipped", ...(saved ? {} : { reason: "Task changed during adoption." }) });
        } catch (error) { results.push({ taskId: target.taskId, status: "skipped", reason: error instanceof Error ? error.message : String(error) }); }
      }
    } finally { locks.release(RECONCILE_LOCK); }
    const reconcile = results.some((r) => r.status === "enabled") ? await appContext.runAction("manager:reconcile", {}) : undefined;
    return { status: "ok", data: { results, reconcile } };
  } };
}
