import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, TICK_LOCK } from "../db/repositories/lock.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import { createWorkerHealthRepository } from "../db/repositories/worker-health.js";
import { persistConfiguration } from "../actions/setup/index.js";
import type { CoreComposition } from "../lib/composition.js";
import type { ConductorConfig } from "../lib/config.js";
import { type Fact } from "../lib/facts.js";
import { fold, foldTask, needsAttention, type TaskView } from "../lib/fold.js";
import { applyIngest, type IngestRequest, planIngest } from "../lib/ingest.js";
import { HEARTBEAT_LEASE_MS } from "../lib/worker-health.js";

/**
 *   GET state              every task, folded, with its latest decision
 *   POST tasks             a source opens a task (ingest seam)
 *   POST tasks/:id/events  a source reports something happened (ingest seam)
 *   GET tasks/:id          one task with every fact
 *   GET tasks/:id/<domain> app-owned, guardian-only task reads
 *   POST tasks/:id/reply   a person's reply, through conductor:reply
 *   POST tasks/:id/complete close as done, through conductor:complete
 *   POST tasks/:id/cancel  close as not wanted, through conductor:cancel
 *   GET|PATCH config       settings; projects.<id>: null deletes (force=1 overrides the open-task guard)
 *   GET config/inspect     inspect one working directory through its workspace provider
 *   POST config/<domain>   app-owned configuration operations, such as cloning
 *   POST tick              run a tick now
 */
class ConductorApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext, private readonly composition: CoreComposition) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");
    const ledger = createLedgerRepository(this.ctx.db);
    const settings = createSettingsRepository(this.ctx.db, this.composition.parseConfig);
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
          projects: config ? Object.fromEntries(Object.entries(config.projects).map(([id, p]) => [id, { workingDir: p.workingDir, workspace: p.workspace, ...this.composition.projectPresentation?.(p, config) }])) : {},
          maxWorkers: config?.maxWorkers ?? 0,
          tickRunning: Boolean(lock && lock.heldUntil > now.getTime()),
          tasks: snapshot.tasks.map((task) => taskSummary(task, now, this.composition, config)),
          workers: health ?? [],
        });
      }
      if (request.path[0] === "tasks" && request.path.length === 2 && request.method === "GET") {
        const facts = ledger.factsFor(request.path[1]);
        if (!facts.length) return json({ error: "task_not_found" }, 404);
        const now = new Date();
        const task = foldTask(facts);
        return json({ ...taskSummary(task, now, this.composition, settings.get()), facts: task.facts.map(factJson) });
      }
      const taskRoute = request.path[0] === "tasks"
        ? this.composition.taskRoutes?.find((candidate) => (
          candidate.method === request.method && samePath(candidate.path, request.path.slice(2))
        ))
        : undefined;
      if (taskRoute) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        const facts = ledger.factsFor(request.path[1]);
        if (!facts.length) return json({ error: "task_not_found" }, 404);
        return json(await taskRoute.handle(this.ctx, foldTask(facts)));
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
        return refreshedTask(ledger.factsFor(taskId), this.composition, settings.get());
      }
      if (request.path[0] === "tasks" && request.path[2] === "cancel" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const taskId = request.path[1];
        const result = await this.ctx.runAction("conductor:cancel", { taskId, source: "Cancel task" });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `cancel returned ${result.status}` }, 502);
        return refreshedTask(ledger.factsFor(taskId), this.composition, settings.get());
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
      if (route === "config/inspect") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        const kind = request.query.get("workspace") ?? this.composition.defaultWorkspaceKind;
        const workingDir = request.query.get("workingDir") ?? "";
        if (!this.composition.workspaceKinds.includes(kind)) return json({ error: `Unknown workspace kind: ${kind}` }, 400);
        if (!workingDir.startsWith("/") || workingDir.includes("\0")) return json({ error: "workingDir must be an absolute path" }, 400);
        const inspect = this.composition.providerFor(kind).inspect;
        if (!inspect) return json({ error: `Workspace kind ${kind} cannot be inspected.` }, 501);
        return json(await inspect(workingDir));
      }
      const configRoute = request.path[0] === "config"
        ? this.composition.configRoutes?.find((candidate) => (
          candidate.method === request.method && samePath(candidate.path, request.path.slice(1))
        ))
        : undefined;
      if (configRoute) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        const result = await configRoute.handle(this.ctx, request);
        return result instanceof Response ? result : json(result);
      }
      if (route === "config") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method === "GET") {
          const config = settings.get();
          const shown = config ?? this.composition.initialConfig;
          return json({ configured: Boolean(config), config: shown, runtime: runtimeJson(this.composition), projectPresentation: configPresentation(shown, this.composition) });
        }
        if (request.method !== "PATCH") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<Record<string, unknown>>(request);
        if (!body || typeof body !== "object") return json({ error: "A JSON object of changes is required." }, 400);
        const current = settings.get();
        const { force: bodyForce, ...patch } = body;
        const deletions = deletedProjects(patch);
        const forced = request.query.get("force") === "1" || bodyForce === true;
        if (deletions.length && !forced) {
          const tasks = fold(new Date(), ledger.all()).tasks;
          for (const projectId of deletions) {
            const count = tasks.filter((task) => task.state === "open" && task.projectId === projectId).length;
            if (count > 0) return json({ error: `${count} open task${count === 1 ? " is" : "s are"} bound to project ${projectId}.`, projectId, count }, 409);
          }
        }
        const merged = this.composition.mergeConfig
          ? this.composition.mergeConfig(current ?? this.composition.initialConfig, patch)
          : mergeConfig(current ?? this.composition.initialConfig, patch);
        const parsed = this.composition.parseConfig(merged);
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        if (current) {
          settings.put(parsed.config);
        } else {
          const installed = await persistConfiguration(this.ctx, this.composition, parsed.config);
          if (!installed.ok) return json({ error: installed.error }, 503);
        }
        this.ctx.log.info("guardian updated conductor configuration", { fields: Object.keys(patch) });
        return json({ configured: true, config: parsed.config, runtime: runtimeJson(this.composition), projectPresentation: configPresentation(parsed.config, this.composition) });
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

function refreshedTask(facts: Fact[], composition: CoreComposition, config?: ConductorConfig): Response {
  if (!facts.length) return json({ error: "task_not_found" }, 404);
  const now = new Date();
  const task = foldTask(facts);
  return json({ ...taskSummary(task, now, composition, config), facts: task.facts.map(factJson) });
}

function mergeConfig(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, ...patch };
  if (patch.projects && typeof patch.projects === "object" && !Array.isArray(patch.projects)) {
    merged.projects = { ...(current.projects as Record<string, unknown> ?? {}) };
    for (const [id, value] of Object.entries(patch.projects as Record<string, unknown>)) {
      if (value === null) delete (merged.projects as Record<string, unknown>)[id];
      else (merged.projects as Record<string, unknown>)[id] = {
          ...((merged.projects as Record<string, Record<string, unknown>>)[id] ?? {}),
          ...(value as Record<string, unknown>),
        };
    }
    if (typeof merged.defaultProject === "string" && !Object.hasOwn(merged.projects as object, merged.defaultProject)) delete merged.defaultProject;
  }
  return merged;
}

function deletedProjects(patch: Record<string, unknown>): string[] {
  if (!patch.projects || typeof patch.projects !== "object" || Array.isArray(patch.projects)) return [];
  return Object.entries(patch.projects as Record<string, unknown>)
    .filter(([, value]) => value === null)
    .map(([id]) => id);
}

function configPresentation(config: ConductorConfig, composition: CoreComposition) {
  return Object.fromEntries(Object.entries(config.projects).map(([id, project]) => [id, composition.projectPresentation?.(project, config) ?? {}]));
}

function runtimeJson(composition: CoreComposition) {
  return {
    heartbeatLeaseSeconds: HEARTBEAT_LEASE_MS / 1000,
    workspaceKinds: composition.workspaceKinds,
    defaultWorkspaceKind: composition.defaultWorkspaceKind,
  };
}

function taskSummary(task: TaskView, now: Date, composition: CoreComposition, config?: ConductorConfig) {
  const attention = needsAttention(task, now);
  return {
    id: task.id,
    brief: task.brief,
    projectId: task.projectId,
    repo: composition.projectPresentation?.(task.project, config)?.repo,
    projectSubtitle: composition.projectPresentation?.(task.project, config)?.repo,
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

function samePath(expected: readonly string[], actual: readonly string[]): boolean {
  return expected.length === actual.length && expected.every((part, index) => part === actual[index]);
}

export function createApiHandler(ctx: RomeAppContext, composition: CoreComposition): RomeAppApiHandler {
  return new ConductorApiHandler(ctx, composition);
}
