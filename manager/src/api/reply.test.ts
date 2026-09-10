import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { LedgerRepository } from "../db/repositories/ledger.js";
import { LedgerBuilder } from "../lib/test-facts.js";
import { createApiHandler } from "./index.js";
let b: LedgerBuilder;
const runAction = rs.fn(async (..._args: unknown[]) => ({ status: "ok", data: { wrote: "Reply" } }));
const ctx = { db: {}, runAction, log: { info() {}, error() {} } } as unknown as RomeAppContext;
function request(body: unknown = { text: "Please check this" }, method = "POST", kind = "guardian", id = "t1") {
  return { path: ["tasks", id, "reply"], method, caller: { kind }, query: new URLSearchParams(), body: new TextEncoder().encode(JSON.stringify(body)) } as RomeAppApiRequest;
}
beforeEach(() => {
  runAction.mockClear();
  b = new LedgerBuilder().add({ taskId: "t1", kind: "Created", by: "guardian", payload: { brief: "Test task" } });
  rs.spyOn(LedgerRepository.prototype, "reachable").mockReturnValue(true);
  rs.spyOn(LedgerRepository.prototype, "factsFor").mockImplementation((id) => b.facts.filter((f) => f.taskId === id));
});
afterEach(() => rs.restoreAllMocks());
describe("task composer reply API", () => {
  it("sends the exact message through manager:reply, without starting a chat", async () => {
    const text = "  Feedback\nWhat about 中文?  ";
    const res = await createApiHandler(ctx).handle(request({ text }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wrote: "Reply" });
    expect(runAction.mock.calls).toEqual([["manager:reply", { taskId: "t1", text, source: text }]]);
  });
  it("requires guardian and POST before any side effects", async () => {
    const api = createApiHandler(ctx);
    expect((await api.handle(request({}, "POST", "agent"))).status).toBe(403);
    expect((await api.handle(request({}, "GET"))).status).toBe(405);
    expect(runAction).not.toHaveBeenCalled();
  });
  it("rejects missing, malformed, blank and oversized messages", async () => {
    const api = createApiHandler(ctx);
    for (const body of [null, [], {}, { text: 4 }, { text: " \n " }]) expect((await api.handle(request(body))).status).toBe(400);
    expect((await api.handle({ ...request(), body: new TextEncoder().encode("{") })).status).toBe(400);
    expect((await api.handle({ ...request(), body: new Uint8Array(64_001) })).status).toBe(413);
    expect(runAction).not.toHaveBeenCalled();
  });
  it("rejects absent or closed tasks and unavailable ledgers", async () => {
    const api = createApiHandler(ctx);
    expect((await api.handle(request({ text: "hello" }, "POST", "guardian", "missing"))).status).toBe(404);
    b.add({ taskId: "t1", kind: "Completed", by: "guardian", source: "done", payload: {} });
    expect((await api.handle(request())).status).toBe(409);
    rs.spyOn(LedgerRepository.prototype, "reachable").mockReturnValue(false);
    expect((await api.handle(request())).status).toBe(503);
    expect(runAction).not.toHaveBeenCalled();
  });
  it("surfaces action failures instead of reporting success", async () => {
    runAction.mockResolvedValueOnce({ status: "error", error: "Task changed" } as never);
    const res = await createApiHandler(ctx).handle(request());
    expect(res.status).toBe(502); expect(await res.json()).toEqual({ error: "Task changed" });
  });
});
