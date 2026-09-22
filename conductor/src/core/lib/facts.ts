import type { Workspace } from "./workspaces.js";
import type { ProjectBinding } from "./projects.js";

/**
 * The ledger's vocabulary. Deliberately small and domain-neutral: nothing here
 * knows the app domain. The workflow — which step
 * follows which — lives in the orchestrator Agent's system prompt, not in code.
 *
 * Four authors write facts:
 *   - a person (a chat user id or a source-namespaced external identity),
 *   - the orchestrator agent (via the decision actions), stamped {@link ORCHESTRATOR},
 *   - a named supporting Agent such as the ledger compactor,
 *   - the runtime / a worker (run_worker, tick), stamped {@link RUNTIME} or a worker id.
 *
 * Facts are append-only. A task's state is a fold over its facts.
 */

/** Written by a person. */
export const PERSON_KINDS = ["Created", "Reply", "Completed", "Cancelled"] as const;

/** Written by the orchestrator. Every one of these is a decision. */
export const DECISION_KINDS = ["JobCreated", "Asked", "Reported", "Waited", "Completed", "Cancelled", "Noted"] as const;

/** Written by the runtime or a worker: things that happened. */
export const RUNTIME_KINDS = ["Dispatched", "JobFailed", "Opened", "Returned", "Failed", "Lost", "Event"] as const;

/** Derived context retained in the ledger, but neither a decision nor an event. */
export const CONTEXT_KINDS = ["Snapshot"] as const;

export const FACT_KINDS = [
  "Created", "Reply", "Completed", "Cancelled",
  "JobCreated", "Dispatched", "Asked", "Reported", "Waited", "Noted",
  "JobFailed", "Opened", "Returned", "Failed", "Lost", "Event",
  "Snapshot",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export const RUNTIME = "runtime";
export const ORCHESTRATOR = "orchestrator";


/** Kinds that end a worker's run. A Dispatched with none of these after it is live. */
export const WORKER_TERMINAL_KINDS: readonly FactKind[] = ["Returned", "Failed", "Lost"];

/** Kinds that end a task, whoever wrote them. */
export const TERMINAL_KINDS: readonly FactKind[] = ["Completed", "Cancelled"];

export function isWorkerTerminalKind(kind: FactKind): boolean {
  return WORKER_TERMINAL_KINDS.includes(kind);
}

export function isTerminalKind(kind: FactKind): boolean {
  return TERMINAL_KINDS.includes(kind);
}

export interface FactHeader {
  /** The ledger's total order. Assigned by the database. */
  seq: number;
  id: string;
  taskId: string;
  /** A person's id, {@link ORCHESTRATOR}, {@link RUNTIME}, or a worker id. */
  by: string;
  /** A person's own words verbatim; for the rest, the call site. */
  source?: string;
  createdAt: Date;
}

type FactOf<K extends FactKind, P> = FactHeader & { kind: K; payload: P };

/**
 * Where a task came from, when it was not a person typing in chat. Domain-free
 * on purpose: an adapter names itself in `source` and identifies the thing it
 * saw in `key`, and the ledger holds at most one task per `(source, key)`,
 * ever. Everything the adapter wants to keep about that thing goes in `data`,
 * where only that adapter has to understand it.
 */
export interface TaskOrigin {
  /** Adapter slug: a stable name such as `mail` or `orders`. */
  source: string;
  /** Stable id inside that source. The intake dedupe key. */
  key: string;
  /** Where a person can go and look at it. */
  url?: string;
  title?: string;
  /** Who asked, named inside the source system. */
  actor?: string;
  /** Whatever else the adapter needs, opaque to everyone else. */
  data?: Record<string, unknown>;
}

/**
 * The issue a task was opened from. Superseded by {@link TaskOrigin}; facts
 * written before the ingest seam still carry it, and an append-only ledger
 * cannot be rewritten, so {@link originOf} reads both.
 */
export interface IssueOrigin {
  url: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  label: string;
}

/**
 * A separate outcome Task materialized by an engineering lead from a larger
 * delivery Task. Agent handoffs within one outcome are Jobs, not child Tasks.
 * This is lineage, not a dependency edge: the lead decides when work is
 * runnable and only then creates it.
 */
export interface TaskParent {
  taskId: string;
  /** Stable id for this unit inside the lead's evolving engineering plan. */
  planItemId: string;
  /** Durable product contract this unit helps deliver, when one exists. */
  specRef?: string;
  /** Durable engineering plan the lead is reconciling, when one exists. */
  planRef?: string;
}

// ---- person facts -------------------------------------------------------

export type CreatedFact = FactOf<"Created", {
  brief: string;
  projectId?: string;
  project?: ProjectBinding["project"];
  /** Present when an engineering lead created this separate outcome Task. */
  parent?: TaskParent;
  /** Set when a source adapter opened the task rather than a person in chat. */
  origin?: TaskOrigin;
  /** Legacy shape of the above, kept for facts already in the ledger. */
  issue?: IssueOrigin;
}>;
export type ReplyFact = FactOf<"Reply", { text: string }>;
/** Completed / Cancelled may be written by a person or by the orchestrator. */
export type CompletedFact = FactOf<"Completed", { reason?: string; evidence?: string }>;
export type CancelledFact = FactOf<"Cancelled", { reason?: string }>;

// ---- orchestrator decisions ---------------------------------------------

/** Worker reply status vocabulary. Semi-structured: an enum plus prose. */
export const WORKER_STATUSES = ["succeeded", "failed", "blocked", "waiting", "unparsed"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

/**
 * One bounded request from the task's coordinator to a logical agent. The
 * coordinator chooses the work and the agent role; runtime infrastructure
 * later chooses a concrete worker/session and records Dispatched.
 */
export type JobCreatedFact = FactOf<"JobCreated", {
  jobId: string;
  /** Canonical logical agent id, an `app:agent` id. */
  agent: string;
  /** The coordinator's self-contained direction to that agent. */
  instructions: string;
  /** Why this job is the next useful work; shown to people. */
  note?: string;
}>;

export type AskedFact = FactOf<"Asked", { question: string }>;
export type ReportedFact = FactOf<"Reported", { report: string }>;
export type WaitedFact = FactOf<"Waited", { reason: string; resumeAfter: string }>;
export type NotedFact = FactOf<"Noted", { note: string }>;

/**
 * A lossily compressed prefix of this same Task ledger. Raw facts remain
 * append-only; prompt construction may start from the newest Snapshot and the
 * facts after its covered prefix.
 */
export type SnapshotFact = FactOf<"Snapshot", {
  /** Newest fact faithfully represented by summary. */
  coversThroughSeq: number;
  /** Previous Snapshot folded into this one, when present. */
  previousSnapshotSeq?: number;
  /** Prompt-ready Markdown containing the Task's durable current state. */
  summary: string;
  schemaVersion: 1;
  /** Observability for why this compaction happened. */
  inputFactCount: number;
  estimatedInputTokens: number;
}>;

// ---- runtime / worker facts ---------------------------------------------

/** The runtime materialization of a JobCreated fact into a concrete run. */
export type DispatchedFact = FactOf<"Dispatched", {
  /** Absent only on facts written before Jobs were introduced. */
  jobId?: string;
  workerId: string;
  /** Canonical agent id the worker runs, an `app:agent` id. */
  agent: string;
  /** Copied from the Job so a historical run remains self-describing. */
  instructions: string;
  /** The full prompt the worker was launched with (instructions + runtime framing). */
  prompt: string;
  /** Why the orchestrator started this worker; shown to people. */
  note?: string;
  /** Worker whose session this one continues, if any. */
  resumeWorkerId?: string;
  resumeSessionId?: string;
  workspace?: Workspace;
  projectId?: string;
  project?: ProjectBinding["project"];
}>;
export type JobFailedFact = FactOf<"JobFailed", { jobId: string; agent: string; error: string }>;
export type OpenedFact = FactOf<"Opened", { jobId?: string; workerId: string; romeSessionId: string; sessionType: string }>;
export type ReturnedFact = FactOf<"Returned", {
  jobId?: string;
  workerId: string;
  status: WorkerStatus;
  summary: string;
  /** Everything else the worker said. */
  detail?: string;
  /** The verbatim reply, kept when parsing was lossy. */
  raw?: string;
  sessionId?: string;
  /** The requested session could not be resumed; the worker ran fresh. */
  restarted?: boolean;
}>;
export type FailedFact = FactOf<"Failed", { jobId?: string; workerId: string; error: string; sessionId?: string; restarted?: boolean }>;
export type LostFact = FactOf<"Lost", { jobId?: string; workerId: string; why: string }>;
/** Something outside the ledger happened. The orchestrator decides what it means. */
export type EventFact = FactOf<"Event", {
  /** Where it came from: an adapter slug or `runtime`. */
  source: string;
  /** e.g. `issue_closed`, `circuit_breaker`. */
  type: string;
  /** One line a person or the orchestrator can read. */
  summary: string;
  data?: Record<string, unknown>;
}>;

export type Fact =
  | CreatedFact | ReplyFact | CompletedFact | CancelledFact
  | JobCreatedFact | AskedFact | ReportedFact | WaitedFact | NotedFact
  | DispatchedFact | JobFailedFact | OpenedFact | ReturnedFact | FailedFact | LostFact | EventFact
  | SnapshotFact;

export type NewFact = Omit<Fact, "seq" | "id" | "createdAt">;

/**
 * Where a task came from, reading both the current `origin` and the legacy
 * `issue` field. Callers that need to know "is this the same thing we already
 * took in" ask this, never the raw payload.
 */
const LEGACY_ISSUE_SOURCE = "github";

export function originOf(created: CreatedFact): TaskOrigin | undefined {
  if (created.payload.origin) return created.payload.origin;
  const issue = created.payload.issue;
  if (!issue) return undefined;
  return {
    source: LEGACY_ISSUE_SOURCE,
    key: issue.url.toLowerCase(),
    url: issue.url,
    title: issue.title,
    actor: issue.author,
    data: { repo: issue.repo, number: issue.number, label: issue.label },
  };
}

export function workerIdOf(fact: Fact): string | undefined {
  switch (fact.kind) {
    case "Dispatched": case "Opened": case "Returned": case "Failed": case "Lost":
      return fact.payload.workerId;
    default:
      return undefined;
  }
}

/** One line of a task's history, for the orchestrator's brief or a chat summary. */
export function describeFact(fact: Fact, opts: { full?: boolean } = {}): string {
  const stamp = fact.createdAt.toISOString();
  const head = `#${fact.seq} ${stamp} ${fact.kind} by ${fact.by}`;
  const body = (() => {
    switch (fact.kind) {
      case "Created":
        return fact.payload.parent
          ? `${fact.payload.brief}\nMaterialized by parent ${fact.payload.parent.taskId} as plan item ${fact.payload.parent.planItemId}${fact.payload.parent.specRef ? ` from ${fact.payload.parent.specRef}` : ""}`
          : fact.payload.brief;
      case "Reply":
        return fact.payload.text;
      case "Completed":
        return [fact.payload.reason, fact.payload.evidence ? `evidence: ${fact.payload.evidence}` : ""].filter(Boolean).join(" — ");
      case "Cancelled":
        return fact.payload.reason ?? "";
      case "JobCreated": {
        const note = fact.payload.note ? `${fact.payload.note}\n` : "";
        const text = opts.full ? fact.payload.instructions : clip(fact.payload.instructions, 600);
        return `${note}job ${fact.payload.jobId} for ${fact.payload.agent}\nInstructions:\n${text}`;
      }
      case "Dispatched": {
        const resume = fact.payload.resumeWorkerId ? ` (continuing ${fact.payload.resumeWorkerId}'s session)` : "";
        const note = fact.payload.note ? `${fact.payload.note}\n` : "";
        const text = opts.full ? fact.payload.instructions : clip(fact.payload.instructions, 600);
        const job = fact.payload.jobId ? ` for job ${fact.payload.jobId}` : "";
        return `${note}worker ${fact.payload.workerId}${job} as ${fact.payload.agent}${resume}\nInstructions:\n${text}`;
      }
      case "Asked":
        return fact.payload.question;
      case "Reported":
        return fact.payload.report;
      case "Waited":
        return `until ${fact.payload.resumeAfter}: ${fact.payload.reason}`;
      case "Noted":
        return fact.payload.note;
      case "JobFailed":
        return `job ${fact.payload.jobId} for ${fact.payload.agent}: ${fact.payload.error}`;
      case "Opened":
        return `worker ${fact.payload.workerId} runs in session ${fact.payload.romeSessionId}`;
      case "Returned": {
        const detail = fact.payload.detail ? `\n${opts.full ? fact.payload.detail : clip(fact.payload.detail, 1500)}` : "";
        return `worker ${fact.payload.workerId} ${fact.payload.status}: ${fact.payload.summary}${detail}`;
      }
      case "Failed":
        return `worker ${fact.payload.workerId}: ${fact.payload.error}`;
      case "Lost":
        return `worker ${fact.payload.workerId}: ${fact.payload.why}`;
      case "Event": {
        const artifact = describeArtifactRef(fact.payload.data?.artifact);
        return `${fact.payload.source}/${fact.payload.type}: ${fact.payload.summary}${artifact ? `\nArtifact: ${artifact}` : ""}`;
      }
      case "Snapshot":
        return `covers through #${fact.payload.coversThroughSeq}${fact.payload.previousSnapshotSeq ? `, replacing snapshot #${fact.payload.previousSnapshotSeq}` : ""}\n${fact.payload.summary}`;
    }
  })();
  const cited = fact.source && fact.by !== RUNTIME && fact.by !== ORCHESTRATOR ? ` [source: ${clip(fact.source, 300)}]` : "";
  return body ? `${head} — ${body}${cited}` : `${head}${cited}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… [${text.length - max} more chars]` : text;
}

/** Render only the immutable pointer, never an Event's potentially large opaque data. */
function describeArtifactRef(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const artifact = value as Record<string, unknown>;
  const repo = typeof artifact.repo === "string" ? artifact.repo : "";
  const artifactPath = typeof artifact.path === "string" ? artifact.path : "";
  const commit = typeof artifact.commit === "string" ? artifact.commit : "";
  if (!repo || !artifactPath || !commit) return undefined;
  const sha256 = typeof artifact.sha256 === "string" ? artifact.sha256 : undefined;
  const url = typeof artifact.url === "string" ? artifact.url : undefined;
  return `${repo}@${commit}:${artifactPath}${sha256 ? ` (sha256 ${sha256})` : ""}${url ? ` — ${url}` : ""}`;
}
