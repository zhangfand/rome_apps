import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import type { CoreComposition } from "../../lib/composition.js";
import type { ConductorConfig } from "../../lib/config.js";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createAgentInstanceRepository } from "../../db/repositories/agent-instances.js";
import { coordinatorWakeMissedFact, createAction } from "./index.js";

describe("coordinator wake observations", () => {
  it("records a summon failure as unseen runtime evidence, not an orchestrator decision", () => {
    const fact = coordinatorWakeMissedFact("t-1", { error: "summon unavailable" });

    expect(fact).toMatchObject({
      taskId: "t-1",
      kind: "Event",
      by: "runtime",
      payload: {
        source: "runtime",
        type: "coordinator_wake_failed",
        data: { error: "summon unavailable" },
      },
    });
  });

  it("keeps a coordinator reply observable without claiming the coordinator decided", () => {
    const fact = coordinatorWakeMissedFact("t-1", { reply: "I would ask the person." });

    expect(fact).toMatchObject({
      kind: "Event",
      by: "runtime",
      payload: {
        type: "coordinator_no_decision",
        data: { reply: "I would ask the person." },
      },
    });
  });

  it("reuses one Agent Instance and Agent Session while delivering only new Task facts", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE conductor__facts (
        seq integer PRIMARY KEY AUTOINCREMENT NOT NULL, id text NOT NULL,
        task_id text NOT NULL, kind text NOT NULL, by text NOT NULL,
        source text, payload text NOT NULL, created_at integer NOT NULL
      );
      CREATE TABLE conductor__config (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL);
      CREATE TABLE conductor__locks (name text PRIMARY KEY NOT NULL, held_until integer NOT NULL);
      CREATE TABLE conductor__task_sessions (
        id text PRIMARY KEY NOT NULL, task_id text NOT NULL, session_id text NOT NULL,
        session_type text NOT NULL, role text NOT NULL, worker_id text, job_id text,
        trigger_seq integer, result_seq integer, created_at integer NOT NULL,
        last_seen_at integer NOT NULL, UNIQUE(task_id, session_id)
      );
      CREATE TABLE conductor__agent_instances (
        id text PRIMARY KEY NOT NULL, agent_name text NOT NULL, status text NOT NULL,
        created_at integer NOT NULL, updated_at integer NOT NULL
      );
      CREATE TABLE conductor__agent_instance_mappings (
        id text PRIMARY KEY NOT NULL, instance_id text NOT NULL, identity_type text NOT NULL,
        identity_value text NOT NULL, relation text NOT NULL, cursor_seq integer,
        created_at integer NOT NULL, updated_at integer NOT NULL,
        UNIQUE(identity_type, identity_value, relation),
        UNIQUE(instance_id, identity_type, relation)
      );
    `);
    const config: ConductorConfig = {
      projects: { app: { workspace: "none" } },
      workerAgents: { "coding:coding": "Implementation agent" },
      orchestratorAgent: "conductor:engineer-lead",
      maxWorkers: 3,
      intervalMinutes: 5,
      reuseSessions: true,
      maxDecisionsPerTurn: 25,
    };
    sqlite.prepare("INSERT INTO conductor__config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("conductor_config", JSON.stringify(config), Date.now());

    let ledger: LedgerRepository;
    const summons: Array<Record<string, unknown>> = [];
    let rejectResume = false;
    const appContext = {
      db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
      runAction: async (name: string, args: Record<string, unknown>) => {
        expect(name).toBe("system:summon");
        summons.push(args);
        if (rejectResume) return { status: "error" as const, error: "Session was not found or cannot be resumed" };
        ledger.append({
          taskId: "t-1",
          kind: "Noted",
          by: "orchestrator",
          source: "test",
          payload: { note: `decision ${summons.length}` },
        });
        return {
          status: "ok" as const,
          data: {
            result: "done",
            sessionId: "agent-session-1",
            romeSession: { _romeSessionId: `trace-${summons.length}`, _type: "action" },
          },
        };
      },
    };
    ledger = createLedgerRepository(appContext.db as never);
    const created = ledger.append({
      taskId: "t-1",
      kind: "Created",
      by: "guardian",
      source: "create",
      payload: { brief: "ORIGINAL_BRIEF", projectId: "app", project: { workspace: "none" }, replay: {
        sourceTaskId: "source", sourceThroughSeq: 12, coordinatorAgent: "conductor:engineer-lead-replay-v1",
        seed: "approved prototype", workRepoPath: "_experiments/replays/t-1/design.md",
      } },
    });
    const composition = {
      parseConfig: (raw: unknown) => ({ ok: true as const, config: raw as ConductorConfig }),
      workspaceKinds: ["none"],
      defaultWorkspaceKind: "none",
      sourceAdapters: [],
      providerFor: () => ({ note: () => "", instructions: () => "", prepare: async () => ({ kind: "none" as const }), validate: async () => undefined }),
      initialConfig: config,
    } as CoreComposition;
    const action = createAction({} as ActionConfig, { appContext } as unknown as AppActionRuntimeDeps, composition);

    const first = await action.execute({ taskId: "t-1" });
    expect(first.status).toBe("ok");
    expect(summons[0].sessionId).toBeUndefined();
    expect(summons[0].agentName).toBe("conductor:engineer-lead-replay-v1");
    expect(String(summons[0].prompt)).toContain("ORIGINAL_BRIEF");

    ledger.append({ taskId: "t-1", kind: "Reply", by: "guardian", source: "NEXT_REPLY", payload: { text: "NEXT_REPLY" } });
    const second = await action.execute({ taskId: "t-1" });
    expect(second.status).toBe("ok");
    expect(summons[1].sessionId).toBe("agent-session-1");
    expect(String(summons[1].prompt)).toContain("NEXT_REPLY");
    expect(String(summons[1].prompt)).not.toContain("ORIGINAL_BRIEF");

    const instances = createAgentInstanceRepository(appContext.db as never).allTaskCoordinators();
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      taskId: "t-1",
      sessionId: "agent-session-1",
      cursorSeq: created.seq + 2,
      status: "active",
    });

    rejectResume = true;
    ledger.append({ taskId: "t-1", kind: "Reply", by: "guardian", source: "FINAL_REPLY", payload: { text: "FINAL_REPLY" } });
    const rejected = await action.execute({ taskId: "t-1" });
    expect(rejected.status).toBe("ok");
    expect(summons[2].sessionId).toBe("agent-session-1");
    expect(rejected.data).toMatchObject({
      agentInstanceId: instances[0].id,
      decided: false,
      error: expect.stringContaining("cannot resume its one Agent Session agent-session-1"),
    });
    expect(createAgentInstanceRepository(appContext.db as never).forTaskCoordinator("t-1")).toMatchObject({
      id: instances[0].id,
      sessionId: "agent-session-1",
      cursorSeq: created.seq + 2,
      status: "broken",
    });
    sqlite.close();
  });
});
