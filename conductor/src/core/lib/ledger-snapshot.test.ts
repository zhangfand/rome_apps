import { describe, expect, it } from "@rstest/core";
import type { Fact } from "./facts.js";
import { foldTask } from "./fold.js";
import {
  buildLedgerSnapshotPrompt,
  coordinatorFacts,
  estimateTokens,
  parseLedgerSnapshotReply,
  shouldSnapshotTask,
  SNAPSHOT_FACT_THRESHOLD,
} from "./ledger-snapshot.js";

const at = (seq: number) => new Date(1_790_000_000_000 + seq * 1_000);
const fact = (seq: number, value: Partial<Fact>): Fact => ({
  seq,
  id: `f-${seq}`,
  taskId: "t-1",
  kind: "Noted",
  by: "orchestrator",
  payload: { note: `note ${seq}` },
  createdAt: at(seq),
  ...value,
} as Fact);

function created(seq = 1): Fact {
  return fact(seq, { kind: "Created", by: "guardian", payload: { brief: "Build it", projectId: "app" } });
}

describe("ledger snapshots", () => {
  it("triggers on a long uncompacted segment and estimates CJK conservatively", () => {
    const facts = [created(), ...Array.from({ length: SNAPSHOT_FACT_THRESHOLD - 1 }, (_, index) => fact(index + 2, {}))];
    expect(shouldSnapshotTask(foldTask(facts))).toBe(true);
    expect(estimateTokens("压缩结果")).toBeGreaterThanOrEqual(4);
  });

  it("builds the next compaction from the previous Snapshot plus only its tail", () => {
    const snapshot = fact(4, {
      kind: "Snapshot",
      by: "conductor:ledger-compactor",
      payload: {
        coversThroughSeq: 3,
        summary: "Current state through three",
        schemaVersion: 1,
        inputFactCount: 3,
        estimatedInputTokens: 20,
      },
    });
    const task = foldTask([created(), fact(2, {}), fact(3, {}), snapshot, fact(5, { kind: "Reply", by: "guardian", payload: { text: "new" } })]);
    const built = buildLedgerSnapshotPrompt(task);
    expect(built.prompt).toContain("Previous Snapshot #4");
    expect(built.prompt).toContain("Current state through three");
    expect(built.prompt).toContain("new");
    expect(built.prompt).not.toContain("note 2");
    expect(built.input.factCount).toBe(1);
  });

  it("gives a new or lagging coordinator the newest Snapshot instead of covered raw facts", () => {
    const snapshot = fact(4, {
      kind: "Snapshot",
      by: "conductor:ledger-compactor",
      payload: {
        coversThroughSeq: 3,
        summary: "Bounded state",
        schemaVersion: 1,
        inputFactCount: 3,
        estimatedInputTokens: 20,
      },
    });
    const task = foldTask([created(), fact(2, {}), fact(3, {}), snapshot, fact(5, { kind: "Reply", by: "guardian", payload: { text: "after" } })]);
    expect(coordinatorFacts(task).facts.map((item) => item.seq)).toEqual([1, 4, 5]);
    expect(coordinatorFacts(task, 2).facts.map((item) => item.seq)).toEqual([1, 4, 5]);
    expect(coordinatorFacts(task, 4).facts.map((item) => item.seq)).toEqual([5]);
  });

  it("uses an externally loaded previous Snapshot body for the next compaction", () => {
    const snapshot = fact(4, {
      kind: "Snapshot",
      by: "conductor:ledger-compactor",
      payload: {
        coversThroughSeq: 3,
        schemaVersion: 2,
        inputFactCount: 3,
        estimatedInputTokens: 20,
        workRepo: {
          repo: "owner/work", path: "_conductor/tasks/t-1/snapshot.md",
          commit: "a".repeat(40), sha256: "b".repeat(64), bytes: 321,
          url: "https://example.test/snapshot",
        },
      },
    });
    const task = foldTask([created(), fact(2, {}), fact(3, {}), snapshot, fact(5, { kind: "Reply", by: "guardian", payload: { text: "new" } })]);
    expect(() => buildLedgerSnapshotPrompt(task)).toThrow(/external artifact was not loaded/);
    const built = buildLedgerSnapshotPrompt(task, "Pinned current state");
    expect(built.prompt).toContain("Pinned current state");
    expect(built.prompt).toContain("new");
    expect(built.prompt).not.toContain("note 2");
  });

  it("parses the bounded fenced result", () => {
    expect(parseLedgerSnapshotReply("```ledger-snapshot\n# State\nReady\n```\n")).toBe("# State\nReady");
  });
});
