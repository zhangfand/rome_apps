import { describe, expect, it } from "@rstest/core";
import { fetchWorkerPlan, latestWorkerPlan, summarizePlan } from "./worker-plan.js";

const trace = (turnId: string, steps: unknown) => ({
  id: `trace-message:s-1:${turnId}`,
  turnId,
  role: "trace",
  content: "[]",
  traceSummary: { totalSteps: 3, ...(steps === undefined ? {} : { plan: { steps } }) },
});
const message = (turnId: string, role: "user" | "assistant") => ({ id: `${turnId}-${role}`, turnId, role, content: "…" });

describe("latestWorkerPlan", () => {
  it("counts done steps and names the step in progress by its active wording", () => {
    const plan = latestWorkerPlan([
      message("turn-1", "user"),
      trace("turn-1", [
        { text: "Read the code", status: "completed" },
        { text: "Run tests", activeText: "Running tests", status: "in_progress" },
        { text: "Open a pull request", status: "pending" },
      ]),
    ]);

    expect(plan).toEqual({
      steps: [
        { text: "Read the code", status: "completed" },
        { text: "Run tests", activeText: "Running tests", status: "in_progress" },
        { text: "Open a pull request", status: "pending" },
      ],
      done: 1,
      total: 3,
      current: "Running tests",
    });
  });

  it("reads only the newest turn, so an earlier Job's list is never shown", () => {
    const messages = [
      message("turn-1", "user"),
      trace("turn-1", [{ text: "Old job step", status: "completed" }]),
      message("turn-1", "assistant"),
      trace("turn-2", undefined),
    ];

    expect(latestWorkerPlan(messages)).toBeUndefined();
    expect(latestWorkerPlan([...messages.slice(0, 3), trace("turn-2", [{ text: "New step", status: "pending" }])]))
      .toMatchObject({ done: 0, total: 1 });
  });

  it("hides ledger vocabulary and drops malformed steps", () => {
    const plan = latestWorkerPlan([
      trace("turn-1", [
        { text: "Record facts in the ledger", status: "completed" },
        { text: "", status: "pending" },
        { text: "Unknown status", status: "blocked" },
        "not a step",
      ]),
    ]);

    expect(plan?.steps).toEqual([{ text: "Record events in the history", status: "completed" }]);
    expect(plan?.current).toBeUndefined();
  });

  it("returns nothing for sessions without a todo list or unexpected payloads", () => {
    expect(latestWorkerPlan([message("turn-1", "user")])).toBeUndefined();
    expect(latestWorkerPlan({ error: "Session not found" })).toBeUndefined();
    expect(latestWorkerPlan([])).toBeUndefined();
  });
});

describe("summarizePlan", () => {
  it("falls back to the step text when no active wording was given", () => {
    expect(summarizePlan([{ text: "Write the fix", status: "in_progress" }]).current).toBe("Write the fix");
  });
});

describe("fetchWorkerPlan", () => {
  it("reads the session's messages with the guardian's credentials", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify([trace("turn-1", [{ text: "Ship", status: "completed" }])]));
    }) as typeof fetch;

    await expect(fetchWorkerPlan("rome session/1", fetchImpl)).resolves.toMatchObject({ done: 1, total: 1 });
    expect(calls).toEqual([["/api/sessions/rome%20session%2F1/messages", { credentials: "include" }]]);
  });

  it("fails loudly on an unreadable session so the caller can keep the last list", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 404 })) as typeof fetch;
    await expect(fetchWorkerPlan("s-1", fetchImpl)).rejects.toThrow("404");
  });
});
