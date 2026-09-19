import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createAction } from "./index.js";

describe("explicit Asked resolution", () => {
  it("persists the exact Asked seq only for a reply declared as its answer", async () => {
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
    const appContext = {
      db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
      runAction: async () => ({ status: "ok" as const }),
    };
    const ledger = createLedgerRepository(appContext.db as never);
    ledger.append({ taskId: "task-1", kind: "Created", by: "guardian", payload: { brief: "Ship it" } });
    const asked = ledger.append({ taskId: "task-1", kind: "Asked", by: "orchestrator", payload: { question: "Choose A or B" } });
    const action = createAction({} as ActionConfig, { appContext } as unknown as AppActionRuntimeDeps);

    const unrelated = await action.execute({
      taskId: "task-1",
      text: "Also update the README",
      source: "Also update the README",
    });
    expect(unrelated.status).toBe("ok");
    expect(ledger.factsFor("task-1").at(-1)?.payload).toEqual({ text: "Also update the README" });

    const answer = await action.execute({
      taskId: "task-1",
      text: "Choose A",
      source: "Choose A",
      resolvesAskedSeq: asked.seq,
    });
    expect(answer.status).toBe("ok");
    expect(ledger.factsFor("task-1").at(-1)?.payload).toEqual({ text: "Choose A", resolvesAskedSeq: asked.seq });

    const duplicate = await action.execute({
      taskId: "task-1",
      text: "Choose B instead",
      source: "Choose B instead",
      resolvesAskedSeq: asked.seq,
    });
    expect(duplicate).toMatchObject({ status: "error", error: expect.stringContaining("already resolved") });
    sqlite.close();
  });
});
