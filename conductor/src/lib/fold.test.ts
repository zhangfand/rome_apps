import { describe, expect, it } from "@rstest/core";
import { foldTask, needsAttention } from "./fold.js";
import type { Fact, NewFact } from "./facts.js";
import { parseWorkerReply } from "./worker-reply.js";

let seq = 0;
const t0 = Date.parse("2026-09-11T00:00:00Z");
function f(fact: Omit<NewFact, "taskId">): Fact {
  seq += 1;
  return { ...fact, taskId: "t-1", seq, id: `f${seq}`, createdAt: new Date(t0 + seq * 1000) } as Fact;
}
const created = () => f({ kind: "Created", by: "zhangfan", source: "do it", payload: { brief: "Add slugify", projectId: "p", project: { workingDir: "/x" } } });

describe("foldTask", () => {
  it("a fresh task needs attention and has no decision", () => {
    const task = foldTask([created()]);
    expect(task.state).toBe("open");
    expect(task.unseen.map((x) => x.kind)).toEqual(["Created"]);
    expect(task.lastDecision).toBeUndefined();
    expect(needsAttention(task, new Date()).wake).toBe(true);
  });
  it("a Returned after a Dispatched wakes the orchestrator; Opened does not", () => {
    const facts = [created(),
      f({ kind: "Dispatched", by: "orchestrator", payload: { workerId: "w-1", agent: "coding:coding", instructions: "x", prompt: "x" } }),
      f({ kind: "Opened", by: "w-1", payload: { workerId: "w-1", romeSessionId: "s", sessionType: "t" } })];
    let task = foldTask(facts);
    expect(task.liveWorker?.workerId).toBe("w-1");
    expect(needsAttention(task, new Date()).wake).toBe(false);
    facts.push(f({ kind: "Returned", by: "w-1", payload: { workerId: "w-1", status: "succeeded", summary: "done", sessionId: "s" } }));
    task = foldTask(facts);
    expect(task.liveWorker).toBeUndefined();
    expect(needsAttention(task, new Date()).wake).toBe(true);
    expect(task.unseen.map((x) => x.kind)).toEqual(["Returned"]);
  });
  it("Waited wakes only when due; a person's reply wakes at once and resets the budget", () => {
    const facts = [created(),
      f({ kind: "Noted", by: "orchestrator", payload: { note: "a" } }),
      f({ kind: "Waited", by: "orchestrator", payload: { reason: "ci", resumeAfter: new Date(t0 + 3_600_000).toISOString() } })];
    let task = foldTask(facts);
    expect(task.decisionsSinceLastPersonFact).toBe(2);
    expect(needsAttention(task, new Date(t0 + 10_000)).wake).toBe(false);
    expect(needsAttention(task, new Date(t0 + 3_700_000)).wake).toBe(true);
    facts.push(f({ kind: "Reply", by: "zhangfan", source: "go", payload: { text: "go" } }));
    task = foldTask(facts);
    expect(task.decisionsSinceLastPersonFact).toBe(0);
    expect(needsAttention(task, new Date(t0 + 10_000)).wake).toBe(true);
  });
  it("orchestrator Completed closes the task", () => {
    const task = foldTask([created(), f({ kind: "Completed", by: "orchestrator", payload: { reason: "merged" } })]);
    expect(task.state).toBe("completed");
    expect(needsAttention(task, new Date()).wake).toBe(false);
  });
});

describe("parseWorkerReply", () => {
  it("reads the fenced block", () => {
    const r = parseWorkerReply("I did things.\n\nPR: https://x\n\n```conductor\nstatus: succeeded\nsummary: Opened PR https://x with tests.\n```\n");
    expect(r.status).toBe("succeeded");
    expect(r.summary).toBe("Opened PR https://x with tests.");
    expect(r.detail).toContain("I did things");
  });
  it("falls back to unparsed without losing text", () => {
    const r = parseWorkerReply("just prose");
    expect(r.status).toBe("unparsed");
    expect(r.raw).toBe("just prose");
  });
});
