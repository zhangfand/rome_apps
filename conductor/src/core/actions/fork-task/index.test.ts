import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { fold } from "../../lib/fold.js";
import { createAction } from "./index.js";

function harness() {
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
  };
  return { sqlite, appContext, calls, ledger: createLedgerRepository(appContext.db as never) };
}

describe("task checkpoint replay", () => {
  it("creates a fresh task with pinned prompt and sanitized seed without copying history", async () => {
    const { sqlite, appContext, calls, ledger } = harness();
    ledger.append({ taskId: "old", kind: "Created", by: "guardian", source: "build it", payload: { brief: "Build it", projectId: "rome", project: { workingDir: "/repo" } } });
    const checkpoint = ledger.append({ taskId: "old", kind: "Reply", by: "guardian", source: "approved", payload: { text: "Prototype approved" } });
    ledger.append({ taskId: "old", kind: "Reply", by: "guardian", source: "secret", payload: { text: "later secret must not copy" } });
    const action = createAction({} as ActionConfig, { appContext } as unknown as AppActionRuntimeDeps);
    const result = await action.execute({
      taskId: "old",
      throughSeq: checkpoint.seq,
      seed: "Prototype approved. Spec: feature/spec.md@abc. No secrets.",
      coordinatorAgent: "conductor:engineer-lead-replay-v1",
      source: "Replay from the approved prototype",
    });
    expect(result.status).toBe("ok");
    const data = result.status === "ok" ? result.data as { taskId: string } : { taskId: "" };
    const replay = fold(new Date(), ledger.all()).tasks.find((task) => task.id === data.taskId)!;
    expect(replay.facts).toHaveLength(1);
    expect(replay.brief).toBe("Build it");
    expect(replay.project).toEqual({ workingDir: "/repo" });
    expect(replay.replay).toMatchObject({
      sourceTaskId: "old",
      sourceThroughSeq: checkpoint.seq,
      coordinatorAgent: "conductor:engineer-lead-replay-v1",
      seed: "Prototype approved. Spec: feature/spec.md@abc. No secrets.",
    });
    expect(JSON.stringify(replay.facts)).not.toContain("later secret");
    expect(calls).toEqual(["conductor:reconcile_tasks"]);
    sqlite.close();
  });

  it("rejects a sequence that is not on the source task", async () => {
    const { sqlite, appContext, ledger } = harness();
    ledger.append({ taskId: "old", kind: "Created", by: "guardian", source: "build it", payload: { brief: "Build it" } });
    const action = createAction({} as ActionConfig, { appContext } as unknown as AppActionRuntimeDeps);
    const result = await action.execute({ taskId: "old", throughSeq: 999, seed: "safe", coordinatorAgent: "conductor:engineer-lead-replay-v1", source: "replay" });
    expect(result).toMatchObject({ status: "error", error: "task old has no fact #999" });
    sqlite.close();
  });
});
