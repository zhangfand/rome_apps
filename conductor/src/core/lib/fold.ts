import {
  type DispatchedFact,
  type Fact,
  type JobCreatedFact,
  type WaitedFact,
  COORDINATOR_KINDS,
  DECISION_KINDS,
  isTerminalKind,
  isWorkerTerminalKind,
  ORCHESTRATOR,
  PERSON_KINDS,
} from "./facts.js";

/**
 * Folding the ledger. This is the *whole* of what code knows about a task:
 * whether it is open, whether a worker is live, and whether the orchestrator
 * has seen everything. There is no position, no phase and no retry budget —
 * what happens next is the orchestrator's call, made from the same facts.
 */

export type TaskState = "open" | "completed" | "cancelled";

export interface WorkerRef {
  /** The Job this concrete worker run materializes; absent on legacy runs. */
  jobId?: string;
  workerId: string;
  agent: string;
  startedAt: Date;
  startedSeq: number;
  /** Durable Rome session, once the worker has actually opened one. */
  romeSession?: { id: string; type: string };
}

export interface JobRef {
  jobId: string;
  agent: string;
  instructions: string;
  contracts?: string[];
  note?: string;
  createdAt: Date;
  createdSeq: number;
}

export interface TaskView {
  id: string;
  projectId?: string;
  project?: import("./projects.js").ProjectBinding["project"];
  /** Lead-owned delivery Task and plan item that materialized this outcome. */
  parent?: import("./facts.js").TaskParent;
  /** Historical checkpoint and prompt variant that seeded this fresh Task. */
  replay?: import("./facts.js").TaskReplay;
  brief: string;
  createdBy: string;
  state: TaskState;
  /** Newest fact on the task. */
  latest: Fact;
  facts: readonly Fact[];
  /** A Dispatched with no Returned/Failed/Lost for that worker after it. */
  liveWorker?: WorkerRef;
  /** A JobCreated that is still the newest fact and has not been dispatched. */
  pendingJob?: JobRef;
  /** Seq of the newest orchestrator decision; 0 if none yet. */
  lastDecisionSeq: number;
  /** The newest orchestrator-authored decision fact, if any. */
  lastDecision?: Fact;
  /**
   * Seq of the newest orchestrator decision or acknowledgement. ACK advances
   * this cursor without replacing the Task's workflow decision.
   */
  lastProcessedSeq: number;
  /** Seq of the newest fact a person wrote. */
  lastPersonFactSeq: number;
  /** Orchestrator decisions since a person last spoke. */
  decisionsSinceLastPersonFact: number;
  /** Set when the last decision was Waited. */
  waiting?: { reason: string; resumeAfter: string };
  /** Facts newer than the last decision, oldest first (dispatch/session progress excluded). */
  unseen: readonly Fact[];
}

export interface LedgerSnapshot {
  now: Date;
  tasks: readonly TaskView[];
}

export class MalformedTaskError extends Error {}

/** A person's fact: one of the person kinds, not written by the orchestrator. */
export function isPersonFact(fact: Fact): boolean {
  return (PERSON_KINDS as readonly string[]).includes(fact.kind) && fact.by !== ORCHESTRATOR;
}

export function foldTask(facts: readonly Fact[]): TaskView {
  const ordered = [...facts].sort((a, b) => a.seq - b.seq);
  const created = ordered.find((fact) => fact.kind === "Created");
  if (!created || created.kind !== "Created") {
    throw new MalformedTaskError(`task ${ordered[0]?.taskId ?? "(unknown)"} has no Created fact`);
  }

  let state: TaskState = "open";
  let liveWorker: WorkerRef | undefined;
  let lastDecisionSeq = 0;
  let lastDecision: Fact | undefined;
  let lastProcessedSeq = 0;
  let lastPersonFactSeq = created.seq;
  let decisionsSinceLastPersonFact = 0;

  for (const fact of ordered) {
    if (fact.kind === "Completed") state = "completed";
    else if (fact.kind === "Cancelled") state = "cancelled";

    if (fact.kind === "Dispatched") {
      liveWorker = {
        ...(fact.payload.jobId ? { jobId: fact.payload.jobId } : {}),
        workerId: fact.payload.workerId,
        agent: fact.payload.agent,
        startedAt: fact.createdAt,
        startedSeq: fact.seq,
      };
    } else if (fact.kind === "Opened" && liveWorker?.workerId === fact.payload.workerId) {
      // A rejected resume can open a second session for the same worker. The
      // newest Opened fact is the session the worker is currently using.
      liveWorker = {
        ...liveWorker,
        romeSession: { id: fact.payload.romeSessionId, type: fact.payload.sessionType },
      };
    } else if (isWorkerTerminalKind(fact.kind) && liveWorker) {
      const named = (fact.payload as { workerId?: string }).workerId;
      if (named === liveWorker.workerId) liveWorker = undefined;
    }

    if (fact.by === ORCHESTRATOR && COORDINATOR_KINDS.some((kind) => kind === fact.kind)) {
      lastProcessedSeq = fact.seq;
      if (DECISION_KINDS.some((kind) => kind === fact.kind)) {
        lastDecisionSeq = fact.seq;
        lastDecision = fact;
        decisionsSinceLastPersonFact += 1;
      }
    } else if (isPersonFact(fact)) {
      lastPersonFactSeq = fact.seq;
      decisionsSinceLastPersonFact = 0;
    }
  }

  // Dispatch and session-open are runtime progress for a Job the coordinator
  // already decided on. Only its outcome (Returned/Failed/Lost) is new input
  // for the next coordination decision.
  const unseen = ordered.filter((f) =>
    f.seq > lastProcessedSeq && f.kind !== "Dispatched" && f.kind !== "Opened" && f.kind !== "Snapshot",
  );
  // A Snapshot is transparent to operational state: appending one must not
  // hide a Job that is still waiting for runtime dispatch.
  const pendingJob = jobRef([...ordered].reverse().find((fact) =>
    fact.kind !== "Snapshot" && fact.kind !== "ACK" && fact.kind !== "Noted",
  ));
  // A person's reply supersedes a prior wait immediately, before the
  // orchestrator has had time to record its next decision. Keeping the old
  // wait here makes the UI claim that the task is still sleeping after the
  // person has answered it.
  const waiting = decisionsSinceLastPersonFact > 0 && lastDecision?.kind === "Waited"
    ? { reason: (lastDecision as WaitedFact).payload.reason, resumeAfter: (lastDecision as WaitedFact).payload.resumeAfter }
    : undefined;

  return {
    id: created.taskId,
    projectId: created.payload.projectId,
    project: created.payload.project,
    parent: created.payload.parent,
    replay: created.payload.replay,
    brief: created.payload.brief,
    createdBy: created.by,
    state,
    latest: ordered.at(-1)!,
    facts: ordered,
    liveWorker: state === "open" ? liveWorker : undefined,
    pendingJob: state === "open" ? pendingJob : undefined,
    lastDecisionSeq,
    lastDecision,
    lastProcessedSeq,
    lastPersonFactSeq,
    decisionsSinceLastPersonFact,
    waiting: state === "open" ? waiting : undefined,
    unseen,
  };
}

function jobRef(fact: Fact | undefined): JobRef | undefined {
  if (fact?.kind !== "JobCreated") return undefined;
  const job = fact as JobCreatedFact;
  return {
    jobId: job.payload.jobId,
    agent: job.payload.agent,
    instructions: job.payload.instructions,
    ...(job.payload.contracts?.length ? { contracts: job.payload.contracts } : {}),
    ...(job.payload.note ? { note: job.payload.note } : {}),
    createdAt: job.createdAt,
    createdSeq: job.seq,
  };
}

export function fold(now: Date, facts: readonly Fact[]): LedgerSnapshot {
  const byTask = new Map<string, Fact[]>();
  for (const fact of facts) {
    const bucket = byTask.get(fact.taskId);
    if (bucket) bucket.push(fact);
    else byTask.set(fact.taskId, [fact]);
  }
  const tasks = [...byTask.values()].map((bucket) => foldTask(bucket)).sort((a, b) => a.facts[0].seq - b.facts[0].seq);
  return { now, tasks };
}

export function isTerminal(state: TaskState): boolean {
  return state !== "open";
}

/**
 * Whether the orchestrator should be woken for this task: something happened
 * it has not decided on, or the time it asked to be revisited has come.
 * This is the only "rule" the runtime has, and it is about freshness, not
 * about what to do.
 */
export function needsAttention(task: TaskView, now: Date): { wake: true; why: string } | { wake: false } {
  if (task.state !== "open") return { wake: false };
  if (task.unseen.length > 0) {
    return { wake: true, why: `new facts since processed position #${task.lastProcessedSeq}: ${task.unseen.map((f) => `${f.kind}#${f.seq}`).join(", ")}` };
  }
  if (task.waiting && now.getTime() >= Date.parse(task.waiting.resumeAfter)) {
    return { wake: true, why: `revisit time ${task.waiting.resumeAfter} has come: ${task.waiting.reason}` };
  }
  return { wake: false };
}

/** The Dispatched fact for a worker, if any. */
export function dispatchFor(task: TaskView, workerId: string): DispatchedFact | undefined {
  return task.facts.find((f): f is DispatchedFact => f.kind === "Dispatched" && f.payload.workerId === workerId);
}

/** Session id a worker left behind, if it ended cleanly. Lost clears it: the worker may still be running there. */
export function sessionLeftBy(task: TaskView, workerId: string): string | undefined {
  const dispatch = dispatchFor(task, workerId);
  if (!dispatch) return undefined;
  const end = task.facts.find((f) => f.seq > dispatch.seq && isWorkerTerminalKind(f.kind) && (f.payload as { workerId?: string }).workerId === workerId);
  if (!end || end.kind === "Lost") return undefined;
  return (end.payload as { sessionId?: string }).sessionId;
}

/** Facts written by a person on this task, newest last. */
export function isTerminalFact(fact: Fact): boolean {
  return isTerminalKind(fact.kind);
}
