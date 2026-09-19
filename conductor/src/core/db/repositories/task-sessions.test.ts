import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { TaskSessionRepository } from "./task-sessions.js";

describe("TaskSessionRepository", () => {
  it("adds the result edge later without losing the original trigger edge", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE conductor__task_sessions (
        id text PRIMARY KEY NOT NULL, task_id text NOT NULL, session_id text NOT NULL,
        session_type text NOT NULL, role text NOT NULL, worker_id text, job_id text,
        trigger_seq integer, result_seq integer, created_at integer NOT NULL,
        last_seen_at integer NOT NULL, UNIQUE(task_id, session_id)
      );
    `);
    const repository = new TaskSessionRepository(drizzle(sqlite), "conductor");
    repository.record({
      taskId: "t-1", sessionId: "s-1", sessionType: "action", role: "coordinator", triggerSeq: 7,
    });
    repository.record({
      taskId: "t-1", sessionId: "s-1", sessionType: "action", role: "coordinator", resultSeq: 9,
    });
    expect(repository.forTask("t-1")[0]).toMatchObject({ triggerSeq: 7, resultSeq: 9 });
    sqlite.close();
  });
});
