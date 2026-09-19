import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { RuntimeControlRepository } from "./runtime-control.js";

describe("runtime control", () => {
  it("defaults active and persists pause independently of conductor config", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec("CREATE TABLE conductor__config (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL)");
    const controls = new RuntimeControlRepository(drizzle(sqlite), "conductor");

    expect(controls.get()).toEqual({ paused: false });
    const changedAt = new Date("2026-09-19T12:00:00Z");
    expect(controls.setPaused(true, changedAt)).toEqual({ paused: true, updatedAt: changedAt });
    expect(controls.get()).toEqual({ paused: true, updatedAt: changedAt });
    expect(sqlite.prepare("SELECT key FROM conductor__config ORDER BY key").all()).toEqual([{ key: "runtime_control" }]);

    sqlite.close();
  });
});
