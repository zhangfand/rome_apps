import { describe, expect, it } from "@rstest/core";
import type { TaskSummary } from "./types.js";
import { aggregateTaskUsage, formatCost, formatTokens, usageSessionIds } from "./task-usage.js";

const task = {
  id: "t-1",
  usageSessions: [
    { id: "coordinator", type: "action", role: "coordinator", firstSeenAt: "2026-09-19T00:00:00Z" },
    { id: "worker", type: "action", role: "worker", firstSeenAt: "2026-09-19T00:01:00Z" },
    { id: "worker", type: "action", role: "worker", firstSeenAt: "2026-09-19T00:02:00Z" },
  ],
} as TaskSummary;

describe("task token usage", () => {
  it("deduplicates sessions and preserves coordinator versus worker breakdowns", () => {
    const sessions = new Map([
      ["coordinator", record("coordinator", 100, 20, 300, 10, 0.04, 2)],
      ["worker", record("worker", 200, 40, 500, 20, 0.08, 3)],
    ]);
    const usage = aggregateTaskUsage(task, sessions);
    expect(usage).toMatchObject({
      inputTokens: 300,
      outputTokens: 60,
      cacheReadTokens: 800,
      cacheWriteTokens: 30,
      totalTokens: 1_190,
      costUsd: 0.12,
      runCount: 5,
      sessionCount: 2,
      loadedSessionCount: 2,
      coordinator: { totalTokens: 430, sessionCount: 1 },
      workers: { totalTokens: 760, sessionCount: 1 },
    });
  });

  it("collects a stable unique id list and formats readable values", () => {
    expect(usageSessionIds([task, { ...task, id: "t-2" }])).toEqual(["coordinator", "worker"]);
    expect(formatTokens(12_300, true)).toMatch(/12(?:[.,]3)?K/i);
    expect(formatCost(0.004)).toBe("<$0.01");
    expect(formatCost(undefined)).toBe("—");
  });
});

function record(id: string, input: number, output: number, read: number, write: number, cost: number, runCount: number) {
  return {
    id,
    stats: {
      runCount,
      usage: {
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: read,
        cacheWriteTokens: write,
        totalTokens: input + output + read + write,
        costUsd: cost,
      },
    },
  };
}
