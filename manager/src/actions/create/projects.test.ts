import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import { setCurrentActionContextResolver, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { LedgerRepository } from "../../db/repositories/ledger.js";
import { LockRepository } from "../../db/repositories/lock.js";
import { SettingsRepository } from "../../db/repositories/settings.js";
import { createAction } from "./index.js";
import { createAction as setupAction } from "../setup/index.js";
import { createAction as snapshotAction } from "../snapshot/index.js";
import { parseConfig, RECONCILE_ROUTINE_KEY, type ManagerConfig } from "../../lib/config.js";
import { LedgerBuilder } from "../../lib/test-facts.js";
import { foldTask } from "../../lib/fold.js";

const projects = { rome: { workingDir: "/src/rome", repo: "acme/rome" }, manager: { workingDir: "/src/apps/manager", repo: "acme/apps" } };
let b: LedgerBuilder;
let config: ManagerConfig;
let held: boolean;
let calls: string[];
function deps(): AppActionRuntimeDeps {
  return { appContext: { db: {}, runAction: async (name: string) => {
    if (held && name === "manager:reconcile") throw new Error("reconcile called while holding the lock");
    calls.push(name); return { status: "ok" };
  }, listRoutines: async () => [{ key: RECONCILE_ROUTINE_KEY, trigger: { rrule: "FREQ=MINUTELY;INTERVAL=5" } }] } } as unknown as AppActionRuntimeDeps;
}
const create = (args: Record<string, unknown>) => createAction({} as ActionConfig, deps()).execute(args);
beforeEach(() => {
  rs.restoreAllMocks(); held = false; calls = []; b = new LedgerBuilder();
  const parsed = parseConfig({ projects }); if (!parsed.ok) throw new Error(parsed.error); config = parsed.config;
  rs.spyOn(SettingsRepository.prototype, "get").mockImplementation(() => config);
  rs.spyOn(SettingsRepository.prototype, "put").mockImplementation((next) => { config = next; });
  rs.spyOn(LedgerRepository.prototype, "reachable").mockReturnValue(true);
  rs.spyOn(LedgerRepository.prototype, "all").mockImplementation(() => b.facts);
  rs.spyOn(LedgerRepository.prototype, "factsFor").mockImplementation((id) => b.facts.filter((f) => f.taskId === id));
  rs.spyOn(LedgerRepository.prototype, "append").mockImplementation((fact) => { b.add(fact); return b.facts.at(-1)!; });
  rs.spyOn(LockRepository.prototype, "tryAcquire").mockImplementation(() => { if (held) return false; held = true; return true; });
  rs.spyOn(LockRepository.prototype, "release").mockImplementation(() => { held = false; });
  setCurrentActionContextResolver(() => undefined);
});
afterEach(() => { rs.restoreAllMocks(); setCurrentActionContextResolver(null); });

describe("project intake action boundary", () => {
  it("records an explicit binding and actual human author before reconciling", async () => {
    setCurrentActionContextResolver(() => ({ channelContext: { channel: "webchat", threadId: "test", channelUserId: "ann", projectPath: "/src/rome" } }));
    const result = await create({ projectId: "manager", brief: "Improve Manager", source: "my exact words" });
    expect(result.status).toBe("ok");
    expect(b.facts[0]).toMatchObject({ kind: "Created", by: "ann", source: "my exact words", payload: { projectId: "manager", project: projects.manager } });
    expect(calls).toEqual(["manager:reconcile"]);
    expect(held).toBe(false);
  });
  it("uses selected chat context automatically and exposes it in snapshot", async () => {
    setCurrentActionContextResolver(() => ({ channelContext: { channel: "webchat", threadId: "test", projectName: "manager", projectPath: "/src/apps/manager" } }));
    expect((await create({ brief: "Improve Manager", source: "my words" })).status).toBe("ok");
    expect(foldTask(b.facts).projectId).toBe("manager");
    const snapshot = await snapshotAction({} as ActionConfig, deps()).execute({});
    expect(snapshot).toMatchObject({ status: "ok", data: { projects, selectedProject: { name: "manager", path: "/src/apps/manager" }, tasks: [{ projectId: "manager" }] } });
  });
  it("ambiguous and invalid choices write nothing, launch nothing and release the lock", async () => {
    for (const args of [{}, { projectId: "unknown" }]) {
      expect((await create({ brief: "Work", source: "Work", ...args })).status).toBe("error");
      expect(held).toBe(false);
    }
    expect(b.facts).toEqual([]); expect(calls).toEqual([]);
  });
  it("rejects competing setup/reconcile without writing a task", async () => {
    held = true;
    expect((await create({ projectId: "manager", brief: "Work", source: "Work" })).status).toBe("error");
    expect(b.facts).toEqual([]); expect(held).toBe(true);
  });
  it("deduplicates chat/Board asks against already tracked GitHub issues, including closed tasks and casing", async () => {
    b.add({ taskId: "old", kind: "Created", by: "github:ann", payload: { brief: "https://github.com/ACME/apps/issues/7" } })
      .add({ taskId: "old", kind: "Completed", by: "ann", payload: {} });
    expect((await create({ projectId: "manager", brief: "Fix acme/apps#7", source: "Implement" })).status).toBe("error");
    expect(b.facts).toHaveLength(2); expect(calls).toEqual([]);
  });
  it("setup durably migrates legacy tasks BEFORE replacing settings; repeat setup does not rebind", async () => {
    const old = parseConfig({ workingDir: "/old/repo" }); if (!old.ok) throw new Error(old.error); config = old.config;
    b.add({ taskId: "old", kind: "Created", by: "ann", payload: { brief: "Work" } });
    const setup = () => setupAction({} as ActionConfig, deps()).execute({ projects, defaultProject: "manager" });
    expect((await setup()).status).toBe("ok");
    expect(config.defaultProject).toBe("manager");
    expect(foldTask(b.facts)).toMatchObject({ projectId: "default", project: { workingDir: "/old/repo" } });
    expect((await setup()).status).toBe("ok");
    expect(b.facts.filter((f) => f.kind === "Bound")).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});
