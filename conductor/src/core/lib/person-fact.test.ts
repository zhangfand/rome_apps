import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { writePersonFact } from "./person-fact.js";

describe("person conditional writes", () => {
  it("returns the intervening Task facts instead of appending from stale state", async () => {
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
    const calls: string[] = [];
    const appContext = {
      db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
      runAction: async (name: string) => { calls.push(name); return { status: "ok" as const }; },
    } as unknown as RomeAppContext;
    const ledger = createLedgerRepository(appContext.db);
    const created = ledger.append({ taskId: "t-1", kind: "Created", by: "guardian", source: "start", payload: { brief: "test" } });
    const event = ledger.append({ taskId: "t-1", kind: "Event", by: "runtime", payload: { source: "ci", type: "finished", summary: "CI finished" } });

    const result = await writePersonFact(appContext, {
      taskId: "t-1",
      kind: "Reply",
      source: "keep going",
      payload: { text: "keep going" },
    }, created.seq);

    expect(result).toMatchObject({
      status: "ok",
      data: {
        status: "conflict",
        scope: "task:t-1",
        expectedSeq: created.seq,
        currentSeq: event.seq,
        delta: [{ seq: event.seq, kind: "Event" }],
      },
    });
    expect(ledger.factsFor("t-1")).toHaveLength(2);
    expect(calls).toEqual([]);
    sqlite.close();
  });
});
