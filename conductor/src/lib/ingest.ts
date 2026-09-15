import type { ConductorConfig } from "./config.js";
import { type CreatedFact, type EventFact, type NewFact, originOf, RUNTIME, type TaskOrigin } from "./facts.js";
import type { LedgerSnapshot, TaskView } from "./fold.js";
import { resolveHumanProject } from "./projects.js";

/**
 * The ingest seam: the only door into the ledger from outside Conductor.
 *
 * A source — the GitHub poll, an order system, a mailbox, a person with curl —
 * does not append facts. It hands this module a request, and this module
 * decides whether a fact is written and exactly which one. Three things follow
 * from that, and they are the whole point of the seam:
 *
 * 1. **A narrower vocabulary than the ledger.** A source may open a task
 *    (`Created`) and report that something happened (`Event`). Nothing else.
 *    There is no shape here that produces `Dispatched`, `Reported`, `Waited`,
 *    `Completed` or any other decision, so no amount of malformed or hostile
 *    input can make the runtime loop appear to have decided something. A
 *    person's `Reply` is deliberately absent too: replies come from the
 *    guardian's own routes, not from a machine claiming to be a person.
 * 2. **Authorship is computed, never accepted.** `by` is derived from the
 *    source slug and the actor it names, so `runtime` and `orchestrator`
 *    cannot be impersonated.
 * 3. **Idempotency is the seam's job.** A webhook that retries, a poll that
 *    sees the same issue twice, two adapters watching one system — all land on
 *    `(source, key)` and write once.
 *
 * Everything here except {@link applyIngest} is pure: give it a snapshot and
 * requests, get the facts that should exist. Nothing in this file knows what a
 * pull request is.
 */

/** Slugs a source may not claim: they are the ledger's own identities. */
export const RESERVED_SOURCES = new Set([RUNTIME, "orchestrator", "person", "worker"]);

const SOURCE_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const TYPE_RE = /^[a-z][a-z0-9_.-]{0,63}$/;

/** Longest brief the seam stores; past this it is cut with a pointer to `url`. */
export const MAX_BRIEF_CHARS = 8000;
/** Longest one-line event summary. */
export const MAX_SUMMARY_CHARS = 1000;
/** Largest `data` blob, serialized. A source with more to say links to it. */
export const MAX_DATA_BYTES = 32_000;

/**
 * Open a task. `source` names the system that saw the ask (and namespaces the
 * author); `cite` is the requester's own words, kept verbatim on the fact.
 */
export interface OpenTaskRequest {
  op: "open_task";
  source: string;
  /** What to do, as the requester put it. Becomes the task's brief. */
  brief: string;
  /** Stable id in the source system. One task per `(source, key)`, ever. */
  key?: string;
  /** Who asked, named inside the source system. */
  actor?: string;
  /** The fact's citation: where this came from, or the raw message. */
  cite?: string;
  url?: string;
  title?: string;
  data?: Record<string, unknown>;
  /** Configured project the work belongs to; resolved like a chat request when absent. */
  projectId?: string;
}

/** Report that something happened outside the ledger, on a task that exists. */
export interface PushEventRequest {
  op: "push_event";
  source: string;
  taskId: string;
  /** What kind of thing happened, e.g. `issue_closed`, `payment_failed`. */
  type: string;
  /** One line the orchestrator and a person can both read. */
  summary: string;
  /** Idempotency key within the task; defaults to `type`. */
  key?: string;
  cite?: string;
  data?: Record<string, unknown>;
}

export type IngestRequest = OpenTaskRequest | PushEventRequest;

export type IngestPlan =
  | { request: IngestRequest; status: "recorded"; taskId: string; fact: NewFact }
  | { request: IngestRequest; status: "duplicate"; taskId: string; reason: string }
  | { request: IngestRequest; status: "rejected"; reason: string };

export interface IngestOutcome {
  op: IngestRequest["op"];
  source: string;
  status: IngestPlan["status"];
  taskId?: string;
  kind?: "Created" | "Event";
  seq?: number;
  reason?: string;
}

/**
 * What the ledger should look like after these requests, as values. The order
 * of `requests` is preserved, and a request that duplicates an earlier one in
 * the same batch is reported as a duplicate — a poll that lists the same issue
 * twice opens one task.
 */
export function planIngest(input: {
  snapshot: LedgerSnapshot;
  config: ConductorConfig;
  requests: readonly IngestRequest[];
  newTaskId?: () => string;
  /**
   * Origin keys a source already considers taken by its own rules, mapped to
   * the task that holds them. The GitHub adapter passes the issues people
   * named in briefs; the seam knows nothing about why.
   */
  claimed?: ReadonlyMap<string, string>;
}): IngestPlan[] {
  const newTaskId = input.newTaskId ?? (() => `t-${crypto.randomUUID().slice(0, 8)}`);
  const claimed = claimedOrigins(input.snapshot);
  for (const [key, taskId] of input.claimed ?? []) claimed.set(key.toLowerCase(), taskId);
  const tasks = new Map(input.snapshot.tasks.map((task) => [task.id, task]));
  const eventKeys = new Map<string, Set<string>>();

  return input.requests.map((request): IngestPlan => {
    const bad = checkSource(request.source);
    if (bad) return { request, status: "rejected", reason: bad };
    return request.op === "open_task"
      ? planOpenTask(request, { config: input.config, claimed, newTaskId })
      : planPushEvent(request, { tasks, eventKeys });
  });
}

function planOpenTask(
  request: OpenTaskRequest,
  ctx: { config: ConductorConfig; claimed: Map<string, string>; newTaskId: () => string },
): IngestPlan {
  const brief = clip(String(request.brief ?? "").trim(), MAX_BRIEF_CHARS, request.url);
  if (!brief) return { request, status: "rejected", reason: "brief is required" };
  const dataError = checkData(request.data);
  if (dataError) return { request, status: "rejected", reason: dataError };

  const key = String(request.key ?? "").trim();
  if (key) {
    const claimKey = `${request.source}:${key}`.toLowerCase();
    const existing = ctx.claimed.get(claimKey);
    if (existing !== undefined) {
      return { request, status: "duplicate", taskId: existing, reason: `${request.source}:${key} already has a task` };
    }
  }

  let binding: ReturnType<typeof resolveHumanProject>;
  try {
    binding = resolveHumanProject(ctx.config, { projectId: request.projectId?.trim() || undefined });
  } catch (error) {
    return { request, status: "rejected", reason: error instanceof Error ? error.message : String(error) };
  }

  const taskId = ctx.newTaskId();
  if (key) ctx.claimed.set(`${request.source}:${key}`.toLowerCase(), taskId);
  const origin: TaskOrigin | undefined = key
    ? {
        source: request.source,
        key,
        ...(request.url ? { url: request.url } : {}),
        ...(request.title ? { title: request.title } : {}),
        ...(request.actor ? { actor: request.actor } : {}),
        ...(request.data ? { data: request.data } : {}),
      }
    : undefined;

  const fact: NewFact = {
    taskId,
    kind: "Created",
    by: authorOf(request.source, request.actor),
    source: request.cite?.trim() || `${request.source}${request.url ? `: ${request.url}` : ""}`,
    payload: { brief, ...binding, ...(origin ? { origin } : {}) },
  };
  return { request, status: "recorded", taskId, fact };
}

function planPushEvent(
  request: PushEventRequest,
  ctx: { tasks: Map<string, TaskView>; eventKeys: Map<string, Set<string>> },
): IngestPlan {
  const type = String(request.type ?? "").trim();
  if (!TYPE_RE.test(type)) return { request, status: "rejected", reason: `type must match ${TYPE_RE.source}` };
  const summary = String(request.summary ?? "").trim();
  if (!summary) return { request, status: "rejected", reason: "summary is required" };
  const dataError = checkData(request.data);
  if (dataError) return { request, status: "rejected", reason: dataError };

  const task = ctx.tasks.get(request.taskId);
  if (!task) return { request, status: "rejected", reason: `no task ${request.taskId}` };
  if (task.state !== "open") {
    return { request, status: "rejected", reason: `task ${task.id} is ${task.state}; events are only recorded on open tasks` };
  }

  const key = String(request.key ?? "").trim() || type;
  let seen = ctx.eventKeys.get(task.id);
  if (!seen) {
    seen = recordedEventKeys(task);
    ctx.eventKeys.set(task.id, seen);
  }
  const scoped = `${request.source}:${key}`;
  if (seen.has(scoped)) return { request, status: "duplicate", taskId: task.id, reason: `${scoped} is already on the task` };
  seen.add(scoped);

  const fact: NewFact = {
    taskId: task.id,
    kind: "Event",
    // The runtime transcribed it; which outside world it came from is
    // `payload.source`. Keeping `by` here means an Event can never read as a
    // person speaking, whoever pushed it.
    by: RUNTIME,
    source: request.cite?.trim() || `ingest from ${request.source}`,
    payload: {
      source: request.source,
      type,
      summary: clip(summary, MAX_SUMMARY_CHARS),
      data: { key, ...(request.data ?? {}) },
    },
  };
  return { request, status: "recorded", taskId: task.id, fact };
}

/** `source:actor`, or the bare source when nobody is named. Never taken from input. */
export function authorOf(source: string, actor?: string): string {
  const named = String(actor ?? "").trim().replace(/\s+/g, " ").slice(0, 128);
  return named ? `${source}:${named}` : source;
}

/** Every `(source, key)` the ledger has already opened a task for, open or closed. */
export function claimedOrigins(snapshot: LedgerSnapshot): Map<string, string> {
  const out = new Map<string, string>();
  for (const task of snapshot.tasks) {
    const created = task.facts.find((fact): fact is CreatedFact => fact.kind === "Created");
    if (!created) continue;
    const origin = originOf(created);
    if (origin) out.set(`${origin.source}:${origin.key}`.toLowerCase(), task.id);
  }
  return out;
}

/** Event keys already on a task, scoped by the source that pushed them. */
export function recordedEventKeys(task: TaskView): Set<string> {
  const out = new Set<string>();
  for (const fact of task.facts) {
    if (fact.kind !== "Event") continue;
    const payload = (fact as EventFact).payload;
    const key = payload.data?.key;
    out.add(`${payload.source}:${typeof key === "string" && key ? key : payload.type}`);
  }
  return out;
}

function checkSource(source: unknown): string | undefined {
  const slug = String(source ?? "").trim();
  if (!SOURCE_RE.test(slug)) return `source must match ${SOURCE_RE.source}`;
  if (RESERVED_SOURCES.has(slug)) return `source ${JSON.stringify(slug)} is reserved for the ledger's own identities`;
  return undefined;
}

function checkData(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  if (typeof data !== "object" || Array.isArray(data)) return "data must be a JSON object";
  let size: number;
  try {
    size = JSON.stringify(data).length;
  } catch {
    return "data must be JSON-serializable";
  }
  return size > MAX_DATA_BYTES ? `data is ${size} bytes; the limit is ${MAX_DATA_BYTES}` : undefined;
}

function clip(text: string, max: number, url?: string): string {
  if (text.length <= max) return text;
  const pointer = url ? `; the full text is at ${url}` : "";
  return `${text.slice(0, max)}\n\n[… cut at ${max} characters${pointer}]`;
}

/** The ledger writes a plan needs. Narrow on purpose: appends, nothing else. */
export interface IngestLedger {
  append(fact: NewFact): { seq: number };
}

/**
 * Write the planned facts. Reporting, not deciding: it never wakes the
 * orchestrator and never runs a tick — the next scheduled pass finds the new
 * facts the same way it finds every other one, so the loop keeps exactly one
 * driver.
 */
export function applyIngest(ledger: IngestLedger, plans: readonly IngestPlan[]): IngestOutcome[] {
  return plans.map((plan): IngestOutcome => {
    const base = { op: plan.request.op, source: plan.request.source } as const;
    if (plan.status !== "recorded") {
      return { ...base, status: plan.status, reason: plan.reason, ...(plan.status === "duplicate" ? { taskId: plan.taskId } : {}) };
    }
    const written = ledger.append(plan.fact);
    return { ...base, status: "recorded", taskId: plan.taskId, kind: plan.fact.kind as "Created" | "Event", seq: written.seq };
  });
}

/** One line per outcome, for a tick's `applied` list and the logs. */
export function describeOutcome(outcome: IngestOutcome): string {
  if (outcome.status === "recorded") return `${outcome.kind}(${outcome.taskId}) from ${outcome.source} #${outcome.seq}`;
  return `${outcome.status} (${outcome.source} ${outcome.op}): ${outcome.reason}`;
}
