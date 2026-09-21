import { describe, expect, it } from "@rstest/core";
import type { FactJson } from "./types.js";
import { workerAgentNames, workerSessions } from "./workers.js";

const fact = (seq: number, kind: string, payload: Record<string, unknown>): FactJson => ({
  seq,
  id: `f-${seq}`,
  taskId: "t-1",
  kind,
  by: "w-1",
  payload,
  createdAt: `2026-09-11T00:00:0${seq}.000Z`,
});

describe("workerSessions", () => {
  it("indexes recorded sessions and lets the newest Opened fact win", () => {
    const sessions = workerSessions([
      fact(1, "Opened", { workerId: "w-1", romeSessionId: "old", sessionType: "action" }),
      fact(2, "Returned", { workerId: "w-1" }),
      fact(3, "Opened", { workerId: "w-1", romeSessionId: "fresh", sessionType: "action" }),
      fact(4, "Opened", { workerId: "w-2", romeSessionId: "second", sessionType: "subagent" }),
    ]);

    expect(sessions.get("w-1")).toEqual({ id: "fresh", type: "action" });
    expect(sessions.get("w-2")).toEqual({ id: "second", type: "subagent" });
  });

  it("ignores incomplete session pointers", () => {
    expect(workerSessions([
      fact(1, "Opened", { workerId: "w-1", romeSessionId: "s" }),
    ]).size).toBe(0);
  });
});

describe("workerAgentNames", () => {
  it("maps worker ids to the concrete agent used for each dispatch", () => {
    const agents = workerAgentNames([
      fact(1, "Dispatched", { workerId: "w-1", agent: "coding:coding" }),
      fact(2, "Dispatched", { workerId: "w-2", agent: "conductor:pm" }),
      fact(3, "Returned", { workerId: "w-1" }),
    ]);

    expect([...agents]).toEqual([
      ["w-1", "coding:coding"],
      ["w-2", "conductor:pm"],
    ]);
  });
});
