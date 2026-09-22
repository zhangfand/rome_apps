import { describe, expect, it } from "@rstest/core";
import { archivedSnapshotMarkdown } from "./task-snapshot-artifact.js";

describe("archived Task ledger Snapshot", () => {
  it("is a self-describing runtime-owned Markdown mirror", () => {
    const value = archivedSnapshotMarkdown({
      taskId: "t-1",
      brief: "Ship it",
      coversThroughSeq: 42,
      generatedAt: new Date("2026-09-22T04:00:00.000Z"),
      summary: "## Current state\nReady.",
    });
    expect(value).toContain("taskId: t-1");
    expect(value).toContain("coversThroughSeq: 42");
    expect(value).toContain("# Task ledger snapshot: Ship it");
    expect(value).toContain("append-only Task ledger remains authoritative");
    expect(value).toContain("## Current state\nReady.");
  });
});
