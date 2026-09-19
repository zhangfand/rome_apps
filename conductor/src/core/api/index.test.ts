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

describe("configuration writes", () => {
  it("forwards Asked association only from the explicit answer request", async () => {
    const { sqlite, handler, actionCalls } = configuredHandler(undefined);

    const steering = await handler.handle(apiRequest("POST", ["tasks", "task-1", "reply"], {
      text: "Also update the README.",
    }));
    expect(steering.status).toBe(200);
    expect(actionCalls[0]).toEqual({
      name: "conductor:record_person_reply",
      args: { taskId: "task-1", text: "Also update the README.", source: "Also update the README." },
    });

    const answer = await handler.handle(apiRequest("POST", ["tasks", "task-1", "reply"], {
      text: "Option A",
      resolvesAskedSeq: 42,
    }));
    expect(answer.status).toBe(200);
    expect(actionCalls[1]).toEqual({
      name: "conductor:record_person_reply",
      args: { taskId: "task-1", text: "Option A", source: "Option A", resolvesAskedSeq: 42 },
    });
    sqlite.close();
  });

  it("keeps Board fallback visible across unrelated replies until the exact question is resolved", async () => {
    const { sqlite, handler } = configuredHandler({
      projects: { app: { workingDir: "/repo" } },
      defaultProject: "app",
    });
    insertFact(sqlite, "needs-answer", "Created", { brief: "ship it", projectId: "app" });
    const askedSeq = insertFact(sqlite, "needs-answer", "Asked", { question: "Approve?" }, "orchestrator");
    insertFact(sqlite, "needs-answer", "Reply", { text: "Also update the README." });

    const response = await handler.handle(apiRequest("GET", ["state"]));
    expect(response.status).toBe(200);
    const state = await response.json() as { tasks: Array<{ interventionNotice?: unknown }> };
    expect(state.tasks[0]?.interventionNotice).toEqual({ status: "board_only", boardFallback: true });

    insertFact(sqlite, "needs-answer", "Reply", { text: "Approved", resolvesAskedSeq: askedSeq });
    const resolved = await handler.handle(apiRequest("GET", ["state"]));
    const resolvedState = await resolved.json() as { tasks: Array<{ interventionNotice?: unknown }> };
    expect(resolvedState.tasks[0]?.interventionNotice).toBeUndefined();
    sqlite.close();
  });

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
  sop: "default sop",
  workerAgents: { "coding:coding": "code" },
  workspaceKinds: ["git-worktree", "none"],
  defaultWorkspaceKind: "git-worktree",
});

const initialConfig = {
  projects: {},
  sop: "default sop",
  workerAgents: { "coding:coding": "code" },
  orchestratorAgent: "conductor:orchestrator",
  maxWorkers: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  maxDecisionsPerTurn: 25,
};

function configuredHandler(rawConfig?: Record<string, unknown>) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE conductor__facts (seq integer PRIMARY KEY AUTOINCREMENT NOT NULL, id text NOT NULL, task_id text NOT NULL, kind text NOT NULL, by text NOT NULL, source text, payload text NOT NULL, created_at integer NOT NULL);
    CREATE TABLE conductor__config (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL);
    CREATE TABLE conductor__locks (name text PRIMARY KEY NOT NULL, held_until integer NOT NULL);
    CREATE TABLE conductor__intervention_notices (key text PRIMARY KEY NOT NULL, task_id text NOT NULL, fact_seq integer NOT NULL, status text NOT NULL, provider_message_id text, failure_code text, created_at integer NOT NULL, attempted_at integer, settled_at integer);
  `);
  if (rawConfig) {
    const parsed = parseConfig(rawConfig);
    if (!parsed.ok) throw new Error(parsed.error);
    sqlite.prepare("INSERT INTO conductor__config (key, value, updated_at) VALUES (?, ?, ?)")
      .run("conductor_config", JSON.stringify(parsed.config), Date.now());
  }
  const actions: string[] = [];
  const actionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
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
      actionCalls.push({ name, args });
      return { status: "ok", data: {} };
    },
  } as unknown as RomeAppContext;
  return { sqlite, handler: createApiHandler(ctx, composition), actions, actionCalls };
}

function insertFact(sqlite: Database.Database, taskId: string, kind: string, payload: unknown, by = "guardian"): number {
  const result = sqlite.prepare("INSERT INTO conductor__facts (id, task_id, kind, by, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(crypto.randomUUID(), taskId, kind, by, JSON.stringify(payload), Date.now());
  return Number(result.lastInsertRowid);
}
