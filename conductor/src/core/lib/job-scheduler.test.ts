import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { RomeAppContext } from "@rome-os/app-runtime";
import type { CoreComposition } from "./composition.js";
import type { ConductorConfig } from "./config.js";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createRuntimeControlRepository } from "../db/repositories/runtime-control.js";
import type { Fact, NewFact } from "./facts.js";
import { foldTask } from "./fold.js";
import { dispatchPendingJobs, reusableWorkerForAgent } from "./job-scheduler.js";

let seq = 0;
function fact(value: NewFact): Fact {
  return { ...value, seq: ++seq, id: `f-${seq}`, createdAt: new Date(seq * 1000) } as Fact;
}

describe("Job scheduler session selection", () => {
  it("reuses the newest cleanly returned session for the same logical agent", () => {
    const taskId = "t-1";
    const task = foldTask([
      fact({ taskId, kind: "Created", by: "person", payload: { brief: "ship it" } }),
      fact({ taskId, kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "one", prompt: "one" } }),
      fact({ taskId, kind: "Returned", by: "w-1", payload: { jobId: "j-1", workerId: "w-1", status: "succeeded", summary: "one", sessionId: "s-1" } }),
      fact({ taskId, kind: "Dispatched", by: "runtime", payload: { jobId: "j-2", workerId: "w-2", agent: "assistant:assistant", instructions: "two", prompt: "two" } }),
      fact({ taskId, kind: "Returned", by: "w-2", payload: { jobId: "j-2", workerId: "w-2", status: "succeeded", summary: "two", sessionId: "s-2" } }),
    ]);

    expect(reusableWorkerForAgent(task, "coding:coding")).toBe("w-1");
    expect(reusableWorkerForAgent(task, "assistant:assistant")).toBe("w-2");
    expect(reusableWorkerForAgent(task, "conductor:pm")).toBeUndefined();
  });

  it("does not reuse a failed or lost run", () => {
    const taskId = "t-2";
    const task = foldTask([
      fact({ taskId, kind: "Created", by: "person", payload: { brief: "ship it" } }),
      fact({ taskId, kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "one", prompt: "one" } }),
      fact({ taskId, kind: "Failed", by: "w-1", payload: { jobId: "j-1", workerId: "w-1", error: "boom", sessionId: "s-1" } }),
    ]);

    expect(reusableWorkerForAgent(task, "coding:coding")).toBeUndefined();
  });
});

describe("Job scheduler runtime pause", () => {
  it("leaves queued Jobs pending without preparing a workspace or starting a worker", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE conductor__facts (seq integer PRIMARY KEY AUTOINCREMENT NOT NULL, id text NOT NULL, task_id text NOT NULL, kind text NOT NULL, by text NOT NULL, source text, payload text NOT NULL, created_at integer NOT NULL);
      CREATE TABLE conductor__config (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL);
      CREATE TABLE conductor__locks (name text PRIMARY KEY NOT NULL, held_until integer NOT NULL);
    `);
    let preparations = 0;
    let runs = 0;
    const appContext = {
      db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
      runAction: async () => { runs += 1; return { status: "ok" as const, data: {} }; },
    } as unknown as RomeAppContext;
    const ledger = createLedgerRepository(appContext.db);
    const created = ledger.append({
      taskId: "t-1", kind: "Created", by: "person",
      payload: { brief: "debug me", projectId: "app", project: { workspace: "none" } },
    });
    ledger.append({
      taskId: "t-1", kind: "JobCreated", by: "orchestrator",
      payload: { jobId: "j-1", agent: "coding:coding", instructions: "work" },
    });
    createRuntimeControlRepository(appContext.db).setPaused(true);
    const composition = {
      defaultWorkspaceKind: "none",
      providerFor: () => ({
        kind: "none",
        prepare: async () => { preparations += 1; return { kind: "none" as const }; },
        instructions: () => "",
        note: () => "",
      }),
    } as unknown as CoreComposition;
    const config = {
      projects: { app: { workspace: "none" } }, sop: "sop",
      workerAgents: { "coding:coding": "code" }, orchestratorAgent: "conductor:engineer-lead",
      maxWorkers: 3, intervalMinutes: 5, reuseSessions: true, maxDecisionsPerTurn: 25,
    } as ConductorConfig;

    const outcome = await dispatchPendingJobs({ appContext, composition, config });

    expect(outcome).toEqual({
      dispatched: [], failed: [], pending: [{ taskId: "t-1", jobId: "j-1" }], skipped: "runtime paused",
    });
    expect(preparations).toBe(0);
    expect(runs).toBe(0);
    expect(ledger.factsFor("t-1").map((item) => item.kind)).toEqual(["Created", "JobCreated"]);
    expect(created.seq).toBe(1);
    sqlite.close();
  });
});
