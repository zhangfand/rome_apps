import { describe, expect, it } from "@rstest/core";
import { LedgerBuilder } from "./test-facts.js";
import { parseConfig } from "./config.js";
import { fold, foldTask } from "./fold.js";
import { hooksOf, lastStart } from "./lifecycle.js";
import { reassessmentFact } from "./reassessment.js";
import { reconcile } from "./reconcile.js";
import type { WorkerReply } from "./worker-reply.js";
const hook = { agent: "assistant:assistant", instructions: "Check actual delivery" };
const parsed = parseConfig({ workingDir: "/new", projects: { p: { workingDir: "/new", repo: "org/new" } }, hooks: { prepare: hook, evaluate: hook } });
if (!parsed.ok) throw new Error(parsed.error);
const config = parsed.config;
function old() { return new LedgerBuilder()
  .add({ taskId: "t", kind: "Created", by: "guardian", payload: { brief: "Build page", projectId: "p", project: { workingDir: "/old", repo: "org/old" } } })
  .add({ taskId: "t", kind: "Taken", by: "runtime", payload: {} })
  .add({ taskId: "t", kind: "Started", by: "runtime", payload: { workerId: "old", prompt: "Build" } })
  .add({ taskId: "t", kind: "Returned", by: "old", payload: { workerId: "old", sessionId: "old-work-session", reply: "Files uncommitted", result: { outcome: "ready", summary: "Files uncommitted" } } })
  .add({ taskId: "t", kind: "Report", by: "runtime", payload: { what: "Files uncommitted", evidence: "old" } }); }
function adopt(l: LedgerBuilder) { l.add(reassessmentFact(foldTask(l.facts), 5, config, "guardian", "backfill existing other results")); }
function tick(l: LedgerBuilder, minutes = 1) {
  const actions = reconcile({ snapshot: fold(l.now(minutes), l.facts), config, judge: () => ({ done: true }), newWorkerId: () => `w${l.facts.length}` });
  for (const a of actions) if (a.type === "append") l.add(a.fact, 0);
  return actions;
}
function result(l: LedgerBuilder, reply: WorkerReply) { const workerId = lastStart(foldTask(l.facts))!.payload.workerId;
  l.add({ taskId: "t", kind: "Returned", by: workerId, payload: { workerId, reply: JSON.stringify(reply), result: reply, sessionId: `session-${workerId}` } }, 0); }
function prepared(l: LedgerBuilder) { result(l, { outcome: "prepared", brief: "Page", acceptanceCriteria: ["Publish PR"], constraints: [] }); tick(l); tick(l); }

describe("explicit historical reassessment", () => {
  it("snapshots only hooks, retaining history and source; later config cannot rewrite adoption", () => {
    const l = old(); const before = structuredClone(l.facts); adopt(l);
    expect(l.facts.slice(0, before.length)).toEqual(before);
    expect(hooksOf(foldTask(l.facts))).toEqual(config.hooks);
    expect(hooksOf(foldTask(l.facts))).not.toBe(config.hooks);
    expect(foldTask(l.facts).project).toEqual({ workingDir: "/old", repo: "org/old" });
  });
  it("runs prepare then evaluates old submission without implementation, accepted reports but never completes", () => {
    const l = old(); adopt(l); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ phase: "prepare", assessment: { submissionSeq: 4 } });
    prepared(l);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ phase: "evaluate", assessment: { submissionSeq: 4 } });
    expect(lastStart(foldTask(l.facts))!.payload.prompt).toContain("NOT external resource identifiers");
    expect(lastStart(foldTask(l.facts))!.payload.prompt).toContain("Apply its supersession rules");
    expect(lastStart(foldTask(l.facts))!.payload.prompt).toContain("do not silently turn final completion into a delivery prerequisite");
    result(l, { outcome: "accepted", summary: "Verified artifact" }); tick(l);
    expect(l.facts.at(-1)).toMatchObject({ kind: "Report", payload: { what: expect.stringContaining("Files uncommitted") } });
    expect(l.facts.filter(f => f.kind === "Started" && !f.payload.phase)).toHaveLength(1);
    expect(foldTask(l.facts).state).toBe("taken");
  });
  it("rework alone resumes original work session, using adopted hooks for the new submission", () => {
    const l = old(); adopt(l); tick(l); prepared(l);
    result(l, { outcome: "rework", reason: "Missing PR" }); tick(l); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ resumeSessionId: "old-work-session" });
    expect(lastStart(foldTask(l.facts))!.payload.phase).toBeUndefined();
    result(l, { outcome: "ready", summary: "PR published" }); const seq = l.facts.at(-1)!.seq; tick(l);
    expect(lastStart(foldTask(l.facts))!.payload.assessment?.submissionSeq).toBe(seq);
  });
  it("wait retries assessment of same old submission", () => {
    const l = old(); adopt(l); tick(l); prepared(l);
    result(l, { outcome: "waiting", reason: "CI pending", revisitAfterSeconds: 300 }); tick(l); tick(l, 10);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ phase: "evaluate", assessment: { submissionSeq: 4 } });
  });
  it("later human steering invalidates permission to assess historical submission", () => {
    const l = old(); adopt(l); tick(l); prepared(l);
    l.add({ taskId: "t", kind: "Reply", by: "guardian", payload: { text: "New scope" } });
    result(l, { outcome: "accepted", summary: "Stale" }); tick(l);
    expect(l.facts.at(-1)?.kind).toBe("Question");
  });
  it("evaluate-only adoption skips prepare", () => {
    const l = old(); l.add(reassessmentFact(foldTask(l.facts), 5, { ...config, hooks: { evaluate: hook } }, "guardian", "backfill")); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload).toMatchObject({ phase: "evaluate", assessment: { submissionSeq: 4 } });
  });
  it("rejects stale reports, closed/running tasks, missing evaluator and missing submission", () => {
    const l = old(); const t = foldTask(l.facts);
    expect(() => reassessmentFact(t, 99, config, "guardian", "backfill")).toThrow();
    expect(() => reassessmentFact({ ...t, state: "completed" }, 5, config, "guardian", "backfill")).toThrow();
    expect(() => reassessmentFact({ ...t, liveWorker: { workerId: "x", startedAt: new Date(), startedSeq: 3 } }, 5, config, "guardian", "backfill")).toThrow();
    expect(() => reassessmentFact(t, 5, { ...config, hooks: {} }, "guardian", "backfill")).toThrow();
    expect(() => reassessmentFact({ ...t, facts: t.facts.filter(f => f.kind !== "Returned") }, 5, config, "guardian", "backfill")).toThrow();
  });
  it("unselected old reports remain inert even when global hooks are enabled", () => {
    const l = old(); expect(tick(l)).toEqual([]); expect(hooksOf(foldTask(l.facts))).toEqual({});
  });
});
