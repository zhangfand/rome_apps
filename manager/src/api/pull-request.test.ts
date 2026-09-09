import { afterEach, beforeEach, describe, expect, it, rs } from "@rstest/core";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { LedgerRepository } from "../db/repositories/ledger.js";
import { PullRequestError, PullRequestService } from "../lib/pull-request.js";
import { LedgerBuilder } from "../lib/test-facts.js";
import { createApiHandler } from "./index.js";
const url = "https://github.com/acme/repo/pull/42";
let b: LedgerBuilder;
let writes: unknown[];
let reads: number;
const ctx = { db: {}, runAction: async () => { throw new Error("Must not launch actions"); }, log: { info() {}, error() {} } } as unknown as RomeAppContext;
function request(path: string[], method = "GET", body?: unknown, kind = "guardian") {
  return { path, method, caller: { kind }, query: new URLSearchParams({ url }), body: body === undefined ? undefined : new TextEncoder().encode(JSON.stringify(body)) } as RomeAppApiRequest;
}
beforeEach(() => {
  b = new LedgerBuilder().add({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: url, evidence: "" } });
  writes = []; reads = 0;
  rs.spyOn(LedgerRepository.prototype, "factsFor").mockImplementation((id) => b.facts.filter((f) => f.taskId === id));
  rs.spyOn(PullRequestService.prototype, "read").mockImplementation(async () => { reads++; return {} as never; });
  rs.spyOn(PullRequestService.prototype, "merge").mockImplementation(async (...args) => { writes.push(args); return { merged: true, url, sha: "b".repeat(40) }; });
});
afterEach(() => rs.restoreAllMocks());
const route = ["tasks", "t1", "pull-request"];
const mergeRoute = [...route, "merge"];
const body = { url, sha: "a".repeat(40), method: "squash", confirmed: true };
describe("guardian PR API", () => {
  it("rejects non-guardian reads and writes before touching GitHub", async () => {
    const handler = createApiHandler(ctx);
    expect((await handler.handle(request(route, "GET", undefined, "agent"))).status).toBe(403);
    expect((await handler.handle(request(mergeRoute, "POST", body, "agent"))).status).toBe(403);
    expect(reads).toBe(0); expect(writes).toEqual([]);
  });
  it("GET reads are side-effect free and writes require POST and explicit confirmation", async () => {
    const handler = createApiHandler(ctx);
    expect((await handler.handle(request(route))).status).toBe(200);
    expect((await handler.handle(request(mergeRoute))).status).toBe(404);
    for (const change of [{ confirmed: false }, { sha: "bad" }, { method: "admin" }, { url: "https://github.com/acme/other/pull/1" }]) {
      expect((await handler.handle(request(mergeRoute, "POST", { ...body, ...change }))).status).toBeGreaterThanOrEqual(400);
    }
    expect(writes).toEqual([]);
    expect((await handler.handle(request(mergeRoute, "POST", body))).status).toBe(200);
    expect(writes).toHaveLength(1); expect(b.facts).toHaveLength(1);
  });
  it("rejects missing tasks, old report PRs, and malformed bodies", async () => {
    const handler = createApiHandler(ctx);
    expect((await handler.handle(request(["tasks", "missing", "pull-request"]))).status).toBe(404);
    for (const invalid of [null, [], "text", 7]) {
      expect((await handler.handle(request(mergeRoute, "POST", invalid))).status).toBe(400);
    }
    b.add({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: "No PR", evidence: "" } });
    expect((await handler.handle(request(mergeRoute, "POST", body))).status).toBe(404);
    expect(writes).toEqual([]);
  });
  it("returns conflicts and connection failures with actionable status codes", async () => {
    rs.spyOn(PullRequestService.prototype, "merge").mockRejectedValue(new PullRequestError("New commits were pushed", 409));
    expect((await createApiHandler(ctx).handle(request(mergeRoute, "POST", body))).status).toBe(409);
    rs.spyOn(PullRequestService.prototype, "read").mockRejectedValue(new PullRequestError("Connect GitHub", 503));
    expect((await createApiHandler(ctx).handle(request(route))).status).toBe(503);
  });
});
