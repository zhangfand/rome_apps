import { describe, expect, it } from "@rstest/core";
import { LedgerBuilder } from "./test-facts.js";
import { parseConfig } from "./config.js";
import { fold, foldTask } from "./fold.js";
import { hooksOf, lastStart, type Phase } from "./lifecycle.js";
import { reconcile } from "./reconcile.js";
import { parsePhaseReply, replyInstructions, type WorkerReply } from "./worker-reply.js";
import { issuesToWatch } from "./observe.js";
import { buildView } from "./view.js";
const hook = { agent: "assistant:assistant", instructions: "Independently verify final human sign-off; no approval on behalf of anyone." };
const p = parseConfig({ workingDir: "/business", hooks: { completion: hook } });
if (!p.ok) throw new Error(p.error);
const config = p.config;
const completed: WorkerReply = { outcome: "completed", summary: "Reviewer approved document v3", evidence: ["Approval record /approvals/a1 by reviewer for document v3 at 2026-09-11T12:00Z"] };
function report(withHook = true) { return new LedgerBuilder()
  .add({ taskId: "t", kind: "Created", by: "guardian", payload: { brief: "Research the market; await my sign-off", projectId: "default", project: { workingDir: "/business", ...(withHook ? { hooks: config.hooks } : {}) } } })
  .add({ taskId: "t", kind: "Taken", by: "runtime", payload: {} })
  .add({ taskId: "t", kind: "Started", by: "runtime", payload: { workerId: "work", prompt: "research" } })
  .add({ taskId: "t", kind: "Returned", by: "work", payload: { workerId: "work", reply: "Document v3", sessionId: "work-session", result: { outcome: "ready", summary: "Document v3" } } })
  .add({ taskId: "t", kind: "Report", by: "runtime", payload: { what: "Review document v3", evidence: "work", submissionSeq: 4 } }); }
function tick(l: LedgerBuilder, minutes = 1, cfg = config) {
  const actions = reconcile({ snapshot: fold(l.now(minutes), l.facts), config: cfg, judge: () => ({ done: true }), newWorkerId: () => `w${l.facts.length}` });
  for (const a of actions) if (a.type === "append") l.add(a.fact, 0);
  return actions;
}
function returned(l: LedgerBuilder, result: WorkerReply) {
  const workerId = lastStart(foldTask(l.facts))!.payload.workerId;
  l.add({ taskId: "t", kind: "Returned", by: workerId, payload: { workerId, reply: JSON.stringify(result), result, sessionId: `session-${workerId}` } }, 0);
}
describe("user-defined completion controller", () => {
  it("starts a separate completion session after report and closes only with evidence", () => {
    const l = report(); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ phase: "completion", hook, assessment: { reportSeq: 5 } });
    expect(lastStart(foldTask(l.facts))!.payload.resumeSessionId).toBeUndefined();
    expect(lastStart(foldTask(l.facts))!.payload.prompt).toContain("Review document v3");
    expect(foldTask(l.facts).state).toBe("taken");
    returned(l, completed); const resultSeq = l.facts.at(-1)!.seq; tick(l);
    expect(l.facts.at(-1)).toMatchObject({ kind: "Completed", payload: { completion: { reportSeq: 5, resultSeq, evidence: completed.evidence } } });
    expect(foldTask(l.facts).state).toBe("completed"); expect(tick(l)).toEqual([]);
  });
  it("wait repeats only the same completion check; report remains visible and work is not resumed", () => {
    const l = report(); tick(l); returned(l, { outcome: "waiting", reason: "Await reviewer /approvals/a1", revisitAfterSeconds: 300 }); tick(l);
    const v = buildView({ now: l.now(), facts: l.facts, config, lock: undefined });
    expect(v.tasks[0]).toMatchObject({ completionStatus: "waiting", attention: { kind: "Report", text: "Review document v3" } });
    expect(tick(l, 1)).toEqual([]); tick(l, 10);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ phase: "completion", assessment: { reportSeq: 5 } });
    expect(l.facts.filter(f => f.kind === "Started" && !f.payload.phase)).toHaveLength(1);
  });
  it("research sign-off reply rechecks completion without preparing or redoing research", () => {
    const l = report(); tick(l); returned(l, { outcome: "waiting", reason: "Approval pending", revisitAfterSeconds: 900 }); tick(l);
    l.add({ taskId: "t", kind: "Reply", by: "guardian", source: "I approve document v3", payload: { text: "I approve document v3" } }); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("completion");
    expect(lastStart(foldTask(l.facts))!.payload.prompt).toContain("I approve document v3");
    returned(l, completed); tick(l); expect(foldTask(l.facts).state).toBe("completed");
  });
  it("blocked completion waits for human and an answer resumes only that check", () => {
    const l = report(); tick(l); returned(l, { outcome: "blocked", question: "Who is the reviewer?" }); tick(l);
    expect(l.facts.at(-1)?.kind).toBe("Question"); expect(tick(l)).toEqual([]);
    l.add({ taskId: "t", kind: "Reply", by: "guardian", payload: { text: "I am" } }); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("completion");
  });
  it("rejects stale completion after new human instructions or a newer report", () => {
    for (const changed of ["Reply", "Report"] as const) {
      const l = report(); tick(l);
      l.add({ taskId: "t", kind: changed, by: "guardian", payload: changed === "Reply" ? { text: "Change scope" } : { what: "New report", evidence: "new" } });
      returned(l, completed); tick(l);
      expect(l.facts.at(-1)?.kind).toBe("Question");
      expect(foldTask(l.facts).state).toBe("taken");
    }
  });
  it("rejects stale policy and agreement, and never supersedes manual closure", () => {
    const l = report(); tick(l);
    l.add({ taskId: "t", kind: "CompletionEnabled", by: "guardian", payload: { hook: { ...hook, instructions: "Changed" } } }); returned(l, completed); tick(l);
    expect(l.facts.at(-1)?.kind).toBe("Question");
    const closed = report(); tick(closed); closed.add({ taskId: "t", kind: "Cancelled", by: "guardian", payload: {} }); returned(closed, completed);
    expect(tick(closed)).toEqual([]); expect(foldTask(closed.facts).state).toBe("cancelled");
    const a = report(); tick(a); a.add({ taskId: "t", kind: "Prepared", by: "runtime", payload: { workerId: "p", brief: "new", acceptanceCriteria: ["new"], constraints: [] } }); returned(a, completed); tick(a);
    expect(a.facts.at(-1)?.kind).toBe("Question");
  });
  it("explicit adoption preserves old report and worker state; config alone does not migrate", () => {
    const l = report(false); expect(tick(l)).toEqual([]); const before = structuredClone(l.facts);
    l.add({ taskId: "t", kind: "CompletionEnabled", by: "guardian", source: "enable completion", payload: { hook } });
    expect(foldTask(l.facts).latest.seq).toBe(5); expect(hooksOf(foldTask(l.facts)).completion).toEqual(hook);
    expect(l.facts.slice(0, 5)).toEqual(before); tick(l); expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("completion");
  });
  it("configured completion supersedes legacy issue observer; old tasks retain it", () => {
    const watched = report(); watched.facts[0].payload = { ...watched.facts[0].payload, brief: "Handle https://github.com/org/repo/issues/1" };
    expect(issuesToWatch(fold(watched.now(), watched.facts))).toEqual([]);
    const old = report(false); old.facts[0].payload = { ...old.facts[0].payload, brief: "Handle https://github.com/org/repo/issues/1" };
    expect(issuesToWatch(fold(old.now(), old.facts))).toHaveLength(1);
  });
  it("failure retries completion on same report and obeys cap", () => {
    const l = report(); tick(l);
    for (let i = 0; i < config.startCap; i++) {
      const workerId = lastStart(foldTask(l.facts))!.payload.workerId;
      l.add({ taskId: "t", kind: "Failed", by: workerId, payload: { workerId, error: "network" } }); tick(l);
    }
    expect(l.facts.at(-1)?.kind).toBe("Question");
    expect(l.facts.filter(f => f.kind === "Started" && !f.payload.phase)).toHaveLength(1);
  });
  it("completion request for changed work re-prepares before resuming original implementation", () => {
    const l = report(); l.facts[0].payload = { ...l.facts[0].payload, project: { workingDir: "/business", hooks: { completion: hook, prepare: hook } } };
    tick(l); returned(l, { outcome: "rework", reason: "Reviewer requests a revised section" }); tick(l); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("prepare");
    returned(l, { outcome: "prepared", brief: "Revise", acceptanceCriteria: ["Address review"], constraints: [] }); tick(l); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ resumeSessionId: "work-session" });
  });
  it("respects global capacity", () => { const l = report(); expect(tick(l, 1, { ...config, maxWorkers: 0 })).toEqual([]); });
});

describe("completion role protocol", () => {
  it("requires nonempty bounded evidence; no other phase may complete", () => {
    expect(parsePhaseReply(JSON.stringify(completed), "completion").ok).toBe(true);
    for (const phase of ["prepare", "work", "evaluate"] as Phase[]) expect(parsePhaseReply(JSON.stringify(completed), phase).ok).toBe(false);
    for (const result of [{ outcome: "completed", summary: "yes" }, { ...completed, evidence: [] }, { ...completed, evidence: [""] }, { ...completed, extra: true }, { outcome: "accepted", summary: "ready" }]) {
      expect(parsePhaseReply(JSON.stringify(result), "completion").ok).toBe(false);
    }
    expect(replyInstructions("completion")).toContain('"outcome":"completed"');
    expect(replyInstructions("completion")).toContain("NOT to modify external state");
  });
});
