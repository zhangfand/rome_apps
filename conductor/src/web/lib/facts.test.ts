import { describe, expect, it } from "@rstest/core";
import { authorLabel, bucketTask, factLabel } from "./facts.js";
import type { FactJson, TaskSummary } from "./types.js";

const item = (kind: string, payload: Record<string, unknown> = {}): FactJson => ({
  seq: 1,
  id: "f-1",
  taskId: "t-1",
  kind,
  by: kind === "Asked" || kind === "Reported" ? "orchestrator" : "person-1",
  payload,
  createdAt: "2026-09-11T00:00:00.000Z",
});

const task = (patch: Partial<TaskSummary> = {}): TaskSummary => ({
  id: "t-1",
  brief: "Do the work",
  createdBy: "person-1",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
  state: "open",
  latest: item("Created"),
  decisionsSinceLastPersonFact: 0,
  factCount: 1,
  ...patch,
});

describe("bucketTask", () => {
  it("puts closed tasks first regardless of other fields", () => {
    expect(bucketTask(task({ state: "completed", liveWorker: { workerId: "w-1", agent: "coding:coding", since: "2026-09-11T00:00:00.000Z" } }))).toBe("closed");
  });

  it("prefers running, then resting, before a prior question or report", () => {
    expect(bucketTask(task({ liveWorker: { workerId: "w-1", agent: "coding:coding", since: "2026-09-11T00:00:00.000Z" }, lastDecision: item("Asked") }))).toBe("running");
    expect(bucketTask(task({ waiting: { reason: "check later", resumeAfter: "2026-09-12T00:00:00.000Z" }, lastDecision: item("Reported") }))).toBe("resting");
  });

  it("recognises questions, reports, and the safety event as needing the person", () => {
    expect(bucketTask(task({ lastDecision: item("Asked") }))).toBe("needs-you");
    expect(bucketTask(task({ lastDecision: item("Reported") }))).toBe("needs-you");
    expect(bucketTask(task({ latest: item("Event", { type: "circuit_breaker" }) }))).toBe("needs-you");
  });

  it("rests an otherwise open task", () => {
    expect(bucketTask(task())).toBe("resting");
  });
});

describe("user-facing label maps", () => {
  it("maps every stored kind to its plain user-facing label", () => {
    expect([
      "Created", "Reply", "Dispatched", "Opened", "Returned", "Waited", "Asked",
      "Reported", "Completed", "Cancelled", "Failed", "Lost", "Event",
    ].map(factLabel)).toEqual([
      "request", "reply", "started work", "session", "came back", "waiting", "question",
      "report", "done", "cancelled", "failed", "lost", "github",
    ]);
  });

  it("maps stored authors to plain roles", () => {
    expect(authorLabel("orchestrator")).toBe("conductor");
    expect(authorLabel("w-12ab34cd")).toBe("worker");
    expect(authorLabel("github:octo")).toBe("github");
    expect(authorLabel("runtime", "Event")).toBe("github");
    expect(authorLabel("guardian-id")).toBe("you");
  });
});
