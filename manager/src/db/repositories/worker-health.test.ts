import { spawn } from "node:child_process";
import { once } from "node:events";
import { createApiHandler } from "../../api/index.js";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@rstest/core";
import { LedgerRepository } from "./ledger.js";
import { WorkerHealthRepository } from "./worker-health.js";
import { HEARTBEAT_LEASE_MS, WORKER_START_GRACE_MS } from "../../lib/worker-health.js";
import type { StartedFact } from "../../lib/facts.js";
import { fold } from "../../lib/fold.js";
import { reconcile } from "../../lib/reconcile.js";
import { judge } from "../../lib/judge.js";
import { parseConfig } from "../../lib/config.js";
import { observeWorkerHealth } from "../../actions/reconcile/index.js";

let dir: string;
let file: string;
let db: Database.Database;
let ledger: LedgerRepository;
let health: WorkerHealthRepository;
const connections: Database.Database[] = [];
function connect() {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  connections.push(sqlite);
  const connection = drizzle(sqlite);
  migrate(connection, { migrationsFolder: path.join(process.cwd(), "src/db/migrations") });
  return { db: sqlite, ledger: new LedgerRepository(connection, "manager"), health: new WorkerHealthRepository(connection, "manager") };
}
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "manager-heartbeat-"));
  file = path.join(dir, "test.sqlite");
  ({ db, ledger, health } = connect());
});
afterEach(() => {
  for (const connection of connections.splice(0)) if (connection.open) connection.close();
  rmSync(dir, { recursive: true, force: true });
});
function start(workerId = "w1", monitored = true): StartedFact {
  if (!ledger.factsFor("t1").length) {
    ledger.append({ taskId: "t1", kind: "Created", by: "guardian", payload: { brief: "test" } });
    ledger.append({ taskId: "t1", kind: "Taken", by: "runtime", payload: {} });
  }
  return ledger.append({ taskId: "t1", kind: "Started", by: "runtime", payload: {
    workerId, prompt: "go", ...(monitored ? { heartbeatProtocol: 1 } : {}),
  } }) as StartedFact;
}
function returned(workerId = "w1") {
  return ledger.appendWorkerOutcome({ taskId: "t1", kind: "Returned", by: workerId,
    payload: { workerId, reply: "done", sessionId: "s1" } });
}
function after(started: StartedFact, ms: number) { return new Date(+started.createdAt + ms); }

describe("durable worker heartbeats (real SQLite migrations and connections)", () => {
  it("compare-and-append prevents backfill from overriding a concurrent human change", () => {
    start(); returned();
    const report = ledger.append({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: "ready", evidence: "w1" } });
    const other = connect().ledger;
    other.append({ taskId: "t1", kind: "Completed", by: "guardian", payload: {} });
    expect(ledger.appendIfLatest({ taskId: "t1", kind: "Reply", by: "guardian", payload: { text: "backfill" } }, report.seq)).toBeUndefined();
    expect(ledger.all().at(-1)?.kind).toBe("Completed");
  });
  it("compare-and-append records a matching request exactly once", () => {
    start(); returned();
    const report = ledger.append({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: "ready", evidence: "w1" } });
    const fact = { taskId: "t1", kind: "Reply" as const, by: "guardian", payload: { text: "backfill" } };
    expect(ledger.appendIfLatest(fact, report.seq)?.kind).toBe("Reply");
    expect(ledger.appendIfLatest(fact, report.seq)).toBeUndefined();
  });
  it("rejects a late assessment after human steering even before Lost is written", () => {
    start();
    ledger.append({ taskId: "t1", kind: "Reply", by: "guardian", payload: { text: "Changed acceptance criteria" } });
    expect(returned()).toBeUndefined();
    expect(ledger.all().at(-1)?.kind).toBe("Reply");
  });
  it("rejects late output after human completion", () => {
    start();
    ledger.append({ taskId: "t1", kind: "Completed", by: "guardian", payload: {} });
    expect(returned()).toBeUndefined();
    expect(ledger.all().at(-1)?.kind).toBe("Completed");
  });
  it("heartbeats update one row, never append ledger facts", () => {
    const s = start(); const count = ledger.all().length;
    expect(health.claim(s, "owner", s.createdAt)).toBe(true);
    expect(health.renew("t1", "w1", "owner", after(s, 30_000))).toBe(true);
    expect(health.peek("w1")?.lastHeartbeatAt).toBe(+s.createdAt + 30_000);
    expect(ledger.all()).toHaveLength(count);
    expect(db.prepare("select count(*) as count from manager__worker_health").get()).toEqual({ count: 1 });
  });
  it("recovers a killed wrapper after restart without refreshing its persisted lease", () => {
    const s = start(); health.claim(s, "old-process", s.createdAt);
    health.renew("t1", "w1", "old-process", after(s, 30_000));
    db.close(); // A newly opened supervisor has no live wrapper/timer.
    ({ db, ledger, health } = connect());
    const observedAt = after(s, HEARTBEAT_LEASE_MS + 30_000);
    expect(observeWorkerHealth(ledger, health, observedAt)).toHaveLength(1);
    expect(ledger.all().at(-1)).toMatchObject({ kind: "Lost", payload: { workerId: "w1", why: expect.stringContaining("heartbeat expired") } });
    expect(health.peek("w1")?.lastHeartbeatAt).toBe(+s.createdAt + 30_000);
    expect(observeWorkerHealth(ledger, health, observedAt)).toEqual([]);
    expect(returned()).toBeUndefined();
    const config = parseConfig({ workingDir: "/repo", startCap: 2 });
    if (!config.ok) throw new Error(config.error);
    const actions = reconcile({ snapshot: fold(observedAt, ledger.all()), config: config.config, judge, newWorkerId: () => "w2" });
    expect(actions.find((a) => a.type === "launch")).toMatchObject({ workerId: "w2" });
    expect(actions.find((a) => a.type === "append" && a.fact.kind === "Started")).toMatchObject({ fact: { payload: { heartbeatProtocol: 1 } } });
  });
  it("detects a SIGKILLed wrapper using only its durable heartbeat", async () => {
    const s = start();
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import Database from "better-sqlite3";
      import { drizzle } from "drizzle-orm/better-sqlite3";
      import { LedgerRepository } from "./src/db/repositories/ledger.ts";
      import { WorkerHealthRepository } from "./src/db/repositories/worker-health.ts";
      import { startHeartbeatTimer } from "./src/lib/worker-health.ts";
      const db = drizzle(new Database(process.argv[1]));
      const ledger = new LedgerRepository(db, "manager");
      const health = new WorkerHealthRepository(db, "manager");
      const started = ledger.factsFor("t1").find(f => f.kind === "Started");
      if (!health.claim(started, "child-owner")) throw new Error("claim rejected");
      startHeartbeatTimer(() => health.renew("t1", "w1", "child-owner"), () => {});
      process.send({ ready: true });
      setInterval(() => {}, 1000);
    `, file], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe", "ipc"] });
    let stderr = "";
    child.stderr!.on("data", (data) => { stderr += data; });
    try {
      await Promise.race([
        once(child, "message"),
        once(child, "exit").then(() => { throw new Error(`fixture exited early: ${stderr}`); }),
      ]);
      const last = health.peek("w1")!;
      expect(last.ownerId).toBe("child-owner");
      const exit = once(child, "exit");
      child.kill("SIGKILL");
      await exit;
      db.close();
      ({ db, ledger, health } = connect());
      expect(health.expire("t1", "w1", new Date(last.expiresAt))?.kind).toBe("Lost");
      expect(health.peek("w1")).toEqual(last);
      expect(health.claim(s, "replacement-with-same-id", new Date(last.expiresAt))).toBe(false);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit"); child.kill("SIGKILL"); await exit;
      }
    }
  });
  it("covers Started persisted but wrapper never launched, without waiting for Opened", () => {
    const s = start();
    expect(health.expire("t1", "w1", after(s, WORKER_START_GRACE_MS - 1))).toBeUndefined();
    expect(health.expire("t1", "w1", after(s, WORKER_START_GRACE_MS))).toMatchObject({ kind: "Lost", payload: { why: expect.stringContaining("startup heartbeat missing") } });
    expect(health.claim(s, "late-process", after(s, WORKER_START_GRACE_MS))).toBe(false);
  });
  it("duplicate dispatch and wrong-owner renewals cannot steal a lease", () => {
    const s = start();
    expect(health.claim(s, "a", s.createdAt)).toBe(true);
    expect(health.claim(s, "b", s.createdAt)).toBe(false);
    expect(health.renew("t1", "w1", "b", after(s, 1000))).toBe(false);
    expect(health.peek("w1")?.ownerId).toBe("a");
  });
  it("rejects late renewal and never replaces the same worker's expired owner", () => {
    const s = start(); health.claim(s, "a", s.createdAt);
    expect(health.renew("t1", "w1", "a", after(s, HEARTBEAT_LEASE_MS))).toBe(false);
    expect(health.claim(s, "b", after(s, HEARTBEAT_LEASE_MS))).toBe(false);
    expect(health.expire("t1", "w1", after(s, HEARTBEAT_LEASE_MS))?.kind).toBe("Lost");
  });
  it("rechecks a concurrent renewal rather than trusting a stale expired snapshot", () => {
    const s = start(); health.claim(s, "a", s.createdAt);
    const other = connect();
    expect(other.health.renew("t1", "w1", "a", after(s, HEARTBEAT_LEASE_MS - 1))).toBe(true);
    expect(health.expire("t1", "w1", after(s, HEARTBEAT_LEASE_MS))).toBeUndefined();
  });
  it("completion winning the race prevents Lost; Lost winning prevents completion", () => {
    const s = start(); health.claim(s, "a", s.createdAt);
    const other = connect();
    expect(other.ledger.appendWorkerOutcome({ taskId: "t1", kind: "Failed", by: "w1", payload: { workerId: "w1", error: "exit" } })).toBeDefined();
    expect(health.expire("t1", "w1", after(s, HEARTBEAT_LEASE_MS))).toBeUndefined();
    expect(returned()).toBeUndefined();
    expect(health.renew("t1", "w1", "a", after(s, 1000))).toBe(false);
    const s2 = start("w2"); health.claim(s2, "b", s2.createdAt);
    expect(health.expire("t1", "w2", after(s2, HEARTBEAT_LEASE_MS))?.kind).toBe("Lost");
    expect(other.ledger.appendWorkerOutcome({ taskId: "t1", kind: "Returned", by: "w2", payload: { workerId: "w2", reply: "late" } })).toBeUndefined();
  });
  it("does not monitor historical workers or terminal tasks", () => {
    const s = start("w1", false);
    expect(health.status(after(s, 24 * 3600_000))[0].status).toBe("legacy");
    expect(health.expire("t1", "w1", after(s, 24 * 3600_000))).toBeUndefined();
    returned();
    const s2 = start("w2"); health.claim(s2, "b", s2.createdAt);
    ledger.append({ taskId: "t1", kind: "Completed", by: "guardian", payload: {} });
    expect(health.expire("t1", "w2", after(s2, HEARTBEAT_LEASE_MS))).toBeUndefined();
    expect(health.renew("t1", "w2", "b", after(s2, 1000))).toBe(false);
  });
  it("does not expire workers that returned waiting or ready", () => {
    const s = start(); health.claim(s, "a", s.createdAt); returned();
    expect(health.status()).toEqual([]);
    expect(observeWorkerHealth(ledger, health, after(s, HEARTBEAT_LEASE_MS))).toEqual([]);
  });
  it("unavailable health storage is unknown, never converted to Lost", () => {
    const s = start(); db.exec("drop table manager__worker_health");
    expect(observeWorkerHealth(ledger, health, after(s, HEARTBEAT_LEASE_MS))).toEqual([]);
    expect(ledger.all().at(-1)?.kind).toBe("Started");
  });
  it("exposes a guardian-only read-only health endpoint without owner tokens", async () => {
    const s = start(); health.claim(s, "owner", s.createdAt);
    const before = health.peek("w1");
    const factsBefore = ledger.all();
    const handler = createApiHandler({
      db: { connection: drizzle(db), tablePrefix: "manager" },
      runAction: async () => { throw new Error("read-only endpoint must not run actions"); },
      log: { error: () => {} },
    } as never);
    const request = { path: ["worker-health"], method: "GET", query: new URLSearchParams(), caller: { kind: "guardian" } };
    const res = await handler.handle(request as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workers[0]).toMatchObject({ workerId: "w1", status: "alive" });
    expect(body.workers[0].ownerId).toBeUndefined();
    expect(health.peek("w1")).toEqual(before);
    expect(ledger.all()).toEqual(factsBefore);
    expect((await handler.handle({ ...request, caller: { kind: "anonymous" } } as never)).status).toBe(403);
  });
  it("preserves retry caps after heartbeat loss rather than retrying forever", () => {
    const s = start(); health.claim(s, "a", s.createdAt);
    const now = after(s, HEARTBEAT_LEASE_MS);
    health.expire("t1", "w1", now);
    const config = parseConfig({ workingDir: "/repo", startCap: 1 });
    if (!config.ok) throw new Error(config.error);
    const actions = reconcile({ snapshot: fold(now, ledger.all()), config: config.config, judge, newWorkerId: () => "w2" });
    expect(actions.some((a) => a.type === "launch")).toBe(false);
    expect(actions).toContainEqual(expect.objectContaining({ type: "append", fact: expect.objectContaining({ kind: "Question" }) }));
  });
  it("healthy monitored workers are not killed by the old total-age cap", () => {
    const s = start();
    const config = parseConfig({ workingDir: "/repo", ageCapHours: 1 });
    if (!config.ok) throw new Error(config.error);
    expect(reconcile({ snapshot: fold(after(s, 5 * 3600_000), ledger.all()), config: config.config, judge, newWorkerId: () => "w2" })).toEqual([]);
  });
});
