import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import type { CoreComposition } from "../lib/composition.js";
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

    const denied = await handler.handle(request("missing", { kind: "anonymous" }));
    expect(denied.status).toBe(403);
    expect(calls).toBe(0);

    const missing = await handler.handle(request("missing", { kind: "guardian", userId: "g1", via: "cookie" }));
    expect(missing.status).toBe(404);
    expect(calls).toBe(0);

    sqlite.prepare("INSERT INTO conductor__facts (id, task_id, kind, by, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("f1", "t1", "Created", "guardian", JSON.stringify({ brief: "test" }), Date.now());
    const found = await handler.handle(request("t1", { kind: "guardian", userId: "g1", via: "cookie" }));
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({ taskId: "t1" });
    expect(calls).toBe(1);
    sqlite.close();
  });
});

function request(taskId: string, caller: RomeAppApiRequest["caller"]): RomeAppApiRequest {
  return {
    method: "GET",
    path: ["tasks", taskId, "domain-view"],
    headers: {},
    query: new URLSearchParams(),
    caller,
  };
}
