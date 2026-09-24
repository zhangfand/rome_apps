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
  it("retains engineering-plan lineage without treating it as a dependency", () => {
    const task = foldTask([f({
      kind: "Created",
      by: "orchestrator",
      source: "conductor:create_child_tasks",
      payload: { brief: "slice", parent: { taskId: "parent", planItemId: "slice-1", specRef: "feature/spec.md" } },
    })]);
    expect(task.parent).toEqual({ taskId: "parent", planItemId: "slice-1", specRef: "feature/spec.md" });
    expect(task.state).toBe("open");
    expect(task.lastDecision).toBeUndefined();
    expect(task.unseen.map((fact) => fact.kind)).toEqual(["Created"]);
    expect(needsAttention(task, new Date())).toMatchObject({ wake: true });
  });
  it("does not treat an orchestrator-authored runtime outcome as a decision", () => {
    const task = foldTask([
      created(),
      f({ kind: "ACK", by: "orchestrator", payload: { summary: "worker is still useful" } }),
      f({ kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "x", prompt: "x" } }),
      f({ kind: "Lost", by: "orchestrator", payload: { jobId: "j-1", workerId: "w-1", why: "stopped" } }),
    ]);
    expect(task.lastDecision).toBeUndefined();
    expect(task.lastProcessedSeq).toBe(task.facts[1].seq);
    expect(task.unseen.map((fact) => fact.kind)).toEqual(["Lost"]);
    expect(needsAttention(task, new Date())).toMatchObject({ wake: true });
  });

  it("ACK advances processing without replacing workflow state or consuming the decision budget", () => {
    const facts = [
      created(),
      f({ kind: "Reported", by: "orchestrator", payload: { report: "Please verify the prototype." } }),
      f({ kind: "Event", by: "runtime", payload: { source: "github", type: "comment", summary: "bot chatter" } }),
      f({ kind: "ACK", by: "orchestrator", payload: { summary: "The comment does not change the handoff." } }),
    ];
    const task = foldTask(facts);
    expect(task.lastDecision?.kind).toBe("Reported");
    expect(task.lastDecisionSeq).toBe(facts[1].seq);
    expect(task.lastProcessedSeq).toBe(facts[3].seq);
    expect(task.decisionsSinceLastPersonFact).toBe(1);
    expect(task.unseen).toEqual([]);
    expect(needsAttention(task, new Date()).wake).toBe(false);
  });

  it("legacy Noted behaves as an acknowledgement, not a workflow state", () => {
    const facts = [
      created(),
      f({ kind: "Asked", by: "orchestrator", payload: { question: "Proceed?" } }),
      f({ kind: "Noted", by: "orchestrator", payload: { note: "legacy observation" } }),
    ];
    const task = foldTask(facts);
    expect(task.lastDecision?.kind).toBe("Asked");
    expect(task.lastProcessedSeq).toBe(facts[2].seq);
    expect(task.decisionsSinceLastPersonFact).toBe(1);
  });
  it("separates a coordinator Job from runtime dispatch and wakes only for its result", () => {
    const facts = [created(),
      f({ kind: "JobCreated", by: "orchestrator", payload: { jobId: "j-1", agent: "coding:coding", instructions: "x" } })];
    let task = foldTask(facts);
    expect(task.pendingJob).toMatchObject({ jobId: "j-1", agent: "coding:coding", instructions: "x" });
    expect(needsAttention(task, new Date()).wake).toBe(false);

    facts.push(f({ kind: "ACK", by: "orchestrator", payload: { summary: "The queued job remains the current workflow posture." } }));
    task = foldTask(facts);
    expect(task.pendingJob).toMatchObject({ jobId: "j-1" });
    expect(task.lastDecision?.kind).toBe("JobCreated");
    expect(needsAttention(task, new Date()).wake).toBe(false);

    facts.push(f({ kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "x", prompt: "x" } }));
    task = foldTask(facts);
    expect(task.pendingJob).toBeUndefined();
    expect(task.liveWorker?.workerId).toBe("w-1");
    expect(task.liveWorker?.jobId).toBe("j-1");
    expect(needsAttention(task, new Date()).wake).toBe(false);

    facts.push(f({ kind: "Opened", by: "w-1", payload: { jobId: "j-1", workerId: "w-1", romeSessionId: "s", sessionType: "t" } }));
    task = foldTask(facts);
    expect(task.liveWorker?.romeSession).toEqual({ id: "s", type: "t" });
    expect(needsAttention(task, new Date()).wake).toBe(false);
    facts.push(f({ kind: "Returned", by: "w-1", payload: { jobId: "j-1", workerId: "w-1", status: "succeeded", summary: "done", sessionId: "s" } }));
    task = foldTask(facts);
    expect(task.liveWorker).toBeUndefined();
    expect(needsAttention(task, new Date()).wake).toBe(true);
    expect(task.unseen.map((x) => x.kind)).toEqual(["Returned"]);
  });

  it("wakes the coordinator when runtime cannot dispatch a Job", () => {
    const task = foldTask([
      created(),
      f({ kind: "JobCreated", by: "orchestrator", payload: { jobId: "j-1", agent: "coding:coding", instructions: "x" } }),
      f({ kind: "JobFailed", by: "runtime", payload: { jobId: "j-1", agent: "coding:coding", error: "workspace missing" } }),
    ]);
    expect(task.pendingJob).toBeUndefined();
    expect(task.unseen.map((x) => x.kind)).toEqual(["JobFailed"]);
    expect(needsAttention(task, new Date()).wake).toBe(true);
  });
  it("Waited wakes only when due; a person's reply wakes at once and resets the budget", () => {
    const facts = [created(),
      f({ kind: "ACK", by: "orchestrator", payload: { summary: "a" } }),
      f({ kind: "Waited", by: "orchestrator", payload: { reason: "ci", resumeAfter: new Date(t0 + 3_600_000).toISOString() } })];
    let task = foldTask(facts);
    expect(task.decisionsSinceLastPersonFact).toBe(1);
    expect(needsAttention(task, new Date(t0 + 10_000)).wake).toBe(false);
    expect(needsAttention(task, new Date(t0 + 3_700_000)).wake).toBe(true);
    facts.push(f({ kind: "Reply", by: "zhangfan", source: "go", payload: { text: "go" } }));
    task = foldTask(facts);
    expect(task.decisionsSinceLastPersonFact).toBe(0);
    expect(task.waiting).toBeUndefined();
    expect(needsAttention(task, new Date(t0 + 10_000)).wake).toBe(true);
  });
  it("orchestrator Completed closes the task", () => {
    const task = foldTask([created(), f({ kind: "Completed", by: "orchestrator", payload: { reason: "merged" } })]);
    expect(task.state).toBe("completed");
    expect(needsAttention(task, new Date()).wake).toBe(false);
  });

  it("a closed Task exposes no pending Job or live Run", () => {
    const task = foldTask([
      created(),
      f({ kind: "JobCreated", by: "orchestrator", payload: { jobId: "j-1", agent: "coding:coding", instructions: "x" } }),
      f({ kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "x", prompt: "x" } }),
      f({ kind: "Completed", by: "person", payload: { reason: "no longer needed" } }),
    ]);
    expect(task.state).toBe("completed");
    expect(task.liveWorker).toBeUndefined();
    expect(task.pendingJob).toBeUndefined();
  });
  it("treats a Snapshot as context rather than a decision or operational event", () => {
    const task = foldTask([
      created(),
      f({ kind: "JobCreated", by: "orchestrator", payload: { jobId: "j-1", agent: "coding:coding", instructions: "x" } }),
      f({ kind: "Snapshot", by: "conductor:ledger-compactor", payload: {
        coversThroughSeq: seq,
        summary: "Job j-1 is queued",
        schemaVersion: 1,
        inputFactCount: 2,
        estimatedInputTokens: 20,
      } }),
    ]);
    expect(task.pendingJob?.jobId).toBe("j-1");
    expect(task.lastDecision?.kind).toBe("JobCreated");
    expect(task.unseen).toEqual([]);
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
