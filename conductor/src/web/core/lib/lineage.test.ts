import { describe, expect, it } from "@rstest/core";
import {
  artifactHref,
  childActivity,
  childGroup,
  childrenOf,
  groupChildren,
  planItemLabel,
  rollup,
  rollupCounts,
  waitingOnChildren,
} from "./lineage.js";
import type { FactJson, TaskSummary } from "./types.js";

const fact = (kind: string, payload: Record<string, unknown> = {}, seq = 1): FactJson => ({
  seq,
  id: `f-${seq}`,
  taskId: "t-child",
  kind,
  by: kind === "Asked" || kind === "Reported" || kind === "ACK" ? "orchestrator" : "person-1",
  payload,
  createdAt: "2026-09-30T00:00:00.000Z",
});

const task = (id: string, patch: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  brief: `Brief for ${id}`,
  createdBy: "orchestrator",
  createdAt: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-09-30T00:00:00.000Z",
  state: "open",
  latest: fact("Created", { brief: `Brief for ${id}` }),
  decisionsSinceLastPersonFact: 0,
  factCount: 1,
  usageSessions: [],
  ...patch,
});

const child = (id: string, planItemId: string, patch: Partial<TaskSummary> = {}) =>
  task(id, { parent: { taskId: "t-parent", planItemId }, ...patch });

const running = (id: string, planItemId: string) => child(id, planItemId, {
  liveWorker: { workerId: "w-1", agent: "conductor:coder", since: "2026-09-30T00:00:00.000Z" },
});
const needsYou = (id: string, planItemId: string) => child(id, planItemId, {
  lastDecision: fact("Asked", { question: "Which workspace owns the app manifest?" }),
  decisionsSinceLastPersonFact: 1,
});
const done = (id: string, planItemId: string, state: "completed" | "cancelled" = "completed") => child(id, planItemId, { state });

describe("childrenOf", () => {
  it("returns only direct children, in the order the lead created them", () => {
    const tasks = [
      child("t-b", "second", { createdAt: "2026-09-30T00:02:00.000Z" }),
      task("t-parent"),
      child("t-a", "first", { createdAt: "2026-09-30T00:01:00.000Z" }),
      task("t-grandchild", { parent: { taskId: "t-a", planItemId: "nested" } }),
      task("t-unrelated"),
    ];
    expect(childrenOf(tasks, "t-parent").map((item) => item.id)).toEqual(["t-a", "t-b"]);
    expect(childrenOf(tasks, "t-a").map((item) => item.id)).toEqual(["t-grandchild"]);
    expect(childrenOf(tasks, "t-unrelated")).toEqual([]);
  });
});

describe("child groups", () => {
  it("uses the board's own groups, with closed Tasks as done", () => {
    expect(childGroup(needsYou("t-1", "a"))).toBe("needs-you");
    expect(childGroup(running("t-2", "b"))).toBe("running");
    expect(childGroup(child("t-3", "c"))).toBe("resting");
    expect(childGroup(done("t-4", "d", "cancelled"))).toBe("done");
  });

  it("groups and counts children, listing only groups that have one", () => {
    const children = [needsYou("t-1", "a"), running("t-2", "b"), done("t-3", "c"), done("t-4", "d", "cancelled")];
    const groups = groupChildren(children);
    expect(groups.done.map((item) => item.id)).toEqual(["t-3", "t-4"]);
    expect(groups.resting).toEqual([]);
    const summary = rollup(children);
    expect(summary).toEqual({ total: 4, open: 2, counts: { "needs-you": 1, running: 1, resting: 0, done: 2 } });
    expect(rollupCounts(summary)).toBe("1 needs you · 1 running · 2 done");
  });
});

describe("waitingOnChildren", () => {
  it("sums up the open children a parent is waiting on", () => {
    expect(waitingOnChildren([running("t-1", "a"), needsYou("t-2", "b"), done("t-3", "c")]))
      .toBe("Waiting on 2 of the 3 tasks it started: 1 needs you, 1 running.");
    expect(waitingOnChildren([running("t-1", "a"), child("t-2", "b")]))
      .toBe("Waiting on the 2 tasks it started: 1 running, 1 resting.");
    expect(waitingOnChildren([running("t-1", "a")])).toBe("Waiting on the task it started: 1 running.");
  });

  it("says nothing once every child has finished, or when there are none", () => {
    expect(waitingOnChildren([done("t-1", "a"), done("t-2", "b", "cancelled")])).toBeUndefined();
    expect(waitingOnChildren([])).toBeUndefined();
  });
});

describe("childActivity", () => {
  it("shows the question for a child that needs the person", () => {
    expect(childActivity(needsYou("t-1", "a"))).toBe("Which workspace owns the app manifest?");
  });

  it("distinguishes a queued child from one whose worker is running", () => {
    expect(childActivity(child("t-1", "a", { pendingJob: { jobId: "j-1", agent: "conductor:coder", since: "2026-09-30T00:00:00.000Z" } })))
      .toBe("Queued for the next free worker.");
    expect(childActivity(running("t-2", "b"))).toBe("Working on it.");
  });

  it("falls back to the child's latest news", () => {
    expect(childActivity(child("t-1", "a", { latest: fact("Returned", { status: "succeeded", summary: "Opened PR #12" }, 4) })))
      .toContain("Opened PR #12");
  });
});

describe("lineage labels and links", () => {
  it("labels a child by its plan item and nothing else", () => {
    expect(planItemLabel(child("t-1", "slack-oauth-t1"))).toBe("slack-oauth-t1");
    expect(planItemLabel(task("t-2"))).toBeUndefined();
  });

  it("links only absolute URLs without a domain resolver", () => {
    const item = child("t-1", "a");
    expect(artifactHref(" https://example.com/spec.md ", item)).toBe("https://example.com/spec.md");
    expect(artifactHref("pi-llm-provider/spec.md@0ee9e18e", item)).toBeUndefined();
    expect(artifactHref("javascript:alert(1)", item)).toBeUndefined();
  });
});
