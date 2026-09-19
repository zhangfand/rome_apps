import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { LedgerRepository } from "./ledger.js";

function repository() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE conductor__facts (
      seq integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      id text NOT NULL,
      task_id text NOT NULL,
      kind text NOT NULL,
      by text NOT NULL,
      source text,
      payload text NOT NULL,
      created_at integer NOT NULL
    );
  `);
  return { sqlite, ledger: new LedgerRepository(drizzle(sqlite), "conductor") };
}

const created = (taskId: string) => ({
  taskId,
  kind: "Created" as const,
  by: "guardian",
  source: `create ${taskId}`,
  payload: { brief: taskId },
});

describe("ledger write primitives", () => {
  it("uses the latest seq on one Task as its version without conflicting across Tasks", () => {
    const { sqlite, ledger } = repository();
    const a = ledger.append(created("a"));
    ledger.append(created("b"));
    ledger.append({ taskId: "b", kind: "Event", by: "runtime", payload: { source: "test", type: "changed", summary: "b changed" } });

    const result = ledger.compareAndAppend("a", a.seq, [{
      taskId: "a", kind: "Reply", by: "guardian", source: "continue", payload: { text: "continue" },
    }]);

    expect(result.status).toBe("written");
    expect(result.currentSeq).toBeGreaterThan(a.seq);
    sqlite.close();
  });

  it("returns only the scoped delta when a conditional write is stale", () => {
    const { sqlite, ledger } = repository();
    const first = ledger.append(created("a"));
    const newer = ledger.append({ taskId: "a", kind: "Event", by: "runtime", payload: { source: "test", type: "changed", summary: "new evidence" } });
    ledger.append(created("b"));

    const result = ledger.compareAndAppend("a", first.seq, [{
      taskId: "a", kind: "Reply", by: "guardian", source: "stale", payload: { text: "stale" },
    }]);

    expect(result).toMatchObject({
      status: "conflict",
      taskId: "a",
      expectedSeq: first.seq,
      currentSeq: newer.seq,
    });
    expect(result.status === "conflict" && result.delta.map((fact) => fact.seq)).toEqual([newer.seq]);
    expect(ledger.factsFor("a")).toHaveLength(2);
    sqlite.close();
  });

  it("requires every conditional batch to advance its checked Task", () => {
    const { sqlite, ledger } = repository();
    const a = ledger.append(created("a"));
    expect(() => ledger.compareAndAppend("a", a.seq, [created("child")])).toThrow(/must append a fact/);
    sqlite.close();
  });
});
