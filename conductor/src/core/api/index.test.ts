import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import type { CoreComposition } from "../lib/composition.js";
import { createConfigParser } from "../lib/config.js";
import { createApiHandler } from "./index.js";

describe("app-owned task reads", () => {
  it("is guardian-only and returns not found before invoking the app route", async () => {
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
    let calls = 0;
    const composition = {
      taskRoutes: [{
        method: "GET",
        path: ["domain-view"],
        handle: async (_ctx, task) => {
          calls += 1;
          return { taskId: task.id };
        },
      }],
    } as unknown as CoreComposition;
    const ctx = {
      db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
      log: { error: () => undefined },
    } as unknown as RomeAppContext;
    const handler = createApiHandler(ctx, composition);

    const denied = await handler.handle(taskRequest("missing", { kind: "anonymous" }));
    expect(denied.status).toBe(403);
    expect(calls).toBe(0);

    const missing = await handler.handle(taskRequest("missing", { kind: "guardian", userId: "g1", via: "cookie" }));
    expect(missing.status).toBe(404);
    expect(calls).toBe(0);

    sqlite.prepare("INSERT INTO conductor__facts (id, task_id, kind, by, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("f1", "t1", "Created", "guardian", JSON.stringify({ brief: "test" }), Date.now());
    const found = await handler.handle(taskRequest("t1", { kind: "guardian", userId: "g1", via: "cookie" }));
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({ taskId: "t1" });
    expect(calls).toBe(1);
    sqlite.close();
  });
});

describe("front desk shadow reads", () => {
  it("is guardian-only and returns comparison summaries without credential data", async () => {
    const { sqlite, handler } = configuredHandler(undefined);
    sqlite.prepare(`
      INSERT INTO conductor__frontdesk_shadow_runs (
        id, session_id, channel_thread_key, input, state, status, model, decision,
        input_tokens, output_tokens, latency_ms, actual_kind, actual_task_id,
        matched, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "shadow-1", "session-1", "webchat:thread-1", "continue the prototype",
      JSON.stringify({ message: "continue the prototype", tasks: [], projects: ["conductor"] }),
      "completed", "jev-latest",
      JSON.stringify({
        intent: "reply_to_task", targetTask: "task-1", project: "conductor",
        explicitAcceptance: 0, explicitCancellation: 0, answersLatestQuestion: 1,
        needsGeneratedResponse: 0, confidence: { intent: 0.98, targetTask: 0.96, project: 0.9 },
      }),
      2_000, 20, 125, "Reply", "task-1", 1, Date.now(), Date.now(),
    );

    const response = await handler.handle(apiRequest("GET", ["frontdesk-shadow"]));
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      summary: { returned: 1, compared: 1, matched: 1, mismatched: 0, matchRate: 1, inputTokens: 2_000 },
      runs: [{ id: "shadow-1", input: "continue the prototype", matched: true }],
    });
    expect(JSON.stringify(body)).not.toContain("apiKey");

    const denied = apiRequest("GET", ["frontdesk-shadow"]);
    denied.caller = { kind: "anonymous" };
    expect((await handler.handle(denied)).status).toBe(403);
    sqlite.close();
  });
});

describe("task usage session reads", () => {
  it("returns stored coordinator sessions and backfills historical worker sessions from the ledger", async () => {
    const { sqlite, handler } = configuredHandler({ projects: { app: { workspace: "none" } }, defaultProject: "app" });
    insertFact(sqlite, "t-usage", "Created", { brief: "measure this", projectId: "app" });
    insertFact(sqlite, "t-usage", "Dispatched", { workerId: "w-1", jobId: "j-1", agent: "coding:coding", instructions: "work", prompt: "work" });
    insertFact(sqlite, "t-usage", "Opened", { workerId: "w-1", jobId: "j-1", romeSessionId: "worker-session", sessionType: "action" });
    sqlite.prepare(`
      INSERT INTO conductor__task_sessions
        (id, task_id, session_id, session_type, role, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("ref-1", "t-usage", "coordinator-session", "action", "coordinator", Date.now(), Date.now());

    const response = await handler.handle(apiRequest("GET", ["tasks", "t-usage"]));
    expect(response.status).toBe(200);
    const body = await response.json() as { coordinatorAgent?: string; usageSessions: unknown[] };
    expect(body.coordinatorAgent).toBe("conductor:engineer-lead");
    expect(body.usageSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "worker-session", role: "worker", workerId: "w-1", jobId: "j-1", agent: "coding:coding", triggerSeq: 2 }),
      expect.objectContaining({ id: "coordinator-session", role: "coordinator", agent: "conductor:engineer-lead" }),
    ]));
    sqlite.close();
  });
});

describe("person Task writes", () => {
  it("requires a Task revision and maps a conditional-write conflict to HTTP 409", async () => {
    const { sqlite, handler, actions } = configuredHandler(
      { projects: { app: { workspace: "none" } }, defaultProject: "app" },
      async () => ({
        status: "ok" as const,
        data: { status: "conflict", scope: "task:t-1", taskId: "t-1", expectedSeq: 1, currentSeq: 2, delta: [{ seq: 2, kind: "Event" }] },
      }),
    );

    const missing = await handler.handle(apiRequest("POST", ["tasks", "t-1", "reply"], { text: "continue" }));
    expect(missing.status).toBe(400);
    expect(actions).toEqual([]);

    const stale = await handler.handle(apiRequest("POST", ["tasks", "t-1", "reply"], { text: "continue", seenSeq: 1 }));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ status: "conflict", currentSeq: 2, delta: [{ seq: 2 }] });
    expect(actions).toEqual(["conductor:record_person_reply"]);
    sqlite.close();
  });
});

describe("configuration writes", () => {
  it("lets only the guardian browse host directories", async () => {
    const { sqlite, handler } = configuredHandler(undefined);
    const request = apiRequest("GET", ["config", "directories"]);
    request.query.set("path", process.cwd());

    const response = await handler.handle(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ path: process.cwd(), entries: expect.any(Array) });

    const denied = apiRequest("GET", ["config", "directories"]);
    denied.caller = { kind: "anonymous" };
    expect((await handler.handle(denied)).status).toBe(403);
    sqlite.close();
  });

  it("guards project deletion by open pinned tasks and accepts forced deletion", async () => {
    const { sqlite, handler } = configuredHandler({
      projects: { app: { workingDir: "/repo" }, second: { workspace: "none" }, keep: { workspace: "none" } },
      defaultProject: "app",
    });
    insertFact(sqlite, "open", "Created", { brief: "open", projectId: "app", project: { workingDir: "/old-repo", workspace: "git-worktree" } });
    insertFact(sqlite, "closed", "Created", { brief: "closed", projectId: "app", project: { workingDir: "/old-repo", workspace: "git-worktree" } });
    insertFact(sqlite, "closed", "Completed", {});
    insertFact(sqlite, "open-second", "Created", { brief: "open", projectId: "second", project: { workspace: "none" } });

    const blocked = await handler.handle(configRequest("PATCH", { projects: { app: null } }));
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ projectId: "app", count: 1 });

    const forced = await handler.handle(configRequest("PATCH", { projects: { app: null }, force: true }));
    expect(forced.status).toBe(200);
    const result = await forced.json() as { config: { projects: Record<string, unknown> } };
    expect(result.config.projects).toEqual({ second: { workspace: "none" }, keep: { workspace: "none" } });

    const queryForcedRequest = configRequest("PATCH", { projects: { second: null } });
    queryForcedRequest.query.set("force", "1");
    const queryForced = await handler.handle(queryForcedRequest);
    expect(queryForced.status).toBe(200);
    expect(await queryForced.json()).toMatchObject({ config: { projects: { keep: { workspace: "none" } } } });
    sqlite.close();
  });

  it("creates the first project and routine from an unconfigured install", async () => {
    const { sqlite, handler, actions } = configuredHandler(undefined);
    const initial = await handler.handle(configRequest("GET"));
    expect(initial.status).toBe(200);
    expect(await initial.json()).toMatchObject({ configured: false, config: { projects: {} } });
    const response = await handler.handle(configRequest("PATCH", {
      projects: { first: { workingDir: "/repo", workspace: "git-worktree" } },
      defaultProject: "first",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ configured: true, config: { defaultProject: "first" } });
    expect(actions).toEqual(["system:create_routine"]);
    const stored = sqlite.prepare("SELECT value FROM conductor__config WHERE key = ?").get("conductor_config") as { value: string };
    expect(JSON.parse(stored.value)).toMatchObject({ projects: { first: { workingDir: "/repo" } } });
    sqlite.close();
  });
});

describe("developer runtime control", () => {
  it("lets only the guardian pause and resume the runtime", async () => {
    const { sqlite, handler } = configuredHandler({ projects: { app: { workspace: "none" } } });

    const initial = await handler.handle(configRequest("GET"));
    expect(await initial.json()).toMatchObject({ runtime: { paused: false } });

    const denied = apiRequest("POST", ["runtime", "pause"], { paused: true });
    denied.caller = { kind: "anonymous" };
    expect((await handler.handle(denied)).status).toBe(403);

    const paused = await handler.handle(apiRequest("POST", ["runtime", "pause"], { paused: true }));
    expect(paused.status).toBe(200);
    expect(await paused.json()).toMatchObject({ paused: true, pauseChangedAt: expect.any(String) });
    expect(JSON.parse((sqlite.prepare("SELECT value FROM conductor__config WHERE key = ?").get("runtime_control") as { value: string }).value)).toEqual({ paused: true });

    const resumed = await handler.handle(apiRequest("POST", ["runtime", "pause"], { paused: false }));
    expect(await resumed.json()).toMatchObject({ paused: false });
    sqlite.close();
  });
});

function taskRequest(taskId: string, caller: RomeAppApiRequest["caller"]): RomeAppApiRequest {
  return {
    method: "GET",
    path: ["tasks", taskId, "domain-view"],
    headers: {},
    query: new URLSearchParams(),
    caller,
  };
}

function configRequest(method: "GET" | "PATCH", body?: unknown): RomeAppApiRequest {
  return apiRequest(method, ["config"], body);
}

function apiRequest(method: "GET" | "PATCH" | "POST", path: string[], body?: unknown): RomeAppApiRequest {
  return {
    method, path, headers: {}, query: new URLSearchParams(),
    caller: { kind: "guardian", userId: "g1", via: "cookie" },
    ...(body === undefined ? {} : { body: new TextEncoder().encode(JSON.stringify(body)) }),
  };
}

const parseConfig = createConfigParser({
  workerAgents: { "coding:coding": "code" },
  workspaceKinds: ["git-worktree", "none"],
  defaultWorkspaceKind: "git-worktree",
});

const initialConfig = {
  projects: {},
  workerAgents: { "coding:coding": "code" },
  orchestratorAgent: "conductor:orchestrator",
  maxWorkers: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  maxDecisionsPerTurn: 25,
};

function configuredHandler(
  rawConfig?: Record<string, unknown>,
  runActionOverride?: (name: string, args: Record<string, unknown>) => Promise<{ status: "ok"; data?: unknown }>,
) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE conductor__facts (seq integer PRIMARY KEY AUTOINCREMENT NOT NULL, id text NOT NULL, task_id text NOT NULL, kind text NOT NULL, by text NOT NULL, source text, payload text NOT NULL, created_at integer NOT NULL);
    CREATE TABLE conductor__config (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL);
    CREATE TABLE conductor__locks (name text PRIMARY KEY NOT NULL, held_until integer NOT NULL);
    CREATE TABLE conductor__task_sessions (
      id text PRIMARY KEY NOT NULL,
      task_id text NOT NULL,
      session_id text NOT NULL,
      session_type text NOT NULL,
      role text NOT NULL,
      worker_id text,
      job_id text,
      trigger_seq integer,
      result_seq integer,
      created_at integer NOT NULL,
      last_seen_at integer NOT NULL,
      UNIQUE(task_id, session_id)
    );
    CREATE TABLE conductor__frontdesk_shadow_runs (
      id text PRIMARY KEY NOT NULL,
      session_id text NOT NULL,
      channel_thread_key text NOT NULL,
      input text NOT NULL,
      state text NOT NULL,
      status text NOT NULL,
      model text,
      decision text,
      raw_response text,
      input_tokens integer,
      output_tokens integer,
      latency_ms integer,
      error text,
      actual_kind text,
      actual_task_id text,
      actual_project_id text,
      matched integer,
      mismatch text,
      created_at integer NOT NULL,
      completed_at integer
    );
  `);
  if (rawConfig) {
    const parsed = parseConfig(rawConfig);
    if (!parsed.ok) throw new Error(parsed.error);
    sqlite.prepare("INSERT INTO conductor__config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("conductor_config", JSON.stringify(parsed.config), Date.now());
  }
  const actions: string[] = [];
  const composition = {
    parseConfig,
    workspaceKinds: ["git-worktree", "none"],
    defaultWorkspaceKind: "git-worktree",
    sourceAdapters: [],
    providerFor: () => ({ kind: "none", prepare: async () => ({ kind: "none" }), validate: async () => undefined, instructions: () => "", note: () => "" }),
    initialConfig,
  } as CoreComposition;
  const ctx = {
    db: { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` },
    log: { error: () => undefined, info: () => undefined },
    listRoutines: async () => [],
    runAction: async (name: string, args: Record<string, unknown>) => {
      actions.push(name);
      return runActionOverride ? runActionOverride(name, args) : { status: "ok" as const, data: {} };
    },
  } as unknown as RomeAppContext;
  return { sqlite, handler: createApiHandler(ctx, composition), actions };
}

function insertFact(sqlite: Database.Database, taskId: string, kind: string, payload: unknown): void {
  sqlite.prepare("INSERT INTO conductor__facts (id, task_id, kind, by, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), taskId, kind, "guardian", JSON.stringify(payload), Date.now());
}
