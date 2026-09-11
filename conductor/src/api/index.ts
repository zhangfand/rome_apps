import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, TICK_LOCK } from "../db/repositories/lock.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import { createWorkerHealthRepository } from "../db/repositories/worker-health.js";
import { parseConfig } from "../lib/config.js";
import { type Fact } from "../lib/facts.js";
import { fold, foldTask, needsAttention, type TaskView } from "../lib/fold.js";

/**
 *   GET state              every task, folded, with its latest decision
 *   GET tasks/:id          one task with every fact
 *   POST tasks/:id/reply   a person's reply, through conductor:reply
 *   GET|PATCH config       settings; PATCH accepts { sop?, projects.<id>.sop? , ... } and re-parses
 *   POST tick              run a tick now
 */
class ConductorApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");
    const ledger = createLedgerRepository(this.ctx.db);
    const settings = createSettingsRepository(this.ctx.db);
    try {
      if (request.method === "GET" && route === "state") {
        if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
        const now = new Date();
        const snapshot = fold(now, ledger.all());
        const config = settings.get();
        const health = config ? safe(() => createWorkerHealthRepository(this.ctx.db).status(now)) : [];
        const lock = createLockRepository(this.ctx.db).peek(TICK_LOCK);
        return json({
          now: now.toISOString(),
          configured: Boolean(config),
          projects: config ? Object.fromEntries(Object.entries(config.projects).map(([id, p]) => [id, { workingDir: p.workingDir, repo: p.repo }])) : {},
          tickRunning: Boolean(lock && lock.heldUntil > now.getTime()),
          tasks: snapshot.tasks.map((task) => taskSummary(task, now)),
          workers: health ?? [],
        });
      }
      if (request.path[0] === "tasks" && request.path.length === 2 && request.method === "GET") {
        const facts = ledger.factsFor(request.path[1]);
        if (!facts.length) return json({ error: "task_not_found" }, 404);
        const now = new Date();
        const task = foldTask(facts);
        return json({ ...taskSummary(task, now), facts: task.facts.map(factJson) });
      }
      if (request.path[0] === "tasks" && request.path[2] === "reply" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<{ text?: unknown }>(request);
        if (!body || typeof body.text !== "string" || !body.text.trim()) return json({ error: "Enter a reply." }, 400);
        const result = await this.ctx.runAction("conductor:reply", { taskId: request.path[1], text: body.text.trim(), source: body.text.trim() });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `reply returned ${result.status}` }, 502);
        return json(result.data ?? {});
      }
      if (route === "config") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method === "GET") {
          const config = settings.get();
          return config ? json({ config }) : json({ error: "Run conductor:setup first." }, 409);
        }
        if (request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<Record<string, unknown>>(request);
        if (!body || typeof body !== "object") return json({ error: "A JSON object of changes is required." }, 400);
        const current = settings.get();
        if (!current) return json({ error: "Run conductor:setup first." }, 409);
        const merged: Record<string, unknown> = { ...current, ...body };
        if (body.projects && typeof body.projects === "object") {
          merged.projects = { ...current.projects };
          for (const [id, patch] of Object.entries(body.projects as Record<string, Record<string, unknown>>)) {
            (merged.projects as Record<string, unknown>)[id] = { ...(current.projects[id] ?? {}), ...patch };
          }
        }
        const parsed = parseConfig(merged);
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        settings.put(parsed.config);
        this.ctx.log.info("guardian updated conductor configuration", { fields: Object.keys(body) });
        return json({ config: parsed.config });
      }
      if (route === "tick" && request.method === "POST") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        const result = await this.ctx.runAction("conductor:tick", {});
        return json(result.status === "ok" ? (result.data ?? {}) : { error: result.status === "error" ? result.error : result.status }, result.status === "ok" ? 200 : 502);
      }
      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.ctx.log.error("conductor api failed", { route, message });
      return json({ error: message }, 500);
    }
  }
}

function taskSummary(task: TaskView, now: Date) {
  const attention = needsAttention(task, now);
  return {
    id: task.id,
    brief: task.brief,
    projectId: task.projectId,
    repo: task.project?.repo,
    createdBy: task.createdBy,
    createdAt: task.facts[0].createdAt.toISOString(),
    updatedAt: task.latest.createdAt.toISOString(),
    state: task.state,
    liveWorker: task.liveWorker ? { workerId: task.liveWorker.workerId, agent: task.liveWorker.agent, since: task.liveWorker.startedAt.toISOString() } : undefined,
    lastDecision: task.lastDecision ? factJson(task.lastDecision) : undefined,
    latest: factJson(task.latest),
    waiting: task.waiting,
    decisionsSinceLastPersonFact: task.decisionsSinceLastPersonFact,
    needsAttention: attention.wake ? attention.why : undefined,
    factCount: task.facts.length,
  };
}

function factJson(fact: Fact) {
  return { seq: fact.seq, id: fact.id, taskId: fact.taskId, kind: fact.kind, by: fact.by, source: fact.source, payload: fact.payload, createdAt: fact.createdAt.toISOString() };
}

function safe<T>(fn: () => T): T | undefined {
  try { return fn(); } catch { return undefined; }
}

function readJsonBody<T>(request: RomeAppApiRequest): T | null {
  if (!request.body || request.body.byteLength === 0) return null;
  try { return JSON.parse(new TextDecoder().decode(request.body)) as T; } catch { return null; }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new ConductorApiHandler(ctx);
}
