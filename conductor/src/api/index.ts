import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, TICK_LOCK } from "../db/repositories/lock.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import { createWorkerHealthRepository } from "../db/repositories/worker-health.js";
import { parseConfig } from "../lib/config.js";
import { type Fact } from "../lib/facts.js";
import { fold, foldTask, needsAttention, type TaskView } from "../lib/fold.js";
import { applyIngest, type IngestRequest, planIngest } from "../lib/ingest.js";
import { HEARTBEAT_LEASE_MS } from "../lib/worker-health.js";

/**
 *   GET state              every task, folded, with its latest decision
 *   POST tasks             a source opens a task (ingest seam)
 *   POST tasks/:id/events  a source reports something happened (ingest seam)
 *   GET tasks/:id          one task with every fact
 *   POST tasks/:id/reply   a person's reply, through conductor:reply
 *   POST tasks/:id/complete close as done, through conductor:complete
 *   POST tasks/:id/cancel  close as not wanted, through conductor:cancel
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
          maxWorkers: config?.maxWorkers ?? 0,
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
      if (request.path[0] === "tasks" && request.path[2] === "complete" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const taskId = request.path[1];
        const result = await this.ctx.runAction("conductor:complete", { taskId, source: "Mark complete" });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `complete returned ${result.status}` }, 502);
        return refreshedTask(ledger.factsFor(taskId));
      }
      if (request.path[0] === "tasks" && request.path[2] === "cancel" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const taskId = request.path[1];
        const result = await this.ctx.runAction("conductor:cancel", { taskId, source: "Cancel task" });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `cancel returned ${result.status}` }, 502);
        return refreshedTask(ledger.factsFor(taskId));
      }
      // The ingest seam over HTTP. Any system that can reach Rome can open a
      // task or report an event; it cannot do anything else to the ledger,
      // because these two routes are the only ones that reach the seam and
      // the seam writes only `Created` and `Event`. Neither route wakes the
      // orchestrator: the next tick finds the facts, so the loop keeps one
      // driver.
      if (route === "tasks" && request.method === "POST") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        const body = readJsonBody<Record<string, unknown>>(request);
        if (!body || typeof body !== "object") return json({ error: "A JSON object is required." }, 400);
        return this.ingest(settings, ledger, { ...body, op: "open_task" } as unknown as IngestRequest);
      }
      if (request.path[0] === "tasks" && request.path[2] === "events" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<Record<string, unknown>>(request);
        if (!body || typeof body !== "object") return json({ error: "A JSON object is required." }, 400);
        return this.ingest(settings, ledger, { ...body, op: "push_event", taskId: request.path[1] } as unknown as IngestRequest);
      }
      if (route === "config") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method === "GET") {
          const config = settings.get();
          return config ? json({ config, runtime: runtimeJson() }) : json({ error: "Run conductor:setup first." }, 409);
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
        return json({ config: parsed.config, runtime: runtimeJson() });
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
  /**
   * One request through the seam. The seam owns every judgement — whether the
   * source may write, whether this is new, which project it belongs to — so
   * this method only chooses status codes: 400 for a request the seam refused,
   * 200 for a fact written and for one that was already there.
   */
  private ingest(
    settings: ReturnType<typeof createSettingsRepository>,
    ledger: ReturnType<typeof createLedgerRepository>,
    request: IngestRequest,
  ): Response {
    const config = settings.get();
    if (!config) return json({ error: "Run conductor:setup first." }, 409);
    if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
    const plans = planIngest({ snapshot: fold(new Date(), ledger.all()), config, requests: [request] });
    const [outcome] = applyIngest(ledger, plans);
    if (outcome.status === "rejected") return json({ error: outcome.reason, status: "rejected" }, 400);
    this.ctx.log.info("ingest", { ...outcome });
    return json({
      status: outcome.status,
      taskId: outcome.taskId,
      kind: outcome.kind,
      seq: outcome.seq,
      reason: outcome.reason,
      // Said plainly so a caller does not sit waiting for a response that
      // never comes: nothing happens until the next scheduled pass.
      pickedUpBy: `the next tick, within ${config.intervalMinutes} minute${config.intervalMinutes === 1 ? "" : "s"}`,
    });
  }
}

function refreshedTask(facts: Fact[]): Response {
  if (!facts.length) return json({ error: "task_not_found" }, 404);
  const now = new Date();
  const task = foldTask(facts);
  return json({ ...taskSummary(task, now), facts: task.facts.map(factJson) });
}

function runtimeJson() {
  return { heartbeatLeaseSeconds: HEARTBEAT_LEASE_MS / 1000 };
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
