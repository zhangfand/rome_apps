import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { fold } from "../../lib/fold.js";
import { createAction } from "./index.js";

describe("engineering lead task materialization", () => {
  it("creates a runnable batch with lineage and keeps a stable plan item idempotent", async () => {
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
    const runActionCalls: string[] = [];
    const appContext = {
      db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
      runAction: async (name: string) => { runActionCalls.push(name); return { status: "ok" as const }; },
    };
    const ledger = createLedgerRepository(appContext.db as never);
    const created = ledger.append({
      taskId: "parent",
      kind: "Created",
      by: "person",
      source: "build it",
      payload: { brief: "deliver feature", projectId: "app", project: { workingDir: "/repo" }, replay: {
        sourceTaskId: "source", sourceThroughSeq: 9, coordinatorAgent: "conductor:engineer-lead-replay-v1",
        seed: "approved prototype", workRepoPath: "_experiments/replays/parent/technical-spec.md",
      } },
    });
    const action = createAction({} as ActionConfig, { appContext } as unknown as AppActionRuntimeDeps);

    const first = await action.execute({
      taskId: "parent",
      seenSeq: created.seq,
      note: "These two slices are independent and runnable.",
      tasks: [
        { planItemId: "api", brief: "Deliver the API slice.", specRef: "feature/spec.md", planRef: "feature/engineering-plan.md" },
        { planItemId: "ui", brief: "Deliver the UI slice.", specRef: "feature/spec.md", planRef: "feature/engineering-plan.md" },
      ],
    });
    expect(first.status).toBe("ok");
    const snapshot = fold(new Date(), ledger.all());
    const parent = snapshot.tasks.find((task) => task.id === "parent")!;
    const children = snapshot.tasks.filter((task) => task.parent?.taskId === "parent");
    expect(children.map((task) => task.parent?.planItemId).sort()).toEqual(["api", "ui"]);
    expect(children[0].project).toEqual({ workingDir: "/repo" });
    expect(children[0].parent?.coordinatorAgent).toBe("conductor:engineer-lead-replay-v1");
    expect(parent.lastDecision?.kind).toBe("Noted");
    expect(runActionCalls).toEqual(["conductor:reconcile_tasks"]);

    const second = await action.execute({
      taskId: "parent",
      seenSeq: parent.latest.seq,
      note: "The API item already exists; only materialize the new verifier.",
      tasks: [
        { planItemId: "api", brief: "Do not duplicate this." },
        { planItemId: "verify", brief: "Verify the integrated result." },
      ],
    });
    expect(second.status).toBe("ok");
    const after = fold(new Date(), ledger.all()).tasks.filter((task) => task.parent?.taskId === "parent");
    expect(after.map((task) => task.parent?.planItemId).sort()).toEqual(["api", "ui", "verify"]);
    sqlite.close();
  });
});
