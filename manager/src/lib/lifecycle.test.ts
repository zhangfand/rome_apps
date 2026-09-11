import { describe, expect, it } from "@rstest/core";
import { parseConfig } from "./config.js";
import { bindProject } from "./projects.js";
import { fold } from "./fold.js";
import { reconcile } from "./reconcile.js";
import { LedgerBuilder } from "./test-facts.js";
import { foldTask } from "./fold.js";
import { lastStart, latestAgreement, parseHooks, phaseAttempts } from "./lifecycle.js";
import { parsePhaseReply, replyInstructions, validateWorkerRun, type WorkerReply } from "./worker-reply.js";
import { applyConfigEdit } from "./config-edit.js";
import { legacyBindingFacts } from "./projects.js";

const hook = { agent: "assistant:assistant", instructions: "Require a reviewable deliverable; never accept a summary alone." };
const parsed = parseConfig({ workingDir: "/srv/project", hooks: { prepare: hook, evaluate: hook } });
if (!parsed.ok) throw new Error(parsed.error);
const config = parsed.config;
function fresh() {
  return new LedgerBuilder().add({ taskId: "t1", kind: "Created", by: "guardian", source: "Add page X", payload: { brief: "Add page X", ...bindProject(config, "default") } });
}
function step(l: LedgerBuilder) {
  return reconcile({ snapshot: fold(l.now(), l.facts), config, judge: () => ({ done: true }), newWorkerId: () => `w${l.facts.length}` });
}
function tick(l: LedgerBuilder, minutes = 1) {
  const actions = reconcile({ snapshot: fold(l.now(minutes), l.facts), config, judge: () => ({ done: true }), newWorkerId: () => `w${l.facts.length}` });
  for (const action of actions) if (action.type === "append") l.add(action.fact, 0);
  return actions;
}
function returned(l: LedgerBuilder, result: WorkerReply, sessionId?: string) {
  const workerId = lastStart(foldTask(l.facts))!.payload.workerId;
  l.add({ taskId: "t1", kind: "Returned", by: workerId, payload: { workerId, reply: JSON.stringify(result), result, sessionId } }, 0);
}
const prepared: WorkerReply = { outcome: "prepared", brief: "Add page X under Y", acceptanceCriteria: ["Page resolves under Y", "Deliver reviewable changes"], constraints: ["Do not deploy"], completionCondition: "Human approval" };
const ready: WorkerReply = { outcome: "ready", summary: "Files edited, still uncommitted" };
function workSubmitted() {
  const l = fresh(); tick(l); returned(l, prepared, "prepare-session"); tick(l); tick(l);
  returned(l, ready, "work-session");
  return l;
}

describe("user-defined lifecycle", () => {
  it("pins configured hooks at intake", () => {
    expect(bindProject(config, "default").project.hooks).toEqual({ prepare: hook, evaluate: hook });
  });
  it("prepares a new task before executing", () => {
    const started = step(fresh()).find((a) => a.type === "append" && a.fact.kind === "Started");
    expect(started?.type === "append" && started.fact.payload.phase).toBe("prepare");
  });
  it("rejects malformed user hook configuration", () => {
    expect(parseConfig({ workingDir: "/srv/project", hooks: { evaluate: { agent: "bad", instructions: "" } } }).ok).toBe(false);
  });
  it("records an agreement before starting work and includes it in the worker prompt", () => {
    const l = fresh(); tick(l); returned(l, prepared, "prepare-session"); tick(l);
    expect(l.facts.at(-1)?.kind).toBe("Prepared");
    tick(l);
    const start = lastStart(foldTask(l.facts))!;
    expect(start.payload.phase).toBeUndefined();
    expect(start.payload.resumeSessionId).toBeUndefined();
    expect(start.payload.prompt).toContain("Page resolves under Y");
    expect(start.payload.prompt).toContain("Do not deploy");
  });
  it("does not report an implementation merely because it returned ready", () => {
    const l = workSubmitted(); tick(l);
    expect(l.facts.some((f) => f.kind === "Report")).toBe(false);
    const start = lastStart(foldTask(l.facts))!;
    expect(start.payload.phase).toBe("evaluate");
    expect(start.payload.hook).toEqual(hook);
    expect(start.payload.assessment?.submissionSeq).toBe(l.facts.findLast((f) => f.kind === "Returned")?.seq);
    expect(start.payload.prompt).toContain("still uncommitted");
    expect(start.payload.resumeSessionId).toBeUndefined();
  });
  it("returns specific evaluation feedback to the original work session", () => {
    const l = workSubmitted(); tick(l);
    returned(l, { outcome: "rework", reason: "Publish the requested reviewable deliverable" }, "evaluate-session");
    tick(l); expect(l.facts.at(-1)?.kind).toBe("Rework"); tick(l);
    const start = lastStart(foldTask(l.facts))!;
    expect(start.payload.phase).toBeUndefined();
    expect(start.payload.resumeSessionId).toBe("work-session");
    expect(start.payload.prompt).toContain("Publish the requested reviewable deliverable");
  });
  it("reports acceptance without completing the task and preserves submitted links", () => {
    const l = workSubmitted(); tick(l); returned(l, { outcome: "accepted", summary: "Requirements verified; result ready for review" }); tick(l);
    const task = foldTask(l.facts);
    expect(task.state).toBe("taken"); expect(task.position).toBe("reported");
    expect(task.latest.payload.what).toContain("still uncommitted");
    expect(task.latest.payload.evidence).toContain("submission #");
    expect(tick(l)).toEqual([]);
  });
  it("waiting rechecks the same evaluation and submission, not the implementation", () => {
    const l = workSubmitted(); tick(l);
    const context = lastStart(foldTask(l.facts))!.payload.assessment;
    returned(l, { outcome: "waiting", reason: "Evidence pending", revisitAfterSeconds: 300 }); tick(l);
    expect(foldTask(l.facts).position).toBe("waiting"); expect(tick(l)).toEqual([]);
    tick(l, 6);
    expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("evaluate");
    expect(lastStart(foldTask(l.facts))!.payload.assessment).toEqual(context);
  });
  it("preparation can ask for input and a reply starts preparation again", () => {
    const l = fresh(); tick(l); returned(l, { outcome: "blocked", question: "What should page X contain?" }); tick(l);
    expect(foldTask(l.facts).position).toBe("stuck");
    l.add({ taskId: "t1", kind: "Reply", by: "guardian", source: "A list", payload: { text: "Show the product list" } }); tick(l);
    expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("prepare");
    expect(lastStart(foldTask(l.facts))!.payload.prompt).toContain("Show the product list");
  });
  it("bounds repair cycles without charging preparation/evaluation against the work budget", () => {
    const l = workSubmitted(); tick(l); returned(l, { outcome: "rework", reason: "Missing evidence" }); tick(l); tick(l);
    returned(l, ready); tick(l); returned(l, { outcome: "rework", reason: "Still missing evidence" }); tick(l); tick(l);
    expect(foldTask(l.facts).position).toBe("stuck");
    expect(phaseAttempts(foldTask(l.facts), "work")).toBe(2);
    expect(l.facts.at(-1)?.payload.why).toContain("Still missing evidence");
  });
  it("retries a crashed evaluator in the same phase with the same submission", () => {
    const l = workSubmitted(); tick(l);
    const previous = lastStart(foldTask(l.facts))!;
    l.add({ taskId: "t1", kind: "Failed", by: previous.payload.workerId, payload: { workerId: previous.payload.workerId, error: "network" } }); tick(l);
    const next = lastStart(foldTask(l.facts))!;
    expect(next.payload.phase).toBe("evaluate"); expect(next.payload.assessment).toEqual(previous.payload.assessment);
  });
  it("never accepts stale evidence against a newer agreement", () => {
    const l = workSubmitted(); tick(l);
    l.add({ taskId: "t1", kind: "Prepared", by: "runtime", payload: { workerId: "other", brief: "new agreement", acceptanceCriteria: ["changed requirement"], constraints: [] } });
    returned(l, { outcome: "accepted", summary: "Old requirement satisfied" }); tick(l);
    expect(foldTask(l.facts).position).toBe("stuck"); expect(l.facts.some((f) => f.kind === "Report")).toBe(false);
  });
  it("never applies newly configured hooks to a legacy task", () => {
    const l = new LedgerBuilder().add({ taskId: "t1", kind: "Created", by: "guardian", payload: { brief: "legacy" } });
    tick(l); expect(lastStart(foldTask(l.facts))!.payload.phase).toBeUndefined();
    returned(l, ready); tick(l); expect(foldTask(l.facts).position).toBe("reported");
    expect(legacyBindingFacts(l.facts, config)[0]?.payload.project.hooks).toBeUndefined();
  });
  it("snapshots independent project overrides and explicit disabling", () => {
    const p = parseConfig({ hooks: { prepare: hook, evaluate: hook }, projects: {
      a: { workingDir: "/a", hooks: { prepare: null } }, b: { workingDir: "/b" },
    } });
    if (!p.ok) throw new Error(p.error);
    const binding = bindProject(p.config, "a");
    expect(binding.project.hooks).toEqual({ prepare: null, evaluate: hook });
    p.config.hooks!.evaluate!.instructions = "Changed later";
    expect(binding.project.hooks?.evaluate?.instructions).toBe(hook.instructions);
  });
  it("can configure evaluation alone", () => {
    const l = fresh(); l.facts[0].payload.project.hooks.prepare = null;
    tick(l); expect(lastStart(foldTask(l.facts))!.payload.phase).toBeUndefined();
    returned(l, ready); tick(l); expect(lastStart(foldTask(l.facts))!.payload.phase).toBe("evaluate");
    expect(lastStart(foldTask(l.facts))!.payload.assessment?.agreementSeq).toBeUndefined();
  });
  it("does not start assessment without capacity", () => {
    const l = workSubmitted();
    const actions = reconcile({ snapshot: fold(l.now(), l.facts), config: { ...config, maxWorkers: 0 }, judge: () => ({ done: true }), newWorkerId: () => "unused" });
    expect(actions).toEqual([]); expect(latestAgreement(foldTask(l.facts))).toBeDefined();
  });
  it("strictly validates configuration through the settings editor", () => {
    expect(applyConfigEdit(config, { hooks: { evaluate: null } }).hooks).toEqual({ evaluate: null });
    for (const value of [null, [], { other: hook }, { evaluate: { ...hook, instructions: " " } }, { prepare: { ...hook, canComplete: true } }]) {
      expect(() => parseHooks(value)).toThrow();
    }
  });
});

describe("phase-bound result protocols", () => {
  it("only accepts the declared phase's outcomes", () => {
    expect(parsePhaseReply(JSON.stringify(prepared), "prepare").ok).toBe(true);
    expect(parsePhaseReply(JSON.stringify(prepared), "work").ok).toBe(false);
    expect(parsePhaseReply(JSON.stringify(ready), "evaluate").ok).toBe(false);
    expect(parsePhaseReply('{"outcome":"accepted","summary":"ok"}', "work").ok).toBe(false);
    expect(parsePhaseReply('{"outcome":"complete","summary":"ok"}', "evaluate").ok).toBe(false);
    expect(parsePhaseReply(JSON.stringify({ ...prepared, acceptanceCriteria: [] }), "prepare").ok).toBe(false);
    expect(parsePhaseReply(JSON.stringify({ ...prepared, unexpected: "rule" }), "prepare").ok).toBe(false);
  });
  it("repairs format once using the pinned phase's protocol", async () => {
    const result = await validateWorkerRun({ ok: true, reply: "looks good", sessionId: "s" }, async (prompt) => {
      expect(prompt).toContain("evaluate reply protocol");
      return { ok: true, reply: '{"outcome":"accepted","summary":"Evidence checked"}', sessionId: "s" };
    }, "evaluate");
    expect(result).toMatchObject({ ok: true, result: { outcome: "accepted" } });
  });
  it("has no built-in developer acceptance policy", () => {
    for (const phase of ["prepare", "evaluate"] as const) expect(replyInstructions(phase)).not.toMatch(/GitHub|pull request|PR|issue closed/);
  });
});
