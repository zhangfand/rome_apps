import {
  type DispatchedFact,
  type Fact,
  type WaitedFact,
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
  workerId: string;
  agent: string;
  startedAt: Date;
  startedSeq: number;
}

export interface TaskView {
  id: string;
  projectId?: string;
  project?: import("./projects.js").ProjectBinding["project"];
  brief: string;
  createdBy: string;
  state: TaskState;
  /** Newest fact on the task. */
  latest: Fact;
  facts: readonly Fact[];
  /** A Dispatched with no Returned/Failed/Lost for that worker after it. */
  liveWorker?: WorkerRef;
  /** Seq of the newest fact the orchestrator wrote; 0 if none yet. */
  lastDecisionSeq: number;
  /** The newest orchestrator fact, if any. */
  lastDecision?: Fact;
  /** Seq of the newest fact a person wrote. */
  lastPersonFactSeq: number;
  /** Orchestrator decisions since a person last spoke. */
  decisionsSinceLastPersonFact: number;
  /** Set when the last decision was Waited. */
  waiting?: { reason: string; resumeAfter: string };
  /** Facts newer than the last decision, oldest first (Opened excluded — it is a pointer, not news). */
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
  let lastPersonFactSeq = created.seq;
  let decisionsSinceLastPersonFact = 0;

  for (const fact of ordered) {
    if (fact.kind === "Completed") state = "completed";
    else if (fact.kind === "Cancelled") state = "cancelled";

    if (fact.kind === "Dispatched") {
      liveWorker = { workerId: fact.payload.workerId, agent: fact.payload.agent, startedAt: fact.createdAt, startedSeq: fact.seq };
    } else if (isWorkerTerminalKind(fact.kind) && liveWorker) {
      const named = (fact.payload as { workerId?: string }).workerId;
      if (named === liveWorker.workerId) liveWorker = undefined;
    }

    if (fact.by === ORCHESTRATOR) {
      lastDecisionSeq = fact.seq;
      lastDecision = fact;
      decisionsSinceLastPersonFact += 1;
    } else if (isPersonFact(fact)) {
      lastPersonFactSeq = fact.seq;
      decisionsSinceLastPersonFact = 0;
    }
  }

  const unseen = ordered.filter((f) => f.seq > lastDecisionSeq && f.kind !== "Opened");
  const waiting = lastDecision?.kind === "Waited"
    ? { reason: (lastDecision as WaitedFact).payload.reason, resumeAfter: (lastDecision as WaitedFact).payload.resumeAfter }
    : undefined;

  return {
    id: created.taskId,
    projectId: created.payload.projectId,
    project: created.payload.project,
    brief: created.payload.brief,
    createdBy: created.by,
    state,
    latest: ordered.at(-1)!,
    facts: ordered,
    liveWorker,
    lastDecisionSeq,
    lastDecision,
    lastPersonFactSeq,
    decisionsSinceLastPersonFact,
    waiting: state === "open" ? waiting : undefined,
    unseen,
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
    return { wake: true, why: `new facts since decision #${task.lastDecisionSeq}: ${task.unseen.map((f) => `${f.kind}#${f.seq}`).join(", ")}` };
  }
  if (task.lastDecision?.kind === "Lost") {
    return { wake: true, why: `you stopped worker ${task.lastDecision.payload.workerId} (#${task.lastDecision.seq}) and have not decided what happens next` };
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
