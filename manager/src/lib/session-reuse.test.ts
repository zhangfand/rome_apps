import { describe, expect, it } from "@rstest/core";
import { isResumeRejection } from "../actions/run-worker/index.js";
import { DEFAULT_WORKER_AGENT, type ManagerConfig } from "./config.js";
import { describeFact, RUNTIME } from "./facts.js";
import { fold, foldTask } from "./fold.js";
import type { Judge } from "./judge.js";
import { buildWorkerPrompt } from "./prompt.js";
import { LOST_SILENT, reconcile, type ReconcileAction } from "./reconcile.js";
import { LedgerBuilder } from "./test-facts.js";
import { workersOf } from "./view.js";

/**
 * Session reuse, end to end through the pure logic: what the fold offers, what
 * reconcile asks for, what the brief says, and what the dashboard shows. See
 * docs/session-reuse.md for the rule these pin down.
 */

const ANN = "ann";
const S1 = "sess-1111-aaaa";
const S2 = "sess-2222-bbbb";

const CONFIG: ManagerConfig = {
  workingDir: "/srv/project",
  workerAgent: DEFAULT_WORKER_AGENT,
  startCap: 2,
  maxWorkers: 3,
  ageCapHours: 3,
  intervalMinutes: 5,
  reuseSessions: true,
};

const NEVER_DONE: Judge = () => ({ done: false, why: "no pull request" });

function run(
  ledger: LedgerBuilder,
  overrides: { config?: Partial<ManagerConfig>; judge?: Judge; now?: Date } = {},
): ReconcileAction[] {
  let n = 0;
  return reconcile({
    snapshot: fold(overrides.now ?? ledger.now(), ledger.facts),
    config: { ...CONFIG, ...overrides.config },
    judge: overrides.judge ?? (() => ({ done: true })),
    newWorkerId: () => `w${++n}`,
  });
}

/** The Started facts a pass appends, reduced to what session reuse decides. */
function starts(actions: ReconcileAction[]) {
  return actions.flatMap((action) =>
    action.type === "append" && action.fact.kind === "Started"
      ? [{ workerId: action.fact.payload.workerId, resume: action.fact.payload.resumeSessionId }]
      : [],
  );
}

function startedPrompt(actions: ReconcileAction[]): string {
  const started = actions.find((a) => a.type === "append" && a.fact.kind === "Started");
  if (!started || started.type !== "append" || started.fact.kind !== "Started") {
    throw new Error("expected a Started");
  }
  return started.fact.payload.prompt;
}

function taken(taskId = "t1") {
  return new LedgerBuilder()
    .add({ taskId, kind: "Created", by: ANN, source: "add rate limiting", payload: { brief: "add rate limiting" } })
    .add({ taskId, kind: "Taken", by: RUNTIME, payload: {} });
}

/** Taken, then w0 ran in S1 and returned `reply`. */
function returned(reply = "opened PR #7") {
  return taken()
    .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w0", prompt: "go" } })
    .add({ taskId: "t1", kind: "Returned", by: "w0", payload: { workerId: "w0", reply, sessionId: S1 } });
}

describe("fold: resumableSession", () => {
  it("is absent on a task nobody has worked on", () => {
    expect(foldTask(taken().facts).resumableSession).toBeUndefined();
  });

  it("is left by a Returned worker that reported its session", () => {
    expect(foldTask(returned().facts).resumableSession).toEqual({ workerId: "w0", sessionId: S1 });
  });

  it("is left by a Failed worker too — the summon finished, so the session is idle", () => {
    const ledger = taken()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w0", prompt: "go" } })
      .add({ taskId: "t1", kind: "Failed", by: "w0", payload: { workerId: "w0", error: "boom", sessionId: S1 } });
    expect(foldTask(ledger.facts).resumableSession).toEqual({ workerId: "w0", sessionId: S1 });
  });

  it("is not left by a Failed with no session — nothing ever opened", () => {
    const ledger = taken()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w0", prompt: "go" } })
      .add({ taskId: "t1", kind: "Failed", by: "w0", payload: { workerId: "w0", error: "agent missing" } });
    expect(foldTask(ledger.facts).resumableSession).toBeUndefined();
  });

  it("is cleared by a Lost, because that worker may still be running in it", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "go", resumeSessionId: S1 } })
      .add({ taskId: "t1", kind: "Lost", by: RUNTIME, payload: { workerId: "w1", why: LOST_SILENT } });
    expect(foldTask(ledger.facts).resumableSession).toBeUndefined();
  });

  it("is cleared by a Restarted that names it, and does not close the live worker", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "delta", resumeSessionId: S1 } })
      .add({
        taskId: "t1",
        kind: "Restarted",
        by: "w1",
        payload: { workerId: "w1", rejectedSessionId: S1, error: "not found", prompt: "full" },
      });
    const task = foldTask(ledger.facts);
    expect(task.resumableSession).toBeUndefined();
    expect(task.liveWorker?.workerId).toBe("w1");
    expect(task.position).toBe("working");
  });

  it("moves to the newest session once a restarted worker returns", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "delta", resumeSessionId: S1 } })
      .add({
        taskId: "t1",
        kind: "Restarted",
        by: "w1",
        payload: { workerId: "w1", rejectedSessionId: S1, error: "not found", prompt: "full" },
      })
      .add({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "done", sessionId: S2 } });
    expect(foldTask(ledger.facts).resumableSession).toEqual({ workerId: "w1", sessionId: S2 });
  });
});

describe("reconcile: which starts resume", () => {
  it("resumes after a judge rejection", () => {
    expect(starts(run(returned(), { judge: NEVER_DONE }))).toEqual([{ workerId: "w1", resume: S1 }]);
  });

  it("resumes a Failed worker's session on retry", () => {
    const ledger = taken()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w0", prompt: "go" } })
      .add({ taskId: "t1", kind: "Failed", by: "w0", payload: { workerId: "w0", error: "boom", sessionId: S1 } });
    expect(starts(run(ledger))).toEqual([{ workerId: "w1", resume: S1 }]);
  });

  it("resumes the worker that reported when a person replies to the Report", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Report", by: RUNTIME, payload: { what: "opened PR #7", evidence: "worker w0" } })
      .add({ taskId: "t1", kind: "Reply", by: ANN, source: "also add tests", payload: { text: "also add tests" } });
    expect(starts(run(ledger))).toEqual([{ workerId: "w1", resume: S1 }]);
  });

  it("starts fresh when a reply arrives while a worker is running — that one is stopped, not resumed", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "go", resumeSessionId: S1 } })
      .add({ taskId: "t1", kind: "Reply", by: ANN, source: "wait", payload: { text: "wait" } });
    const actions = run(ledger);
    // The stop lands as a Lost on w1; reconcile decides from the snapshot it
    // read, in which S1 is still resumable — but w1 is running in S1 right
    // now, so the replacement must not ask for it.
    expect(actions.some((a) => a.type === "stop" && a.workerId === "w1")).toBe(true);
    expect(starts(actions)).toEqual([{ workerId: "w1", resume: undefined }]);
  });

  it("starts fresh after a worker silent past the age cap", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "go", resumeSessionId: S1 } });
    const actions = run(ledger, { now: ledger.now(4 * 60), config: { startCap: 5 } });
    expect(starts(actions)).toEqual([{ workerId: "w1", resume: undefined }]);
  });

  it("never resumes when reuse is switched off", () => {
    expect(starts(run(returned(), { judge: NEVER_DONE, config: { reuseSessions: false } }))).toEqual([
      { workerId: "w1", resume: undefined },
    ]);
  });
});

describe("prompt: a resumed brief carries only the delta", () => {
  it("omits the brief and the history the session already holds", () => {
    const ledger = returned("BLOCKED: which database?")
      .add({ taskId: "t1", kind: "Question", by: RUNTIME, payload: { why: "BLOCKED: which database?" } })
      .add({ taskId: "t1", kind: "Reply", by: ANN, source: "postgres", payload: { text: "postgres" } });
    const prompt = startedPrompt(run(ledger));

    expect(prompt).toContain("continuing task t1");
    expect(prompt).toContain("worker w0");
    expect(prompt).toContain("Reply by ann — postgres");
    expect(prompt).toContain("Why you were started: a person replied: postgres");
    // Not repeated: the opening brief and the resumed worker's own Started.
    expect(prompt).not.toContain("What was asked for:");
    expect(prompt).not.toContain("Created by ann");
    expect(prompt).not.toContain("Working directory:");
    // Still told how to end.
    expect(prompt).toContain("BLOCKED:");
  });

  it("gives a fresh worker the whole history, as before", () => {
    const prompt = startedPrompt(run(returned(), { judge: NEVER_DONE, config: { reuseSessions: false } }));
    expect(prompt).toContain("What was asked for:");
    expect(prompt).toContain("Working directory: /srv/project");
    expect(prompt).toContain("Returned by w0");
  });

  it("builds a full brief for a fallback, regardless of the session it was meant to resume", () => {
    const task = foldTask(returned().facts);
    const prompt = buildWorkerPrompt({ task, config: CONFIG, reason: "resume rejected" });
    expect(prompt).toContain("What was asked for:");
    expect(prompt).toContain("Why you were started: resume rejected");
  });
});

describe("facts: Restarted reads as what happened", () => {
  it("names the rejected session and the error", () => {
    const [fact] = new LedgerBuilder().add({
      taskId: "t1",
      kind: "Restarted",
      by: "w1",
      payload: { workerId: "w1", rejectedSessionId: S1, error: "not found", prompt: "full" },
    }).facts;
    expect(describeFact(fact)).toContain(
      `Restarted by w1 — worker w1: resume of session ${S1} rejected (not found); started a fresh session`,
    );
  });

  it("says when a Started resumes", () => {
    const [fact] = new LedgerBuilder().add({
      taskId: "t1",
      kind: "Started",
      by: RUNTIME,
      payload: { workerId: "w1", prompt: "delta", resumeSessionId: S1 },
    }).facts;
    expect(describeFact(fact)).toContain(`worker w1, resuming session ${S1}`);
  });
});

describe("view: workers carry their sessions", () => {
  it("shows the resumed session, the restart, and the session it ran in", () => {
    const ledger = returned()
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "delta", resumeSessionId: S1 } })
      .add({
        taskId: "t1",
        kind: "Restarted",
        by: "w1",
        payload: { workerId: "w1", rejectedSessionId: S1, error: "not found", prompt: "full" },
      })
      .add({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "done", sessionId: S2 } });
    const [w0, w1] = workersOf("t1", "add rate limiting", ledger.facts, ledger.now());
    expect(w0).toMatchObject({ workerId: "w0", status: "returned", sessionId: S1, resumedSessionId: undefined });
    expect(w1).toMatchObject({
      workerId: "w1",
      status: "returned",
      resumedSessionId: S1,
      restarted: { rejectedSessionId: S1, error: "not found" },
      sessionId: S2,
    });
  });
});

describe("run_worker: telling a rejected resume from a real failure", () => {
  it("recognises the runner's refusals", () => {
    expect(isResumeRejection(`Agent session "${S1}" was not found or cannot be resumed`)).toBe(true);
    expect(isResumeRejection(`Agent session "${S1}" does not match this session key`)).toBe(true);
    expect(isResumeRejection("AgentSessionManager cannot resume by explicit session id")).toBe(true);
    expect(isResumeRejection("Child AgentSessionManager cannot resume by session ID")).toBe(true);
    // What summon surfaces for a bad id in practice (verified 2026-09-07).
    expect(isResumeRejection('Summoned agent "coding:coding" did not provide a durable Rome session')).toBe(true);
  });

  it("treats anything else as the worker's own failure", () => {
    expect(isResumeRejection("TypeError: cannot read properties of undefined")).toBe(false);
    expect(isResumeRejection("summon returned handoff")).toBe(false);
    expect(isResumeRejection("")).toBe(false);
  });
});
