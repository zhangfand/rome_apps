import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import type { ActionConfig, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createAction } from "./index.js";
import { SettingsRepository } from "../../db/repositories/settings.js";
import { LedgerRepository } from "../../db/repositories/ledger.js";
import { LockRepository } from "../../db/repositories/lock.js";
import { configRevision } from "../../lib/config-edit.js";
import { parseConfig } from "../../lib/config.js";
import { LedgerBuilder } from "../../lib/test-facts.js";
const p = parseConfig({ workingDir: "/repo", hooks: { prepare: { agent: "assistant:assistant", instructions: "Prepare" }, evaluate: { agent: "assistant:assistant", instructions: "Evaluate" } } });
if (!p.ok) throw new Error(p.error);
const settings = p.config;
let l: LedgerBuilder;
let order: string[];
const deps = { appContext: { db: {}, runAction: async () => { order.push("reconcile"); return { status: "ok" }; } } } as unknown as AppActionRuntimeDeps;
const args = () => ({ tasks: [{ taskId: "t", reportSeq: 5 }], configRevision: configRevision(settings), source: "Backfill Other results" });
const run = (a = args()) => createAction({} as ActionConfig, deps).execute(a);
beforeEach(() => {
  order = [];
  l = new LedgerBuilder()
    .add({ taskId: "t", kind: "Created", by: "guardian", payload: { brief: "Build", projectId: "default", project: { workingDir: "/repo" } } })
    .add({ taskId: "t", kind: "Taken", by: "runtime", payload: {} })
    .add({ taskId: "t", kind: "Started", by: "runtime", payload: { workerId: "w", prompt: "build" } })
    .add({ taskId: "t", kind: "Returned", by: "w", payload: { workerId: "w", reply: "ready" } })
    .add({ taskId: "t", kind: "Report", by: "runtime", payload: { what: "ready", evidence: "w" } });
  rs.spyOn(SettingsRepository.prototype, "get").mockReturnValue(settings);
  rs.spyOn(LockRepository.prototype, "tryAcquire").mockImplementation(() => { order.push("lock"); return true; });
  rs.spyOn(LockRepository.prototype, "release").mockImplementation(() => { order.push("release"); });
  rs.spyOn(LedgerRepository.prototype, "reachable").mockReturnValue(true);
  rs.spyOn(LedgerRepository.prototype, "factsFor").mockImplementation(id => l.facts.filter(f => f.taskId === id));
  rs.spyOn(LedgerRepository.prototype, "appendIfLatest").mockImplementation((f, seq) => {
    if (l.facts.at(-1)?.seq !== seq) return undefined;
    order.push("append"); l.add(f); return l.facts.at(-1)!;
  });
});
afterEach(() => rs.restoreAllMocks());
describe("backfill action", () => {
  it("adopts exact current hooks under lock, releases before reconcile and is idempotent", async () => {
    expect(await run()).toMatchObject({ status: "ok", data: { results: [{ taskId: "t", status: "queued" }] } });
    expect(order).toEqual(["lock", "append", "release", "reconcile"]);
    expect(l.facts.at(-1)).toMatchObject({ kind: "Reply", source: "Backfill Other results", payload: { reassessment: { reportSeq: 5, submissionSeq: 4, hooks: settings.hooks } } });
    order = [];
    expect(await run()).toMatchObject({ data: { results: [{ status: "already_requested" }] } });
    expect(order).toEqual(["lock", "release"]);
  });
  it("rejects config revision drift and lock contention without writing", async () => {
    expect(await run({ ...args(), configRevision: "stale" })).toMatchObject({ status: "error" });
    expect(l.facts).toHaveLength(5);
    rs.spyOn(LockRepository.prototype, "tryAcquire").mockReturnValue(false);
    expect(await run()).toMatchObject({ status: "error" }); expect(l.facts).toHaveLength(5);
  });
  it("skips concurrent or changed tasks instead of overwriting them", async () => {
    rs.spyOn(LedgerRepository.prototype, "appendIfLatest").mockReturnValue(undefined);
    expect(await run()).toMatchObject({ data: { results: [{ status: "skipped" }] } });
    expect(order).not.toContain("reconcile");
    expect(await run({ ...args(), tasks: [{ taskId: "t", reportSeq: 3 }] })).toMatchObject({ data: { results: [{ status: "skipped" }] } });
  });
});
