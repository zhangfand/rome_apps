import { describe, expect, it } from "@rstest/core";
import { parseConfig, type ManagerConfig } from "./config.js";
import { type Fact, RUNTIME } from "./facts.js";
import { fold, foldTask } from "./fold.js";
import { judge } from "./judge.js";
import { buildWorkerPrompt } from "./prompt.js";
import { reconcile } from "./reconcile.js";
import { LedgerBuilder } from "./test-facts.js";
import { buildView } from "./view.js";
import { type WorkerReply } from "./worker-reply.js";

const parsed = parseConfig({ workingDir: "/srv/project" });
if (!parsed.ok) throw new Error(parsed.error);
const CONFIG = parsed.config;
const WAIT: WorkerReply = {
  outcome: "waiting",
  reason: "PR /pull/7 at abc123 needs review. Check on resumption.",
  revisitAfterSeconds: 300,
};

function working() {
  return new LedgerBuilder()
    .add({ taskId: "t1", kind: "Created", by: "ann", payload: { brief: "Deliver a reviewed PR" } })
    .add({ taskId: "t1", kind: "Taken", by: RUNTIME, payload: {} })
    .add({
      taskId: "t1",
      kind: "Started",
      by: RUNTIME,
      payload: { workerId: "w0", prompt: "go", replyProtocol: 1 },
    });
}
function returned(result: WorkerReply = WAIT) {
  return working().add({
    taskId: "t1",
    kind: "Returned",
    by: "w0",
    payload: { workerId: "w0", reply: JSON.stringify(result), result, sessionId: "s1" },
  });
}
function pass(b: LedgerBuilder, now = b.now(0), overrides: Partial<ManagerConfig> = {}) {
  let n = b.facts.length;
  return reconcile({
    snapshot: fold(now, b.facts),
    config: { ...CONFIG, ...overrides },
    judge,
    newWorkerId: () => `w${++n}`,
  });
}
function appendPass(b: LedgerBuilder, now = b.now(0), overrides: Partial<ManagerConfig> = {}) {
  const actions = pass(b, now, overrides);
  for (const a of actions) if (a.type === "append") b.add(a.fact, 0);
  return actions;
}
function deferred() {
  const b = returned();
  appendPass(b);
  return b;
}
function starts(b: LedgerBuilder): Fact[] {
  return b.facts.filter((f) => f.kind === "Started");
}

describe("waiting lifecycle", () => {
  it("records a durable deadline from Returned, not from a late reconciliation tick", () => {
    const b = returned();
    const deadline = new Date(b.now(0).getTime() + 300_000).toISOString();
    const actions = pass(b, b.now(30));
    expect(actions).toEqual([
      {
        type: "append",
        fact: {
          taskId: "t1",
          kind: "Deferred",
          by: RUNTIME,
          payload: { workerId: "w0", reason: WAIT.reason, resumeAfter: deadline },
        },
      },
    ]);
  });
  it("remains Taken with no live worker and a reusable session", () => {
    const task = foldTask(deferred().facts);
    expect(task).toMatchObject({
      state: "taken",
      position: "waiting",
      resumableSession: { workerId: "w0", sessionId: "s1" },
      waiting: { reason: WAIT.reason },
      startsSinceLastProgress: 0,
    });
    expect(task.liveWorker).toBeUndefined();
  });
  it("does nothing before the deadline, including repeated ticks", () => {
    const b = deferred();
    expect(pass(b)).toEqual([]);
    expect(pass(b, b.now(4.99))).toEqual([]);
  });
  it("resumes exactly at the deadline and carries only the session delta plus protocol", () => {
    const b = deferred();
    const actions = appendPass(b, b.now(5));
    expect(actions.map((a) => a.type)).toEqual(["append", "launch"]);
    const task = foldTask(b.facts);
    expect(task.position).toBe("working");
    expect(task.waiting).toBeUndefined();
    const start = b.facts.at(-1)!;
    if (start.kind !== "Started") throw new Error("Expected Started");
    expect(start.payload).toMatchObject({ resumeSessionId: "s1", replyProtocol: 1 });
    expect(start.payload.prompt).toContain(WAIT.reason);
    expect(start.payload.prompt).toContain("Worker reply protocol v1");
    expect(start.payload.prompt).not.toContain("What was asked for:");
    expect(pass(b)).toEqual([]);
  });
  it("keeps waiting when due but all slots are occupied", () => {
    const b = deferred()
      .add({ taskId: "t2", kind: "Created", by: "ann", payload: { brief: "other work" } }, 0)
      .add({ taskId: "t2", kind: "Taken", by: RUNTIME, payload: {} }, 0)
      .add({ taskId: "t2", kind: "Started", by: RUNTIME, payload: { workerId: "other", prompt: "go" } }, 0);
    expect(pass(b, b.now(5), { maxWorkers: 1 })).toEqual([]);
    expect(fold(b.now(), b.facts).tasks[0].position).toBe("waiting");
  });
  it("frees a slot for a different task while waiting", () => {
    const b = deferred().add(
      { taskId: "t2", kind: "Created", by: "ann", payload: { brief: "other work" } },
      0,
    );
    const actions = pass(b, b.now(0), { maxWorkers: 1 });
    expect(actions.some((a) => a.type === "launch" && a.taskId === "t2")).toBe(true);
  });
  it("repeated waits do not spend the failure cap and work after a snapshot rebuild", () => {
    const b = deferred();
    for (let i = 0; i < 4; i += 1) {
      appendPass(b, b.now(5), { startCap: 1 });
      const workerId = foldTask(b.facts).liveWorker!.workerId;
      b.add({
        taskId: "t1",
        kind: "Returned",
        by: workerId,
        payload: { workerId, reply: JSON.stringify(WAIT), result: WAIT, sessionId: "s1" },
      });
      appendPass(b);
      expect(foldTask(b.facts).position).toBe("waiting");
    }
    expect(starts(b)).toHaveLength(5);
    // After healthy waits, one real failure still has its normal retry allowance.
    appendPass(b, b.now(5));
    const workerId = foldTask(b.facts).liveWorker!.workerId;
    b.add({
      taskId: "t1",
      kind: "Failed",
      by: workerId,
      payload: { workerId, error: "temporary failure", sessionId: "s1" },
    });
    expect(pass(b).some((a) => a.type === "launch")).toBe(true);
  });
  for (const kind of ["Completed", "Cancelled"] as const) {
    it(`does not resume after ${kind}`, () => {
      const b = deferred().add({ taskId: "t1", kind, by: "ann", payload: {} });
      expect(pass(b, b.now(50))).toEqual([]);
      expect(foldTask(b.facts).waiting).toBeUndefined();
    });
  }
  it("a person can steer a waiting task before its timer is due", () => {
    const b = deferred().add(
      { taskId: "t1", kind: "Reply", by: "ann", payload: { text: "Change the scope" } },
      0,
    );
    expect(pass(b).some((a) => a.type === "launch")).toBe(true);
  });
  it("can start fresh after waiting if reuse is disabled", () => {
    const a = pass(deferred(), deferred().now(5), { reuseSessions: false })[0];
    if (a.type !== "append" || a.fact.kind !== "Started") throw new Error("Expected Started");
    expect(a.fact.payload.resumeSessionId).toBeUndefined();
    expect(a.fact.payload.prompt).toContain("What was asked for:");
    expect(a.fact.payload.prompt).toContain(WAIT.reason);
  });
  it("does not treat a long wait as a lost worker", () => {
    const result: WorkerReply = { ...WAIT, revisitAfterSeconds: 86_400 };
    const b = returned(result);
    appendPass(b);
    expect(pass(b, b.now(10 * 60))).toEqual([]);
  });
});

describe("other outcomes and compatibility", () => {
  it("reports ready summary without exposing the JSON wrapper or completing the task", () => {
    const b = returned({ outcome: "ready", summary: "PR /pull/7 reviewed and checked" });
    appendPass(b);
    expect(foldTask(b.facts)).toMatchObject({ state: "taken", position: "reported" });
    expect(b.facts.at(-1)?.payload).toEqual({
      what: "PR /pull/7 reviewed and checked",
      evidence: "worker w0",
    });
  });
  it("asks a human immediately on blocked rather than retrying", () => {
    const b = returned({ outcome: "blocked", question: "Which requirement wins?" });
    const actions = appendPass(b);
    expect(actions).toHaveLength(1);
    expect(foldTask(b.facts).position).toBe("stuck");
    expect(b.facts.at(-1)?.payload).toEqual({ why: "Which requirement wins?" });
  });
  it("does not retry a protocol failure after the runner has used its repair attempt", () => {
    const b = working().add({
      taskId: "t1",
      kind: "Failed",
      by: "w0",
      payload: { workerId: "w0", error: "Invalid reply after repair", failureKind: "reply_protocol" },
    });
    appendPass(b);
    expect(foldTask(b.facts).position).toBe("stuck");
    expect(pass(b)).toEqual([]);
  });
  it("does not accept an unvalidated new-protocol Returned as success", () => {
    const b = working().add({
      taskId: "t1",
      kind: "Returned",
      by: "w0",
      payload: { workerId: "w0", reply: "Done" },
    });
    appendPass(b);
    expect(foldTask(b.facts).position).toBe("stuck");
  });
  it("still processes a pre-upgrade worker by the contract it was given", () => {
    const b = working();
    const start = b.facts.at(-1)!;
    if (start.kind === "Started") delete start.payload.replyProtocol;
    b.add({ taskId: "t1", kind: "Returned", by: "w0", payload: { workerId: "w0", reply: "Old summary" } });
    appendPass(b);
    expect(foldTask(b.facts).position).toBe("reported");
  });
  it("provides the protocol on fresh prompts too", () => {
    const prompt = buildWorkerPrompt({ task: foldTask(working().facts), config: CONFIG });
    expect(prompt).toContain("Worker reply protocol v1");
    expect(prompt).not.toContain("BLOCKED:");
  });
  it("keeps waits out of Needs you and exposes the deadline in the read model", () => {
    const b = deferred();
    const view = buildView({ now: b.now(), facts: b.facts, lock: undefined });
    expect(view.counts.positions.waiting).toBe(1);
    expect(view.counts.workers.running).toBe(0);
    expect(view.tasks[0].attention).toBeUndefined();
    expect(view.tasks[0].waiting).toMatchObject({ reason: WAIT.reason });
    expect(view.tasks[0].workers[0].outcome).toBe(WAIT.reason);
  });
});
