import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { SettingsRepository } from "../db/repositories/settings.js";
import { LedgerRepository } from "../db/repositories/ledger.js";
import { LockRepository } from "../db/repositories/lock.js";
import { parseConfig, type ManagerConfig } from "../lib/config.js";
import { configRevision } from "../lib/config-edit.js";
import { LedgerBuilder } from "../lib/test-facts.js";
import { createApiHandler } from "./index.js";
let config: ManagerConfig | undefined;
let b: LedgerBuilder;
let order: string[];
const ctx = { db: {}, runAction: async () => { throw new Error("No actions or worker launches allowed"); }, log: { info() {}, error() {} } } as unknown as RomeAppContext;
function request(method = "GET", body?: unknown, kind = "guardian") {
  return { path: ["config"], method, caller: { kind }, query: new URLSearchParams(), body: body === undefined ? undefined : new TextEncoder().encode(JSON.stringify(body)) } as RomeAppApiRequest;
}
function patch(changes: unknown, revision = configRevision(config!)) { return request("PATCH", { changes, revision }); }
beforeEach(() => {
  const p = parseConfig({ workingDir: "/old-repo", maxWorkers: 3 });
  if (!p.ok) throw new Error(p.error);
  config = p.config; order = [];
  b = new LedgerBuilder().add({ taskId: "t1", kind: "Created", by: "ann", payload: { brief: "Keep my work" } });
  rs.spyOn(SettingsRepository.prototype, "get").mockImplementation(() => config);
  rs.spyOn(SettingsRepository.prototype, "put").mockImplementation((c) => { order.push("put"); config = c; });
  rs.spyOn(LockRepository.prototype, "tryAcquire").mockImplementation(() => { order.push("lock"); return true; });
  rs.spyOn(LockRepository.prototype, "release").mockImplementation(() => { order.push("release"); });
  rs.spyOn(LedgerRepository.prototype, "reachable").mockReturnValue(true);
  rs.spyOn(LedgerRepository.prototype, "all").mockImplementation(() => b.facts);
  rs.spyOn(LedgerRepository.prototype, "append").mockImplementation((f) => { order.push("bind"); b.add(f); return b.facts.at(-1)!; });
});
afterEach(() => rs.restoreAllMocks());
describe("guardian configuration API", () => {
  it("saves user-defined hooks without changing the protocol of existing tasks", async () => {
    const hooks = { prepare: { agent: "assistant:assistant", instructions: "Clarify requirements" }, evaluate: { agent: "assistant:assistant", instructions: "Check evidence" } };
    const res = await createApiHandler(ctx).handle(patch({ hooks }));
    expect(res.status).toBe(200);
    expect(config?.hooks).toEqual(hooks);
    expect(b.facts.find((f) => f.kind === "Bound")?.payload.project.hooks).toBeUndefined();
    expect(b.facts.some((f) => f.kind === "Started")).toBe(false);
  });
  it("GET is side-effect-free and rejects non-guardian reads/writes", async () => {
    const api = createApiHandler(ctx);
    const res = await api.handle(request());
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ config, revision: configRevision(config!) });
    expect((await api.handle(request("GET", undefined, "agent"))).status).toBe(403);
    expect((await api.handle(request("PATCH", {}, "agent"))).status).toBe(403);
    expect(order).toEqual([]);
  });
  it("binds legacy tasks to old source before saving and releasing the lock", async () => {
    const original = structuredClone(b.facts[0]);
    const res = await createApiHandler(ctx).handle(patch({ workingDir: "/new-repo", maxWorkers: 1 }));
    expect(res.status).toBe(200); expect(order).toEqual(["lock", "bind", "put", "release"]);
    expect(config!.workingDir).toBe("/new-repo");
    expect(b.facts[0]).toEqual(original);
    expect(b.facts[1]).toMatchObject({ kind: "Bound", payload: { projectId: "default", project: { workingDir: "/old-repo" } } });
    expect((await res.json()).revision).toBe(configRevision(config!));
    order = [];
    expect((await createApiHandler(ctx).handle(patch({ maxWorkers: 2 }))).status).toBe(200);
    expect(order).toEqual(["lock", "put", "release"]); expect(b.facts).toHaveLength(2);
  });
  it("rejects stale writes under lock, retaining the newer configuration", async () => {
    const stale = configRevision(config!); config = { ...config!, maxWorkers: 4 };
    const res = await createApiHandler(ctx).handle(patch({ maxWorkers: 1 }, stale));
    expect(res.status).toBe(409); expect(await res.json()).toMatchObject({ conflict: true });
    expect(order).toEqual(["lock", "release"]); expect(config.maxWorkers).toBe(4);
  });
  it("does not write while reconciling or when validation/ledger fails", async () => {
    rs.spyOn(LockRepository.prototype, "tryAcquire").mockReturnValue(false);
    expect((await createApiHandler(ctx).handle(patch({ maxWorkers: 1 }))).status).toBe(409);
    expect(order).toEqual([]);
    rs.spyOn(LockRepository.prototype, "tryAcquire").mockReturnValue(true);
    expect((await createApiHandler(ctx).handle(patch({ maxWorkers: 99 }))).status).toBe(400);
    rs.spyOn(LedgerRepository.prototype, "reachable").mockReturnValue(false);
    expect((await createApiHandler(ctx).handle(patch({ maxWorkers: 1 }))).status).toBe(503);
    expect(order).toEqual(["release", "release"]); expect(config!.maxWorkers).toBe(3);
  });
  it("requires setup and rejects malformed/oversized requests", async () => {
    const api = createApiHandler(ctx);
    for (const value of [null, [], {}, "string", { revision: 3 }]) expect((await api.handle(request("PATCH", value))).status).toBe(400);
    expect((await api.handle({ ...request("PATCH"), body: new TextEncoder().encode("{") })).status).toBe(400);
    expect((await api.handle({ ...request("PATCH"), body: new Uint8Array(64_001) })).status).toBe(413);
    expect((await api.handle(request("POST"))).status).toBe(405);
    config = undefined;
    expect((await api.handle(request())).status).toBe(409);
    expect((await api.handle(request("PATCH", { revision: "old", changes: { maxWorkers: 1 } }))).status).toBe(409);
    expect(order).toEqual(["lock", "release"]);
  });
  it("releases the lock on storage failure without saving new settings", async () => {
    rs.spyOn(LedgerRepository.prototype, "append").mockImplementation(() => { throw new Error("disk failure"); });
    expect((await createApiHandler(ctx).handle(patch({ workingDir: "/new" }))).status).toBe(500);
    expect(order).toEqual(["lock", "release"]); expect(config!.workingDir).toBe("/old-repo");
  });
});
