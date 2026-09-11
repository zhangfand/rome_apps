import type { WorkerWorkspace } from "./worktree.js";
import type { ProjectBinding } from "./projects.js";

/**
 * The ledger's vocabulary. Deliberately small and domain-neutral: nothing here
 * knows what a "pull request" or an "evaluation" is. The workflow — which step
 * follows which — lives in the SOP prompt the orchestrator reads, not in code.
 *
 * Three authors write facts:
 *   - a person (a chat user id, or `github:<login>` for an issue author),
 *   - the orchestrator agent (via the decision actions), stamped {@link ORCHESTRATOR},
 *   - the runtime / a worker (run_worker, tick), stamped {@link RUNTIME} or a worker id.
 *
 * Facts are append-only. A task's state is a fold over its facts.
 */

/** Written by a person. */
export const PERSON_KINDS = ["Created", "Reply", "Completed", "Cancelled"] as const;

/** Written by the orchestrator. Every one of these is a decision. */
export const DECISION_KINDS = ["Dispatched", "Asked", "Reported", "Waited", "Completed", "Cancelled", "Noted", "Lost"] as const;

/** Written by the runtime or a worker: things that happened. */
export const RUNTIME_KINDS = ["Opened", "Returned", "Failed", "Lost", "Event"] as const;

export const FACT_KINDS = [
  "Created", "Reply", "Completed", "Cancelled",
  "Dispatched", "Asked", "Reported", "Waited", "Noted",
  "Opened", "Returned", "Failed", "Lost", "Event",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export const RUNTIME = "runtime";
export const ORCHESTRATOR = "orchestrator";

export function githubPerson(login: string): string {
  return `github:${login}`;
}

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

/** The issue a task was opened from, as the intake poll saw it. */
export interface IssueOrigin {
  url: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  label: string;
}

// ---- person facts -------------------------------------------------------

export type CreatedFact = FactOf<"Created", {
  brief: string;
  projectId?: string;
  project?: ProjectBinding["project"];
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

export type DispatchedFact = FactOf<"Dispatched", {
  workerId: string;
  /** Canonical agent id the worker runs, e.g. `coding:coding`. */
  agent: string;
  /** The orchestrator's own words to the worker. */
  instructions: string;
  /** The full prompt the worker was launched with (instructions + runtime framing). */
  prompt: string;
  /** Why the orchestrator started this worker; shown to people. */
  note?: string;
  /** Worker whose session this one continues, if any. */
  resumeWorkerId?: string;
  resumeSessionId?: string;
  workspace?: WorkerWorkspace;
  projectId?: string;
  project?: ProjectBinding["project"];
}>;
export type AskedFact = FactOf<"Asked", { question: string }>;
export type ReportedFact = FactOf<"Reported", { report: string }>;
export type WaitedFact = FactOf<"Waited", { reason: string; resumeAfter: string }>;
export type NotedFact = FactOf<"Noted", { note: string }>;

// ---- runtime / worker facts ---------------------------------------------

export type OpenedFact = FactOf<"Opened", { workerId: string; romeSessionId: string; sessionType: string }>;
export type ReturnedFact = FactOf<"Returned", {
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
export type FailedFact = FactOf<"Failed", { workerId: string; error: string; sessionId?: string; restarted?: boolean }>;
export type LostFact = FactOf<"Lost", { workerId: string; why: string }>;
/** Something outside the ledger happened. The orchestrator decides what it means. */
export type EventFact = FactOf<"Event", {
  /** Where it came from: `github`, `runtime`, ... */
  source: string;
  /** e.g. `issue_closed`, `circuit_breaker`. */
  type: string;
  /** One line a person or the orchestrator can read. */
  summary: string;
  data?: Record<string, unknown>;
}>;

export type Fact =
  | CreatedFact | ReplyFact | CompletedFact | CancelledFact
  | DispatchedFact | AskedFact | ReportedFact | WaitedFact | NotedFact
  | OpenedFact | ReturnedFact | FailedFact | LostFact | EventFact;

export type NewFact = Omit<Fact, "seq" | "id" | "createdAt">;

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
        return fact.payload.brief;
      case "Reply":
        return fact.payload.text;
      case "Completed":
        return [fact.payload.reason, fact.payload.evidence ? `evidence: ${fact.payload.evidence}` : ""].filter(Boolean).join(" — ");
      case "Cancelled":
        return fact.payload.reason ?? "";
      case "Dispatched": {
        const resume = fact.payload.resumeWorkerId ? ` (continuing ${fact.payload.resumeWorkerId}'s session)` : "";
        const note = fact.payload.note ? `${fact.payload.note}\n` : "";
        const text = opts.full ? fact.payload.instructions : clip(fact.payload.instructions, 600);
        return `${note}worker ${fact.payload.workerId} as ${fact.payload.agent}${resume}\nInstructions:\n${text}`;
      }
      case "Asked":
        return fact.payload.question;
      case "Reported":
        return fact.payload.report;
      case "Waited":
        return `until ${fact.payload.resumeAfter}: ${fact.payload.reason}`;
      case "Noted":
        return fact.payload.note;
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
      case "Event":
        return `${fact.payload.source}/${fact.payload.type}: ${fact.payload.summary}`;
    }
  })();
  const cited = fact.source && fact.by !== RUNTIME && fact.by !== ORCHESTRATOR ? ` [source: ${clip(fact.source, 300)}]` : "";
  return body ? `${head} — ${body}${cited}` : `${head}${cited}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… [${text.length - max} more chars]` : text;
}
