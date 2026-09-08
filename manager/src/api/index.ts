import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, RECONCILE_LOCK } from "../db/repositories/lock.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import { buildView, summarizeFact, workersOf } from "../lib/view.js";
import { foldTask } from "../lib/fold.js";

/**
 * The dashboard's read side. Every route is a fold over the ledger computed on
 * request; nothing here writes, because the only writers are the four person
 * verbs and the runtime, and both already have their own doors.
 *
 *   GET state            the whole dashboard: counts, tasks, workers, ledger
 *   GET tasks/:id        one task with every fact and worker on it
 */
class ManagerApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");
    const ledger = createLedgerRepository(this.ctx.db);
    const settings = createSettingsRepository(this.ctx.db);
    const locks = createLockRepository(this.ctx.db);

    try {
      if (request.method === "GET" && route === "state") {
        if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
        const limit = clampInt(request.query.get("ledgerLimit"), 200, 1, 2000);
        const view = buildView({
          now: new Date(),
          facts: ledger.all(),
          config: settings.get(),
          lock: locks.peek(RECONCILE_LOCK),
        });
        return json({ ...view, ledger: view.ledger.slice(0, limit) });
      }

      if (request.method === "GET" && request.path[0] === "tasks" && request.path.length === 2) {
        const taskId = request.path[1];
        const facts = ledger.factsFor(taskId);
        if (facts.length === 0) return json({ error: "task not found" }, 404);
        const now = new Date();
        const task = foldTask(facts);
        return json({
          id: task.id,
          brief: task.brief,
          state: task.state,
          position: task.position,
          liveWorkerId: task.liveWorker?.workerId,
          startsSinceLastPersonFact: task.startsSinceLastPersonFact,
          facts: task.facts.map(summarizeFact),
          workers: workersOf(task.id, task.brief, task.facts, now),
        });
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.log.error("manager api failed", { route, error: message });
      return json({ error: message }, 500);
    }
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new ManagerApiHandler(ctx);
}
