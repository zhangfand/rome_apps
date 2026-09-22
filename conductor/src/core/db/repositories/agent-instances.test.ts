import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AgentInstanceRepository } from "./agent-instances.js";

function repository() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
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
  return { sqlite, instances: new AgentInstanceRepository(drizzle(sqlite), "conductor") };
}

describe("AgentInstanceRepository", () => {
  it("gives one Task coordinator a stable first-class identity", () => {
    const { sqlite, instances } = repository();
    const first = instances.ensureTaskCoordinator("t-1", "conductor:engineer-lead");
    const again = instances.ensureTaskCoordinator("t-1", "conductor:engineer-lead");

    expect(first.id).toMatch(/^ai-/);
    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({ taskId: "t-1", status: "active", agentName: "conductor:engineer-lead" });
    sqlite.close();
  });

  it("maps exactly one resumable Agent Session to an Instance", () => {
    const { sqlite, instances } = repository();
    const instance = instances.ensureTaskCoordinator("t-1", "conductor:engineer-lead");

    instances.bindRuntimeSession(instance.id, "agent-session-1");
    instances.bindRuntimeSession(instance.id, "agent-session-1");
    expect(instances.forTaskCoordinator("t-1")?.sessionId).toBe("agent-session-1");
    expect(() => instances.bindRuntimeSession(instance.id, "agent-session-2")).toThrow(/already bound/);
    sqlite.close();
  });

  it("keeps the Task ledger cursor on the Task binding", () => {
    const { sqlite, instances } = repository();
    const instance = instances.ensureTaskCoordinator("t-1", "conductor:engineer-lead");

    instances.advanceTaskCursor(instance.id, 42);
    expect(instances.forTaskCoordinator("t-1")?.cursorSeq).toBe(42);
    sqlite.close();
  });

  it("does not silently change the Agent definition of an existing Instance", () => {
    const { sqlite, instances } = repository();
    instances.ensureTaskCoordinator("t-1", "conductor:engineer-lead");
    expect(() => instances.ensureTaskCoordinator("t-1", "conductor:other-lead")).toThrow(/is bound to/);
    sqlite.close();
  });
});
