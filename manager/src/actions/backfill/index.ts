import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createLockRepository, RECONCILE_LOCK } from "../../db/repositories/lock.js";
import { configRevision } from "../../lib/config-edit.js";
import { foldTask } from "../../lib/fold.js";
import { personFromContext } from "../../lib/identity.js";
import { reassessmentFact } from "../../lib/reassessment.js";

export function createAction(config: ActionConfig, { appContext }: AppActionRuntimeDeps): Action {
  return { config, inputSchema: {
    type: "object", additionalProperties: false, required: ["tasks", "configRevision", "source"],
    properties: {
      tasks: { type: "array", minItems: 1, maxItems: 50, items: {
        type: "object", additionalProperties: false, required: ["taskId", "reportSeq"],
        properties: { taskId: { type: "string", minLength: 1 }, reportSeq: { type: "integer", minimum: 1 } },
      } },
      configRevision: { type: "string", description: "Revision from GET /config; prevents adopting changed instructions." },
      source: { type: "string", minLength: 1, description: "The user's explicit backfill request, verbatim." },
    },
  }, async execute(args): Promise<ActionResult> {
    const source = typeof args.source === "string" ? args.source.trim() : "";
    const tasks = args.tasks as Array<{ taskId: string; reportSeq: number }>;
    if (!source || !Array.isArray(tasks) || !tasks.length || tasks.length > 50 || tasks.some((t) => !t || typeof t.taskId !== "string" || !t.taskId.trim() || !Number.isSafeInteger(t.reportSeq) || t.reportSeq < 1)) return { status: "error", error: "Provide explicit task IDs, report sequences and the user's request." };
    const locks = createLockRepository(appContext.db);
    if (!locks.tryAcquire(RECONCILE_LOCK, 5 * 60_000)) return { status: "error", error: "Manager is busy; retry shortly. Nothing changed." };
    const results: Array<{ taskId: string; status: string; seq?: number; reason?: string }> = [];
    try {
      const current = createSettingsRepository(appContext.db).get();
      if (!current || configRevision(current) !== args.configRevision) return { status: "error", error: "Configuration changed or is missing; refresh before adopting hooks." };
      const ledger = createLedgerRepository(appContext.db);
      if (!ledger.reachable()) return { status: "error", error: "Ledger unavailable." };
      for (const target of tasks) {
        try {
          const facts = ledger.factsFor(target.taskId);
          if (facts.some((f) => f.kind === "Reply" && f.payload.reassessment?.reportSeq === target.reportSeq)) {
            results.push({ taskId: target.taskId, status: "already_requested" }); continue;
          }
          const fact = reassessmentFact(foldTask(facts), target.reportSeq, current, personFromContext(), source);
          const saved = ledger.appendIfLatest(fact, facts.at(-1)!.seq);
          results.push(saved ? { taskId: target.taskId, status: "queued", seq: saved.seq } : { taskId: target.taskId, status: "skipped", reason: "Task changed during backfill." });
        } catch (error) { results.push({ taskId: target.taskId, status: "skipped", reason: error instanceof Error ? error.message : String(error) }); }
      }
    } finally { locks.release(RECONCILE_LOCK); }
    // Accepted requests remain durable even if a concurrent pass takes the lock.
    const reconcile = results.some((r) => r.status === "queued") ? await appContext.runAction("manager:reconcile", {}) : undefined;
    return { status: "ok", data: { results, reconcile } };
  } };
}
