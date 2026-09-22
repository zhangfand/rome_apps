import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, TICK_LOCK } from "../db/repositories/lock.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import { createWorkerHealthRepository } from "../db/repositories/worker-health.js";
import { createTaskSessionRepository, type TaskSessionRef } from "../db/repositories/task-sessions.js";
import { createAgentInstanceRepository, type AgentInstanceRef } from "../db/repositories/agent-instances.js";
import { createRuntimeControlRepository, type RuntimeControl } from "../db/repositories/runtime-control.js";
import { persistConfiguration } from "../actions/setup/index.js";
import type { CoreComposition } from "../lib/composition.js";
import type { ConductorConfig } from "../lib/config.js";
import { type Fact } from "../lib/facts.js";
import { fold, foldTask, needsAttention, type TaskView } from "../lib/fold.js";
import { ingestAtomically, type IngestRequest } from "../lib/ingest.js";
import { HEARTBEAT_LEASE_MS } from "../lib/worker-health.js";
import { browseDirectories, DirectoryBrowserError } from "../lib/directory-browser.js";
import { createFrontdeskShadowRepository } from "../db/repositories/frontdesk-shadow.js";
import { frontdeskShadowLimit, frontdeskShadowReport } from "../frontdesk/report.js";

/**
 *   GET state              every task, folded, with its latest decision
 *   POST tasks             a source opens a task (ingest seam)
 *   POST tasks/:id/events  a source reports something happened (ingest seam)
 *   GET tasks/:id          one task with every fact
 *   GET tasks/:id/<domain> app-owned, guardian-only task reads
 *   POST tasks/:id/reply   a person's reply, through conductor:record_person_reply
 *   POST tasks/:id/complete close as done, through conductor:complete_task
 *   POST tasks/:id/cancel  close as not wanted, through conductor:cancel_task
 *   GET|PATCH config       settings; projects.<id>: null deletes (force=1 overrides the open-task guard)
 *   GET config/inspect     inspect one working directory through its workspace provider
 *   GET config/directories browse directories on the Rome host
 *   POST config/<domain>   app-owned configuration operations, such as cloning
 *   GET frontdesk-shadow   recent Jev/LLM routing comparisons
 *   POST runtime/pause     pause or resume runtime dispatch
 *   POST tick              run a tick now
 */
class ConductorApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext, private readonly composition: CoreComposition) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");
    const ledger = createLedgerRepository(this.ctx.db);
    const settings = createSettingsRepository(this.ctx.db, this.composition.parseConfig);
    const runtimeControl = createRuntimeControlRepository(this.ctx.db);
    try {
      if (request.method === "GET" && route === "state") {
        if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
        const now = new Date();
        const snapshot = fold(now, ledger.all());
        const config = settings.get();
        const health = config ? safe(() => createWorkerHealthRepository(this.ctx.db).status(now)) : [];
        const lock = createLockRepository(this.ctx.db).peek(TICK_LOCK);
        const storedSessions = safe(() => createTaskSessionRepository(this.ctx.db).all()) ?? [];
        const sessionsByTask = groupTaskSessions(storedSessions);
        const coordinatorInstances = safe(() => createAgentInstanceRepository(this.ctx.db).allTaskCoordinators()) ?? [];
        const instancesByTask = new Map(coordinatorInstances.map((instance) => [instance.taskId, instance]));
        return json({
          now: now.toISOString(),
          configured: Boolean(config),
          projects: config ? Object.fromEntries(Object.entries(config.projects).map(([id, p]) => [id, { workingDir: p.workingDir, workspace: p.workspace, ...this.composition.projectPresentation?.(p, config) }])) : {},
          maxWorkers: config?.maxWorkers ?? 0,
          tickRunning: Boolean(lock && lock.heldUntil > now.getTime()),
          runtimePaused: runtimeControl.get().paused,
          tasks: snapshot.tasks.map((task) => taskSummary(task, now, this.composition, config, sessionsByTask.get(task.id), instancesByTask.get(task.id))),
          workers: health ?? [],
        });
      }
      if (route === "frontdesk-shadow") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        const limit = frontdeskShadowLimit(request.query.get("limit"));
        const rows = createFrontdeskShadowRepository(this.ctx.db).recent(limit);
        return json(frontdeskShadowReport(rows));
      }
      if (request.path[0] === "tasks" && request.path.length === 2 && request.method === "GET") {
        const facts = ledger.factsFor(request.path[1]);
        if (!facts.length) return json({ error: "task_not_found" }, 404);
        const now = new Date();
        const task = foldTask(facts);
        const storedSessions = safe(() => createTaskSessionRepository(this.ctx.db).forTask(task.id)) ?? [];
        const coordinatorInstance = safe(() => createAgentInstanceRepository(this.ctx.db).forTaskCoordinator(task.id));
        return json({ ...taskSummary(task, now, this.composition, settings.get(), storedSessions, coordinatorInstance), facts: task.facts.map(factJson) });
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
        const body = readJsonBody<{ text?: unknown; seenSeq?: unknown }>(request);
        if (!body || typeof body.text !== "string" || !body.text.trim()) return json({ error: "Enter a reply." }, 400);
        if (!Number.isInteger(body.seenSeq)) return json({ error: "seenSeq is required." }, 400);
        const result = await this.ctx.runAction("conductor:record_person_reply", { taskId: request.path[1], seenSeq: body.seenSeq, text: body.text.trim(), source: body.text.trim() });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `reply returned ${result.status}` }, 502);
        if (isConflictData(result.data)) return json(result.data, 409);
        return json(result.data ?? {});
      }
      if (request.path[0] === "tasks" && request.path[2] === "complete" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<{ seenSeq?: unknown }>(request);
        if (!body || !Number.isInteger(body.seenSeq)) return json({ error: "seenSeq is required." }, 400);
        const taskId = request.path[1];
        const result = await this.ctx.runAction("conductor:complete_task", { taskId, seenSeq: body.seenSeq, source: "Mark complete" });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `complete returned ${result.status}` }, 502);
        if (isConflictData(result.data)) return json(result.data, 409);
        return refreshedTask(ledger.factsFor(taskId), this.composition, settings.get(), safe(() => createTaskSessionRepository(this.ctx.db).forTask(taskId)) ?? [], safe(() => createAgentInstanceRepository(this.ctx.db).forTaskCoordinator(taskId)));
      }
      if (request.path[0] === "tasks" && request.path[2] === "cancel" && request.path.length === 3) {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<{ seenSeq?: unknown }>(request);
        if (!body || !Number.isInteger(body.seenSeq)) return json({ error: "seenSeq is required." }, 400);
        const taskId = request.path[1];
        const result = await this.ctx.runAction("conductor:cancel_task", { taskId, seenSeq: body.seenSeq, source: "Cancel task" });
        if (result.status !== "ok") return json({ error: result.status === "error" ? result.error : `cancel returned ${result.status}` }, 502);
        if (isConflictData(result.data)) return json(result.data, 409);
        return refreshedTask(ledger.factsFor(taskId), this.composition, settings.get(), safe(() => createTaskSessionRepository(this.ctx.db).forTask(taskId)) ?? [], safe(() => createAgentInstanceRepository(this.ctx.db).forTaskCoordinator(taskId)));
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
      if (route === "config/directories") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        try {
          return json(await browseDirectories(request.query.get("path") ?? undefined));
        } catch (error) {
          if (error instanceof DirectoryBrowserError) return json({ error: error.message }, error.status);
          throw error;
        }
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
          return json({ configured: Boolean(config), config: shown, runtime: runtimeJson(this.composition, shown, runtimeControl.get()), projectPresentation: configPresentation(shown, this.composition) });
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
        return json({ configured: true, config: parsed.config, runtime: runtimeJson(this.composition, parsed.config, runtimeControl.get()), projectPresentation: configPresentation(parsed.config, this.composition) });
      }
      if (route === "runtime/pause") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
        const body = readJsonBody<{ paused?: unknown }>(request);
        if (!body || typeof body.paused !== "boolean") return json({ error: "paused must be a boolean." }, 400);
        const control = runtimeControl.setPaused(body.paused);
        this.ctx.log.info(body.paused ? "guardian paused conductor runtime" : "guardian resumed conductor runtime");
        return json(runtimeControlJson(control));
      }
      if (route === "tick" && request.method === "POST") {
        if (request.caller.kind !== "guardian") return json({ error: "forbidden" }, 403);
        const result = await this.ctx.runAction("conductor:reconcile_tasks", {});
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
    if (!config) return json({ error: "Run conductor:configure_conductor first." }, 409);
    if (!ledger.reachable()) return json({ error: "the ledger is unreachable" }, 503);
    const [outcome] = ingestAtomically(ledger, { config, requests: [request] });
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

function refreshedTask(facts: Fact[], composition: CoreComposition, config?: ConductorConfig, storedSessions: TaskSessionRef[] = [], coordinatorInstance?: AgentInstanceRef): Response {
  if (!facts.length) return json({ error: "task_not_found" }, 404);
  const now = new Date();
  const task = foldTask(facts);
  return json({ ...taskSummary(task, now, composition, config, storedSessions, coordinatorInstance), facts: task.facts.map(factJson) });
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

function runtimeJson(composition: CoreComposition, config?: ConductorConfig, control: RuntimeControl = { paused: false }) {
  return {
    heartbeatLeaseSeconds: HEARTBEAT_LEASE_MS / 1000,
    workspaceKinds: composition.workspaceKinds,
    defaultWorkspaceKind: composition.defaultWorkspaceKind,
    ...runtimeControlJson(control),
  };
}

function runtimeControlJson(control: RuntimeControl) {
  return {
    paused: control.paused,
    ...(control.updatedAt ? { pauseChangedAt: control.updatedAt.toISOString() } : {}),
  };
}

function taskSummary(task: TaskView, now: Date, composition: CoreComposition, config?: ConductorConfig, storedSessions: TaskSessionRef[] = [], coordinatorInstance?: AgentInstanceRef) {
  const attention = needsAttention(task, now);
  const presentation = composition.projectPresentation?.(task.project, config);
  return {
    id: task.id,
    brief: task.brief,
    projectId: task.projectId,
    repo: presentation?.repo,
    projectSubtitle: presentation?.repo,
    workRepo: presentation?.workRepo,
    createdBy: task.createdBy,
    coordinatorAgent: config?.orchestratorAgent,
    coordinatorInstance: coordinatorInstance ? {
      id: coordinatorInstance.id,
      agent: coordinatorInstance.agentName,
      status: coordinatorInstance.status,
      sessionId: coordinatorInstance.sessionId,
      deliveredThroughSeq: coordinatorInstance.cursorSeq,
    } : undefined,
    createdAt: task.facts[0].createdAt.toISOString(),
    updatedAt: task.latest.createdAt.toISOString(),
    state: task.state,
    liveWorker: task.liveWorker ? {
      jobId: task.liveWorker.jobId,
      workerId: task.liveWorker.workerId,
      agent: task.liveWorker.agent,
      since: task.liveWorker.startedAt.toISOString(),
      romeSession: task.liveWorker.romeSession,
    } : undefined,
    pendingJob: task.pendingJob ? {
      jobId: task.pendingJob.jobId,
      agent: task.pendingJob.agent,
      since: task.pendingJob.createdAt.toISOString(),
    } : undefined,
    lastDecision: task.lastDecision ? factJson(task.lastDecision) : undefined,
    latest: factJson(task.latest),
    waiting: task.waiting,
    decisionsSinceLastPersonFact: task.decisionsSinceLastPersonFact,
    needsAttention: attention.wake ? attention.why : undefined,
    factCount: task.facts.length,
    usageSessions: taskUsageSessions(task, storedSessions, config),
  };
}

function groupTaskSessions(rows: TaskSessionRef[]): Map<string, TaskSessionRef[]> {
  const grouped = new Map<string, TaskSessionRef[]>();
  for (const row of rows) grouped.set(row.taskId, [...(grouped.get(row.taskId) ?? []), row]);
  return grouped;
}

/**
 * Session ids are the join key into Rome's guardian-only session accounting
 * API. Opened facts backfill worker sessions from before the join table was
 * introduced; coordinator sessions can only be tracked from this version on.
 */
function taskUsageSessions(task: TaskView, stored: TaskSessionRef[], config?: ConductorConfig) {
  const refs = new Map<string, {
    id: string;
    type: string;
    role: "coordinator" | "worker" | "compactor";
    workerId?: string;
    jobId?: string;
    triggerSeq?: number;
    resultSeq?: number;
    firstSeenAt: string;
  }>();
  for (const row of stored) refs.set(row.sessionId, {
    id: row.sessionId,
    type: row.sessionType,
    role: row.role,
    workerId: row.workerId,
    jobId: row.jobId,
    triggerSeq: row.triggerSeq,
    resultSeq: row.resultSeq,
    firstSeenAt: row.createdAt.toISOString(),
  });
  for (const fact of task.facts) {
    if (fact.kind !== "Opened" || refs.has(fact.payload.romeSessionId)) continue;
    refs.set(fact.payload.romeSessionId, {
      id: fact.payload.romeSessionId,
      type: fact.payload.sessionType,
      role: "worker",
      workerId: fact.payload.workerId,
      jobId: fact.payload.jobId,
      firstSeenAt: fact.createdAt.toISOString(),
    });
  }
  return [...refs.values()].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt)).map((ref) => {
    const dispatch = ref.workerId
      ? task.facts.find((fact) => fact.kind === "Dispatched" && fact.payload.workerId === ref.workerId)
      : undefined;
    const outcome = ref.workerId && dispatch
      ? task.facts.find((fact) => fact.seq > dispatch.seq && ["Returned", "Failed", "Lost"].includes(fact.kind) && (fact.payload as { workerId?: string }).workerId === ref.workerId)
      : undefined;
    return {
      ...ref,
      triggerSeq: ref.triggerSeq ?? dispatch?.seq,
      resultSeq: ref.resultSeq ?? outcome?.seq,
      agent: ref.role === "coordinator"
        ? config?.orchestratorAgent
        : ref.role === "compactor"
          ? "conductor:ledger-compactor"
          : dispatch?.kind === "Dispatched" ? dispatch.payload.agent : undefined,
    };
  });
}

function factJson(fact: Fact) {
  return { seq: fact.seq, id: fact.id, taskId: fact.taskId, kind: fact.kind, by: fact.by, source: fact.source, payload: fact.payload, createdAt: fact.createdAt.toISOString() };
}

function safe<T>(fn: () => T): T | undefined {
  try { return fn(); } catch { return undefined; }
}

function isConflictData(data: unknown): data is { status: "conflict" } {
  return Boolean(data && typeof data === "object" && (data as { status?: unknown }).status === "conflict");
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
