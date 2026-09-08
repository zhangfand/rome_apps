import type { ManagerConfig } from "./config.js";
import { type NewFact, RUNTIME } from "./facts.js";
import { isTerminal, type LedgerSnapshot, type TaskView, workerAgeMs } from "./fold.js";
import type { Judge } from "./judge.js";
import { REPLY_PROTOCOL } from "./worker-reply.js";
import { buildWorkerPrompt } from "./prompt.js";

/**
 * The runtime's whole decision, as a pure function of a ledger snapshot.
 *
 * It returns a list of things to do rather than doing them, which is what makes
 * every rule here testable without a database and what lets the caller stop
 * after any single item: each one leaves the ledger consistent on its own.
 */

export type ReconcileAction =
  /** Append one fact. */
  | { type: "append"; fact: NewFact }
  /** Run the worker named by a Started that was just appended. */
  | { type: "launch"; taskId: string; workerId: string }
  /**
   * Ask a running worker to end. The runtime does this when a person ends or
   * steers a task; see the applier for what "stop" costs on today's platform.
   */
  | { type: "stop"; taskId: string; workerId: string; why: string };

export interface ReconcileInput {
  snapshot: LedgerSnapshot;
  config: ManagerConfig;
  /** The second of the app's two model call sites. */
  judge: Judge;
  /** Injected so the output is a value tests can compare. */
  newWorkerId: () => string;
}

/** Reasons that appear on a Lost fact the runtime writes for itself. */
export const LOST_SILENT = "silent past cap";
export const LOST_STOPPED = "stopped by runtime";

export function reconcile(input: ReconcileInput): ReconcileAction[] {
  const { snapshot, config, judge, newWorkerId } = input;

  const running = snapshot.tasks.filter((task) => task.liveWorker !== undefined).length;
  // One budget for the whole pass. Every launch spends from it and every stop
  // returns to it, so the cap holds across tasks rather than per task.
  let budget = config.maxWorkers - running;
  const actions: ReconcileAction[] = [];

  /**
   * Tasks this pass wrote a Lost on. The snapshot was read before that Lost,
   * so its `resumableSession` may still name the session the lost worker is
   * running in; a start on the same pass must not ask for it. The next pass
   * folds the Lost and reaches the same answer on its own.
   */
  const lostThisPass = new Set<string>();

  /**
   * Write Started and launch a worker, unless the cap says not yet. The worker
   * continues the task's resumable session when there is one, reuse is on,
   * and nothing this pass made it unsafe.
   */
  const start = (task: TaskView, reason?: string): boolean => {
    if (budget <= 0) return false;
    const workerId = newWorkerId();
    const resume = config.reuseSessions && !lostThisPass.has(task.id) ? task.resumableSession : undefined;
    const prompt = buildWorkerPrompt({ task, config, reason, resume });
    actions.push({
      type: "append",
      fact: {
        taskId: task.id,
        kind: "Started",
        by: RUNTIME,
        payload: resume
          ? { workerId, prompt, resumeSessionId: resume.sessionId, replyProtocol: REPLY_PROTOCOL }
          : { workerId, prompt, replyProtocol: REPLY_PROTOCOL },
      },
    });
    actions.push({ type: "launch", taskId: task.id, workerId });
    budget -= 1;
    return true;
  };

  /** Ask a worker to end, and take its slot back for this pass. */
  const stop = (task: TaskView, why: string): void => {
    if (!task.liveWorker) return;
    actions.push({
      type: "stop",
      taskId: task.id,
      workerId: task.liveWorker.workerId,
      why,
    });
    lostThisPass.add(task.id);
    budget += 1;
  };

  /**
   * What to do about a worker that did not return: retry while the task is
   * under the start cap, and ask a person once it is over. The cap counts
   * Started facts since the last person fact or successful deferral. Normal
   * waits therefore never spend the failure budget.
   */
  const afterFailure = (task: TaskView, why: string): void => {
    if (task.startsSinceLastProgress < config.startCap) {
      start(task, why);
      return;
    }
    actions.push({
      type: "append",
      fact: {
        taskId: task.id,
        kind: "Question",
        by: RUNTIME,
        payload: { why: `${why} (${task.startsSinceLastProgress} attempts)` },
      },
    });
  };

  for (const task of snapshot.tasks) {
    // A person ended it. The only thing left to do is get out of the worker's
    // way — the runtime writes nothing more on a terminal task.
    if (isTerminal(task.state)) {
      stop(task, LOST_STOPPED);
      continue;
    }

    // Nobody owns it yet. Take it and start, or leave it Created for a pass
    // that has room; a Taken with no worker would only be work for later.
    if (task.state === "created") {
      if (budget <= 0) continue;
      actions.push({
        type: "append",
        fact: { taskId: task.id, kind: "Taken", by: RUNTIME, payload: {} },
      });
      start(task);
      continue;
    }

    // A worker that has been silent past the age cap is treated as dead. The
    // runtime writes the Lost the worker never could, then handles it as one.
    const worker = task.liveWorker;
    if (worker && workerAgeMs(worker, snapshot.now) > config.ageCapHours * 3_600_000) {
      actions.push({
        type: "append",
        fact: {
          taskId: task.id,
          kind: "Lost",
          by: RUNTIME,
          payload: { workerId: worker.workerId, why: LOST_SILENT },
        },
      });
      lostThisPass.add(task.id);
      budget += 1;
      afterFailure(task, `worker ${worker.workerId} was ${LOST_SILENT}`);
      continue;
    }

    switch (task.latest.kind) {
      case "Returned": {
        const { workerId, reply, result } = task.latest.payload;
        if (result?.outcome === "waiting") {
          // Anchor to the durable return, not this tick: replay cannot slide the deadline.
          actions.push({
            type: "append",
            fact: {
              taskId: task.id,
              kind: "Deferred",
              by: RUNTIME,
              payload: {
                workerId,
                reason: result.reason,
                resumeAfter: new Date(
                  task.latest.createdAt.getTime() + result.revisitAfterSeconds * 1000,
                ).toISOString(),
              },
            },
          });
          break;
        }
        if (result?.outcome === "blocked") {
          actions.push({
            type: "append",
            fact: { taskId: task.id, kind: "Question", by: RUNTIME, payload: { why: result.question } },
          });
          break;
        }
        const started = task.facts.find((f) => f.kind === "Started" && f.payload.workerId === workerId);
        if (started?.kind === "Started" && started.payload.replyProtocol === REPLY_PROTOCOL && !result) {
          actions.push({
            type: "append",
            fact: {
              taskId: task.id,
              kind: "Question",
              by: RUNTIME,
              payload: { why: "Worker returned without a validated protocol outcome." },
            },
          });
          break;
        }
        const summary = result?.outcome === "ready" ? result.summary : reply;
        const evidence = `worker ${workerId}`;
        const verdict = judge(task, summary, evidence);
        if (verdict.done) {
          actions.push({
            type: "append",
            fact: {
              taskId: task.id,
              kind: "Report",
              by: RUNTIME,
              payload: { what: summary, evidence },
            },
          });
        } else {
          afterFailure(task, `the last result was not accepted: ${verdict.why ?? "not done"}`);
        }
        break;
      }

      case "Deferred":
        if (snapshot.now.getTime() >= Date.parse(task.latest.payload.resumeAfter)) {
          start(task, `the recorded revisit time is due: ${task.latest.payload.reason}`);
        }
        break;

      case "Failed":
        if (task.latest.payload.failureKind === "reply_protocol") {
          // The runner already allowed one format repair. Do not start the same
          // invalid-output loop again under a fresh retry budget.
          actions.push({
            type: "append",
            fact: {
              taskId: task.id,
              kind: "Question",
              by: RUNTIME,
              payload: { why: task.latest.payload.error },
            },
          });
          break;
        }
        afterFailure(task, task.latest.payload.error);
        break;

      case "Lost":
        afterFailure(task, `worker ${task.latest.payload.workerId} was lost: ${task.latest.payload.why}`);
        break;

      case "Reply":
        // Steering. A worker started before the reply cannot read it, so it is
        // stopped and replaced by one whose brief carries the reply.
        stop(task, LOST_STOPPED);
        start(task, `a person replied: ${task.latest.payload.text}`);
        break;

      case "Taken":
        // Taken with no Started after it. Either the first pass ended between
        // the two writes, or the last pass had no budget.
        start(task);
        break;

      case "Started":
        // working: a worker is running and nothing has come back yet.
        break;

      case "Question":
      case "Report":
        // stuck and reported. Both wait for a person; the runtime never leaves
        // Taken on its own.
        break;

      default:
        break;
    }
  }

  return actions;
}
