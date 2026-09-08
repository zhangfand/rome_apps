import type { ManagerConfig } from "./config.js";
import { describeFact } from "./facts.js";
import type { TaskView } from "./fold.js";
import { BLOCKED_PREFIX } from "./judge.js";

/**
 * The brief a worker is launched with. A fresh worker gets the task's whole
 * history, because it reads nothing else: a retry learns what failed, and a
 * steered worker learns what the person said, from the same lines. A worker
 * that resumes an earlier worker's session already holds that history, so it
 * gets only the delta — the facts since the resumed worker started, and why —
 * because repeating the rest would undo the cache the resume is for. The brief
 * is stored on the Started fact, so the ledger records the exact words a
 * worker was given.
 */
export function buildWorkerPrompt(input: {
  task: TaskView;
  config: ManagerConfig;
  /** What made the runtime start this worker, when it is not the first one. */
  reason?: string;
  /** The session this worker continues, when it does not start fresh. */
  resume?: { workerId: string; sessionId: string };
}): string {
  const { task, config, reason, resume } = input;

  const lines = resume ? resumedHeader(task, resume) : freshHeader(task, config);

  if (reason) {
    lines.push("", `Why you were started: ${reason}`);
  }

  lines.push(
    "",
    "When you finish, end your turn with a short summary of what you did and",
    "where the result is — a branch, a pull request, a path. That summary is",
    "recorded as the task's Returned fact and is what gets judged.",
    "",
    `If you cannot finish, say so on a line starting with "${BLOCKED_PREFIX}"`,
    "followed by what is in the way. A blocked reply is not a failure; it is how",
    "you hand the question back to a person.",
    "",
    "Do not wait for anything, do not poll, and do not ask a question you cannot",
    "get an answer to inside this turn.",
  );

  return lines.join("\n");
}

function freshHeader(task: TaskView, config: ManagerConfig): string[] {
  return [
    `You are working on task ${task.id}.`,
    "",
    `Working directory: ${config.workingDir}`,
    "Start by moving there; every path below is relative to it.",
    "",
    "What was asked for:",
    task.brief,
    "",
    "The task's history, oldest first. This is everything anyone recorded about",
    "it, including earlier attempts and what the person said:",
    ...task.facts.map((fact) => `  ${describeFact(fact)}`),
  ];
}

function resumedHeader(task: TaskView, resume: { workerId: string; sessionId: string }): string[] {
  const startedSeq = task.facts.find(
    (fact) => fact.kind === "Started" && fact.payload.workerId === resume.workerId,
  )?.seq;
  const since = startedSeq === undefined ? [] : task.facts.filter((fact) => fact.seq > startedSeq);
  return [
    `You are continuing task ${task.id} in the session you already have — you were`,
    `worker ${resume.workerId} in it. Everything you learned and did there still holds.`,
    "",
    "What was recorded since you started that run, oldest first:",
    ...since.map((fact) => `  ${describeFact(fact)}`),
  ];
}
