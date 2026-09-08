import { replyText } from "./worker-reply.js";
import type { WorkerWorkspace } from "./worktree.js";
import type { ManagerConfig } from "./config.js";
import { type Fact, type FactKind, describeFact } from "./facts.js";
import { fold, type Position, type TaskState } from "./fold.js";
import { configuredProjects, type ProjectBinding } from "./projects.js";

/**
 * The dashboard's read model. Like everything else in this app it is a fold
 * over the ledger: nothing here is stored, so the UI can never disagree with
 * what reconcile sees. The shapes are JSON-ready (dates as ISO strings) because
 * they cross the API boundary as-is.
 */

export type WorkerStatus = "running" | "returned" | "failed" | "lost";

export interface FactSummary {
  seq: number;
  id: string;
  taskId: string;
  kind: FactKind;
  by: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  /** One-line rendering, the same one the agent and worker briefs see. */
  line: string;
}

export interface WorkerSummary {
  projectId?: string;
  workerId: string;
  taskId: string;
  taskBrief: string;
  status: WorkerStatus;
  startedAt: string;
  endedAt?: string;
  /** Milliseconds from Started to the terminal fact, or to `now` while running. */
  ageMs: number;
  /** Trailing text of the terminal fact: the reply, the error, or the why. */
  outcome?: string;
  startedSeq: number;
  /** Session the worker was told to continue, if it did not start fresh. */
  resumedSessionId?: string;
  /** Isolated checkout recorded before the worker launches. */
  workspace?: WorkerWorkspace;
  /** Set when the resume was rejected and the worker ran in a fresh session instead. */
  restarted?: { rejectedSessionId: string; error: string };
  /** Session the worker ran in, once it has reported back. */
  sessionId?: string;
  /** The worker's Rome session, once summon has reported it. Present while running. */
  romeSession?: { id: string; type: string };
}

export interface TaskSummary {
  projectId?: string;
  project?: ProjectBinding["project"];
  id: string;
  brief: string;
  state: TaskState;
  position?: Position;
  createdAt: string;
  updatedAt: string;
  /** Who opened it, from the Created fact. */
  createdBy: string;
  factCount: number;
  liveWorkerId?: string;
  startsSinceLastPersonFact: number;
  waiting?: { reason: string; resumeAfter: string };
  /** The newest fact, rendered. */
  latest: FactSummary;
  /** Text a person needs to see: the open Question or the newest Report. */
  attention?: { kind: "Question" | "Report"; text: string; evidence?: string };
  workers: WorkerSummary[];
}

export interface DashboardView {
  projects?: string[];
  projectId?: string;
  now: string;
  configured: boolean;
  config?: ManagerConfig;
  lock: { name: string; held: boolean; heldUntil?: string };
  counts: {
    tasks: Record<TaskState, number>;
    positions: Record<Position, number>;
    workers: Record<WorkerStatus, number>;
    facts: number;
  };
  tasks: TaskSummary[];
  workers: WorkerSummary[];
  /** Newest first. */
  ledger: FactSummary[];
}

export interface BuildViewInput {
  projectId?: string;
  now: Date;
  facts: readonly Fact[];
  config?: ManagerConfig;
  lock: { name: string; heldUntil: number } | undefined;
}

export function summarizeFact(fact: Fact): FactSummary {
  return {
    seq: fact.seq,
    id: fact.id,
    taskId: fact.taskId,
    kind: fact.kind,
    by: fact.by,
    source: fact.source,
    payload: fact.payload as Record<string, unknown>,
    createdAt: fact.createdAt.toISOString(),
    line: describeFact(fact),
  };
}

/** Every worker a task has ever started, oldest first. */
export function workersOf(
  taskId: string,
  brief: string,
  facts: readonly Fact[],
  now: Date,
): WorkerSummary[] {
  const workers: WorkerSummary[] = [];
  const created = facts.find((f) => f.kind === "Created");
  const bound = facts.find((f) => f.kind === "Bound");
  const projectId = created?.payload.projectId ?? bound?.payload.projectId;
  for (const fact of facts) {
    if (fact.kind !== "Started") continue;
    const terminal = facts.find(
      (candidate) =>
        candidate.seq > fact.seq &&
        (candidate.kind === "Returned" ||
          candidate.kind === "Failed" ||
          candidate.kind === "Lost") &&
        candidate.payload.workerId === fact.payload.workerId,
    );
    const status: WorkerStatus =
      terminal === undefined
        ? "running"
        : terminal.kind === "Returned"
          ? "returned"
          : terminal.kind === "Failed"
            ? "failed"
            : "lost";
    const outcome =
      terminal === undefined
        ? undefined
        : terminal.kind === "Returned"
          ? terminal.payload.result
            ? replyText(terminal.payload.result)
            : terminal.payload.reply
          : terminal.kind === "Failed"
            ? terminal.payload.error
            : terminal.kind === "Lost"
              ? terminal.payload.why
              : undefined;
    const end = terminal?.createdAt ?? now;
    const restarted = facts.find(
      (candidate) =>
        candidate.seq > fact.seq &&
        candidate.kind === "Restarted" &&
        candidate.payload.workerId === fact.payload.workerId,
    );
    // The newest Opened wins: a restarted worker opens a second session.
    const opened = [...facts]
      .reverse()
      .find(
        (candidate) =>
          candidate.seq > fact.seq &&
          candidate.kind === "Opened" &&
          candidate.payload.workerId === fact.payload.workerId,
      );
    workers.push({
      projectId,
      workerId: fact.payload.workerId,
      taskId,
      taskBrief: brief,
      status,
      startedAt: fact.createdAt.toISOString(),
      endedAt: terminal?.createdAt.toISOString(),
      ageMs: Math.max(0, end.getTime() - fact.createdAt.getTime()),
      outcome,
      startedSeq: fact.seq,
      resumedSessionId: fact.payload.resumeSessionId,
      workspace: fact.payload.workspace,
      romeSession:
        opened?.kind === "Opened"
          ? { id: opened.payload.romeSessionId, type: opened.payload.sessionType }
          : undefined,
      restarted:
        restarted?.kind === "Restarted"
          ? { rejectedSessionId: restarted.payload.rejectedSessionId, error: restarted.payload.error }
          : undefined,
      sessionId:
        terminal && (terminal.kind === "Returned" || terminal.kind === "Failed")
          ? terminal.payload.sessionId
          : undefined,
    });
  }
  return workers;
}

export function buildView(input: BuildViewInput): DashboardView {
  const { now, config, lock } = input;
  const allTasks = fold(now, input.facts).tasks;
  const projects = [...new Set([
    ...Object.keys(config ? configuredProjects(config) : {}),
    ...allTasks.flatMap((task) => task.projectId ? [task.projectId] : []),
  ])].sort();
  const wanted = new Set(allTasks.filter((task) => task.projectId === input.projectId).map((task) => task.id));
  const facts = input.projectId ? input.facts.filter((fact) => wanted.has(fact.taskId)) : input.facts;
  const snapshot = fold(now, facts);

  const tasks: TaskSummary[] = snapshot.tasks.map((task) => {
    const created = task.facts[0];
    const workers = workersOf(task.id, task.brief, task.facts, now);

    // The person's attention is owed to whatever the runtime last said and a
    // person has not yet answered: a Question or a Report newer than the
    // newest person fact.
    let attention: TaskSummary["attention"];
    if (task.state === "taken" && (task.position === "stuck" || task.position === "reported")) {
      for (let i = task.facts.length - 1; i >= 0; i -= 1) {
        const fact = task.facts[i];
        if (fact.seq <= task.lastPersonFactSeq) break;
        if (fact.kind === "Question") {
          attention = { kind: "Question", text: fact.payload.why };
          break;
        }
        if (fact.kind === "Report") {
          attention = {
            kind: "Report",
            text: fact.payload.what,
            evidence: fact.payload.evidence,
          };
          break;
        }
      }
    }

    return {
      id: task.id,
      projectId: task.projectId,
      project: task.project,
      brief: task.brief,
      state: task.state,
      position: task.position,
      waiting: task.waiting,
      createdAt: created.createdAt.toISOString(),
      updatedAt: task.latest.createdAt.toISOString(),
      createdBy: created.by,
      factCount: task.facts.length,
      liveWorkerId: task.liveWorker?.workerId,
      startsSinceLastPersonFact: task.startsSinceLastPersonFact,
      latest: summarizeFact(task.latest),
      attention,
      workers,
    };
  });

  const workers = tasks
    .flatMap((task) => task.workers)
    .sort((a, b) => b.startedSeq - a.startedSeq);

  const counts: DashboardView["counts"] = {
    tasks: { created: 0, taken: 0, completed: 0, cancelled: 0 },
    positions: { working: 0, waiting: 0, stuck: 0, reported: 0 },
    workers: { running: 0, returned: 0, failed: 0, lost: 0 },
    facts: facts.length,
  };
  for (const task of tasks) {
    counts.tasks[task.state] += 1;
    if (task.position) counts.positions[task.position] += 1;
  }
  for (const worker of workers) counts.workers[worker.status] += 1;

  const ledger = [...facts]
    .sort((a, b) => b.seq - a.seq)
    .map(summarizeFact);

  const held = lock !== undefined && lock.heldUntil > now.getTime();

  return {
    projects,
    projectId: input.projectId,
    now: now.toISOString(),
    configured: config !== undefined,
    config,
    lock: {
      name: lock?.name ?? "reconcile",
      held,
      heldUntil: held ? new Date(lock.heldUntil).toISOString() : undefined,
    },
    counts,
    tasks,
    workers,
    ledger,
  };
}
