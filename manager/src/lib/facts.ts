import { replyText, type ReplyRepair, type WorkerReply } from "./worker-reply.js";
import type { WorkerWorkspace } from "./worktree.js";
import type { ProjectBinding } from "./projects.js";

/**
 * The ledger's vocabulary. Every fact kind is named by one rule: a participle
 * is something that happened, a noun is something somebody said.
 *
 * Facts are append-only. Nothing in this app updates or deletes one, so a
 * task's state and position are always a fold over its facts rather than a
 * column somebody has to keep true.
 */

/**
 * Task state facts. A task ends on a person's word, or when the GitHub issue
 * the person named in the brief is closed — never on the runtime's own reading
 * of a worker's result.
 */
export const TASK_STATE_KINDS = ["Created", "Taken", "Completed", "Cancelled"] as const;

/** Execution facts. A worker writes three of them; the runtime writes the rest. */
export const EXECUTION_KINDS = ["Started", "Opened", "Restarted", "Returned", "Failed", "Lost", "Deferred"] as const;

/** Dialogue facts. The runtime asks and reports; a person replies. */
export const DIALOGUE_KINDS = ["Question", "Report", "Reply"] as const;

export const FACT_KINDS = [...TASK_STATE_KINDS, ...EXECUTION_KINDS, ...DIALOGUE_KINDS, "Bound"] as const;

export type FactKind = (typeof FACT_KINDS)[number];

/** The `by` this app stamps on every fact the runtime writes itself. */
export const RUNTIME = "runtime";

/**
 * The `by` on a Completed or Cancelled the runtime transcribed from GitHub:
 * the issue the person named in the brief was closed. The runtime decides
 * nothing here — it copies down what GitHub reported (closed as completed, or
 * closed as not planned), and cites the issue as `source`.
 */
export const GITHUB = "github";

/**
 * The `by` on a Created the runtime transcribed from a GitHub issue: the
 * person who opened the issue, as `github:<login>`. Distinct from
 * {@link GITHUB}, which names GitHub itself reporting a close; an issue is a
 * person's ask, so its author is the fact's author, the same as a chat
 * message is its sender's. The `github:` prefix keeps a GitHub login from
 * colliding with a channel user id of the same spelling.
 */
export function githubPerson(login: string): string {
  return `github:${login}`;
}

/**
 * Kinds a person writes. `reconcile` has no path to any of them; the one other
 * writer of a Completed or Cancelled is the issue poll, which stamps
 * {@link GITHUB} and only ever transcribes a closed issue. That keeps "the
 * runtime never ends a task on its own judgement" mechanical rather than a
 * promise.
 */
export const PERSON_KINDS: readonly FactKind[] = ["Created", "Completed", "Cancelled", "Reply"];

/** Kinds the runtime writes. The position of a task is read off the last one. */
export const RUNTIME_KINDS: readonly FactKind[] = [
  "Taken",
  "Started",
  "Lost",
  "Question",
  "Report",
  "Deferred",
];

/** Kinds that end a worker's run. A Started with none of these after it is live. */
export const WORKER_TERMINAL_KINDS: readonly FactKind[] = ["Returned", "Failed", "Lost"];

export function isPersonKind(kind: FactKind): boolean {
  return PERSON_KINDS.includes(kind);
}

export function isRuntimeKind(kind: FactKind): boolean {
  return RUNTIME_KINDS.includes(kind);
}

export function isWorkerTerminalKind(kind: FactKind): boolean {
  return WORKER_TERMINAL_KINDS.includes(kind);
}

/** Fields every fact carries, whoever wrote it. */
export interface FactHeader {
  /** The ledger's total order. Assigned by the database, never by app code. */
  seq: number;
  id: string;
  taskId: string;
  /** Who wrote it: a person's id, a worker id, or {@link RUNTIME}. */
  by: string;
  /**
   * A person's own words or the action they took, verbatim. Set on every fact
   * a person writes; the runtime and workers cite their call site instead.
   */
  source?: string;
  createdAt: Date;
}

type FactOf<K extends FactKind, P> = FactHeader & { kind: K; payload: P };

export type CreatedFact = FactOf<
  "Created",
  {
    brief: string;
    projectId?: string;
    project?: ProjectBinding["project"];
    /** Set when the task was taken in from a GitHub issue rather than a chat. */
    issue?: IssueOrigin;
  }
>;

/** The issue a task was opened from, as the intake poll saw it. */
export interface IssueOrigin {
  /** Canonical `https://github.com/owner/repo/issues/N`. */
  url: string;
  repo: string;
  number: number;
  title: string;
  /** GitHub login of whoever opened the issue. */
  author: string;
  /** The label that made it a task. */
  label: string;
}
export type TakenFact = FactOf<"Taken", Record<string, never>>;
/** Legacy migration metadata. Does not change scheduling, position or retry budgets. */
export type BoundFact = FactOf<"Bound", ProjectBinding>;
export type CompletedFact = FactOf<
  "Completed",
  {
    reason?: string;
    /** Set when {@link GITHUB} wrote it: the closed issues that ended the task. */
    issues?: ClosedIssue[];
  }
>;

/** One closed issue, as the poll saw it. */
export interface ClosedIssue {
  url: string;
  /** GitHub's `closed_at`, ISO-8601. */
  closedAt: string;
  /** GitHub's `state_reason`: `completed`, `not_planned`, … */
  stateReason?: string;
}
export type CancelledFact = FactOf<
  "Cancelled",
  {
    reason?: string;
    /** Set when {@link GITHUB} wrote it: the issues closed as not planned. */
    issues?: ClosedIssue[];
  }
>;
export type StartedFact = FactOf<
  "Started",
  {
    workerId: string;
    prompt: string;
    projectId?: string;
    project?: ProjectBinding["project"];
    /** Session this worker continues. Absent means it starts fresh. */
    resumeSessionId?: string;
    /** Absent on historical starts whose workers were taught the old prose protocol. */
    replyProtocol?: 1;
    /** Isolated checkout prepared before launch; absent on legacy facts. */
    workspace?: WorkerWorkspace;
  }
>;
/**
 * The worker's Rome session exists. Written by run_worker the moment summon
 * reports it, so a live worker can be opened while it runs rather than after.
 * Sits between a Started and that worker's outcome; it ends nothing and moves
 * nothing — a pointer, not a state.
 */
export type OpenedFact = FactOf<
  "Opened",
  { workerId: string; romeSessionId: string; sessionType: string }
>;
/**
 * A worker was told to resume a session and the runner refused. The worker
 * started a fresh session with `prompt` instead — a full brief, since the new
 * session holds none of the history the delta on its Started assumed. Written
 * between a Started and that worker's outcome; it ends nothing.
 */
export type RestartedFact = FactOf<
  "Restarted",
  { workerId: string; rejectedSessionId: string; error: string; prompt: string }
>;
export type ReturnedFact = FactOf<
  "Returned",
  {
    workerId: string;
    reply: string;
    /** Validated v1 result. Absent only for pre-protocol workers. */
    result?: WorkerReply;
    repair?: ReplyRepair;
    /** Session the worker ran in, as summon reported it. */
    sessionId?: string;
  }
>;
export type FailedFact = FactOf<
  "Failed",
  {
    workerId: string;
    error: string;
    failureKind?: "reply_protocol";
    reply?: string;
    repair?: ReplyRepair;
    /** Session the worker ran in; absent if it failed before one existed. */
    sessionId?: string;
  }
>;
export type LostFact = FactOf<"Lost", { workerId: string; why: string }>;
/** Runtime took responsibility for revisiting unfinished work. This is not a live worker. */
export type DeferredFact = FactOf<
  "Deferred",
  { workerId: string; reason: string; resumeAfter: string }
>;
export type QuestionFact = FactOf<"Question", { why: string }>;
export type ReportFact = FactOf<"Report", { what: string; evidence: string }>;
export type ReplyFact = FactOf<"Reply", { text: string }>;

export type Fact =
  | CreatedFact
  | BoundFact
  | TakenFact
  | CompletedFact
  | CancelledFact
  | StartedFact
  | OpenedFact
  | RestartedFact
  | ReturnedFact
  | FailedFact
  | LostFact
  | DeferredFact
  | QuestionFact
  | ReportFact
  | ReplyFact;

/** A fact before the ledger gives it a place in the order. */
export type NewFact = Omit<Fact, "seq" | "id" | "createdAt">;

/** The worker id carried by an execution fact, or undefined for the rest. */
export function workerIdOf(fact: Fact): string | undefined {
  switch (fact.kind) {
    case "Started":
    case "Opened":
    case "Restarted":
    case "Returned":
    case "Failed":
    case "Lost":
      return fact.payload.workerId;
    default:
      return undefined;
  }
}

/** One line of a task's history, for a worker brief or a chat summary. */
export function describeFact(fact: Fact): string {
  const stamp = fact.createdAt.toISOString();
  const head = `${stamp} ${fact.kind} by ${fact.by}`;
  const body = (() => {
    switch (fact.kind) {
      case "Created":
        return fact.payload.brief;
      case "Taken":
        return "";
      case "Bound":
        return `project ${fact.payload.projectId}: ${fact.payload.project.workingDir}`;
      case "Completed":
      case "Cancelled":
        return fact.payload.reason ?? "";
      case "Started": {
        const session = fact.payload.resumeSessionId ? `, resuming session ${fact.payload.resumeSessionId}` : "";
        const workspace = fact.payload.workspace ? ` in ${fact.payload.workspace.workingDir}` : "";
        return `worker ${fact.payload.workerId}${session}${workspace}`;
      }
      case "Opened":
        return `worker ${fact.payload.workerId} runs in session ${fact.payload.romeSessionId}`;
      case "Restarted":
        return `worker ${fact.payload.workerId}: resume of session ${fact.payload.rejectedSessionId} rejected (${fact.payload.error}); started a fresh session`;
      case "Returned":
        return `worker ${fact.payload.workerId}: ${fact.payload.result ? `${fact.payload.result.outcome}: ${replyText(fact.payload.result)}` : fact.payload.reply}`;
      case "Failed":
        return `worker ${fact.payload.workerId}: ${fact.payload.error}`;
      case "Lost":
        return `worker ${fact.payload.workerId}: ${fact.payload.why}`;
      case "Deferred":
        return `revisit after ${fact.payload.resumeAfter}: ${fact.payload.reason}`;
      case "Question":
        return fact.payload.why;
      case "Report":
        return `${fact.payload.what} (evidence: ${fact.payload.evidence})`;
      case "Reply":
        return fact.payload.text;
    }
  })();
  const cited = fact.source ? ` [source: ${fact.source}]` : "";
  return body ? `${head} — ${body}${cited}` : `${head}${cited}`;
}
