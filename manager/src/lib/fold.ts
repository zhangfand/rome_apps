import {
  type Fact,
  type FactKind,
  isPersonKind,
  isRuntimeKind,
  isWorkerTerminalKind,
} from "./facts.js";

/**
 * Folding the ledger. Everything this module returns is derived from the facts
 * on a task and nothing else — no state column, no cached counter. A wake that
 * reads the same facts computes the same view, which is what lets the runtime
 * crash between any two writes and pick up exactly where it left off.
 */

/** The four states, which are about ownership. */
export type TaskState = "created" | "taken" | "completed" | "cancelled";

/** Where a Taken task sits between wakes, named by what the runtime waits for. */
export type Position = "working" | "waiting" | "stuck" | "reported";

/** A worker with a Started and no terminal fact after it. */
export interface WorkerRef {
  workerId: string;
  startedAt: Date;
  startedSeq: number;
}

/** A session a follow-up worker may continue, and the worker that left it. */
export interface ResumableSession {
  workerId: string;
  sessionId: string;
}

export interface TaskView {
  id: string;
  projectId?: string;
  project?: import("./projects.js").ProjectBinding["project"];
  /** What the person asked for, from the Created fact. */
  brief: string;
  state: TaskState;
  /** Set only inside Taken, and only once the runtime has written past Taken. */
  position?: Position;
  /** The newest fact on the task. Reconcile keys most of its decisions on this. */
  latest: Fact;
  /** Every fact on the task, oldest first. */
  facts: readonly Fact[];
  liveWorker?: WorkerRef;
  /**
   * The newest session on the task that ended cleanly enough to resume: left
   * by a Returned or Failed worker, and not since rejected by a Restarted or
   * superseded by a Lost. Lost clears it because a "stopped" worker may still
   * be running in that session; resuming it would race. Absent means the next
   * worker starts fresh.
   */
  resumableSession?: ResumableSession;
  /** Order of the newest fact a person wrote, for attention and total start counts. */
  lastPersonFactSeq: number;
  /** Started facts newer than {@link lastPersonFactSeq}, including normal waiting cycles. */
  startsSinceLastPersonFact: number;
  /** Retry budget counts starts since the last person fact or successful deferral. */
  startsSinceLastProgress: number;
  waiting?: { reason: string; resumeAfter: string };
}

export interface LedgerSnapshot {
  now: Date;
  tasks: readonly TaskView[];
}

/** Thrown when a task's facts cannot describe a task — no Created to open it. */
export class MalformedTaskError extends Error {}

const POSITION_BY_KIND: Partial<Record<FactKind, Position>> = {
  Started: "working",
  Deferred: "waiting",
  Question: "stuck",
  Report: "reported",
};

/**
 * Fold one task's facts into the view reconcile reads. `facts` may arrive in
 * any order; the ledger's `seq` is the authority, so they are sorted here.
 */
export function foldTask(facts: readonly Fact[]): TaskView {
  const ordered = [...facts].sort((a, b) => a.seq - b.seq);
  const created = ordered.find((fact) => fact.kind === "Created");
  if (!created) {
    throw new MalformedTaskError(`task ${ordered[0]?.taskId ?? "(unknown)"} has no Created fact`);
  }

  let state: TaskState = "created";
  let position: Position | undefined;
  let liveWorker: WorkerRef | undefined;
  let resumableSession: ResumableSession | undefined;
  let lastPersonFactSeq = created.seq;
  let lastProgressSeq = created.seq;
  let waiting: TaskView["waiting"];

  for (const fact of ordered) {
    switch (fact.kind) {
      case "Taken":
        if (state === "created") state = "taken";
        break;
      case "Completed":
        state = "completed";
        break;
      case "Cancelled":
        state = "cancelled";
        break;
      case "Started":
        liveWorker = {
          workerId: fact.payload.workerId,
          startedAt: fact.createdAt,
          startedSeq: fact.seq,
        };
        break;
      case "Deferred":
        lastProgressSeq = fact.seq;
        waiting = { reason: fact.payload.reason, resumeAfter: fact.payload.resumeAfter };
        break;
      case "Restarted":
        // The runner refused this session; nobody should ask for it again.
        if (resumableSession?.sessionId === fact.payload.rejectedSessionId) {
          resumableSession = undefined;
        }
        break;
      case "Returned":
      case "Failed":
        if (fact.payload.sessionId) {
          resumableSession = { workerId: fact.payload.workerId, sessionId: fact.payload.sessionId };
        }
        break;
      case "Lost":
        resumableSession = undefined;
        break;
      default:
        break;
    }

    if (isWorkerTerminalKind(fact.kind) && liveWorker) {
      // A terminal fact only closes the worker it names, so a stale outcome
      // arriving after a replacement started does not clear the live one.
      const named = (fact.payload as { workerId?: string }).workerId;
      if (named === liveWorker.workerId) liveWorker = undefined;
    }

    if (isRuntimeKind(fact.kind)) {
      position = POSITION_BY_KIND[fact.kind];
    }

    if (isPersonKind(fact.kind)) {
      lastPersonFactSeq = fact.seq;
      lastProgressSeq = fact.seq;
    }
  }

  const startsSinceLastPersonFact = ordered.filter(
    (fact) => fact.kind === "Started" && fact.seq > lastPersonFactSeq,
  ).length;

  return {
    id: created.taskId,
    projectId: created.payload.projectId ?? ordered.find((f) => f.kind === "Bound")?.payload.projectId,
    project: created.payload.project ?? ordered.find((f) => f.kind === "Bound")?.payload.project,
    brief: created.payload.brief,
    state,
    position: state === "taken" ? position : undefined,
    latest: ordered.filter((f) => f.kind !== "Bound").at(-1)!,
    facts: ordered,
    liveWorker,
    resumableSession,
    lastPersonFactSeq,
    startsSinceLastPersonFact,
    startsSinceLastProgress: ordered.filter((fact) => fact.kind === "Started" && fact.seq > lastProgressSeq).length,
    waiting: state === "taken" && position === "waiting" ? waiting : undefined,
  };
}

/**
 * Fold the whole ledger. Tasks come back in the order they were created, so a
 * concurrency cap spends its budget on the oldest work first.
 */
export function fold(now: Date, facts: readonly Fact[]): LedgerSnapshot {
  const byTask = new Map<string, Fact[]>();
  for (const fact of facts) {
    const bucket = byTask.get(fact.taskId);
    if (bucket) bucket.push(fact);
    else byTask.set(fact.taskId, [fact]);
  }

  const tasks = [...byTask.values()]
    .map((bucket) => foldTask(bucket))
    .sort((a, b) => a.facts[0].seq - b.facts[0].seq);

  return { now, tasks };
}

/** Whether a task is finished. Reconcile only ever stops a worker on these. */
export function isTerminal(state: TaskState): boolean {
  return state === "completed" || state === "cancelled";
}

/** How long a worker has been running, in milliseconds. */
export function workerAgeMs(worker: WorkerRef, now: Date): number {
  return now.getTime() - worker.startedAt.getTime();
}
