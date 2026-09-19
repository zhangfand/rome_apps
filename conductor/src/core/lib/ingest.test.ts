import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { ConductorConfig } from "./config.js";
import type { Fact, NewFact } from "./facts.js";
import { fold } from "./fold.js";
import { applyIngest, ingestAtomically, type IngestRequest, planIngest } from "./ingest.js";
import { LedgerRepository } from "../db/repositories/ledger.js";

let seq = 0;
const t0 = Date.parse("2026-09-14T00:00:00Z");
function f(fact: NewFact): Fact {
  seq += 1;
  return { ...fact, seq, id: `f${seq}`, createdAt: new Date(t0 + seq * 1000) } as Fact;
}

const config = {
  projects: { playground: { workingDir: "/work", workspace: "directory" } },
  defaultProject: "playground",
  sop: "sop",
  workerAgents: { "coding:coding": "" },
  orchestratorAgent: "conductor:orchestrator",
  maxWorkers: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  maxDecisionsPerTurn: 25,
} satisfies ConductorConfig;

const snapshotOf = (facts: Fact[]) => fold(new Date(t0), facts);
const ids = () => {
  let n = 0;
  return () => `t-${++n}`;
};
const plan = (requests: IngestRequest[], facts: Fact[] = [], claimed?: Map<string, string>) =>
  planIngest({ snapshot: snapshotOf(facts), config, requests, newTaskId: ids(), claimed });

const openTask = (over: Partial<IngestRequest> = {}): IngestRequest =>
  ({ op: "open_task", source: "orders", brief: "ship it", key: "order-7", actor: "ada", ...over }) as IngestRequest;

describe("the ingest seam writes only what a source is allowed to write", () => {
  it("opens a task, computing the author from the source and actor", () => {
    const [p] = plan([openTask()]);
    expect(p.status).toBe("recorded");
    if (p.status !== "recorded") return;
    expect(p.fact.kind).toBe("Created");
    expect(p.fact.by).toBe("orders:ada");
    expect(p.fact.payload).toMatchObject({
      brief: "ship it",
      projectId: "playground",
      origin: { source: "orders", key: "order-7", actor: "ada" },
    });
  });

  it("names the bare source when the request names no actor", () => {
    const [p] = plan([openTask({ actor: undefined })]);
    expect(p.status === "recorded" && p.fact.by).toBe("orders");
  });

  it("refuses a source that would impersonate a ledger identity", () => {
    for (const source of ["runtime", "orchestrator"]) {
      const [p] = plan([openTask({ source })]);
      expect(p.status).toBe("rejected");
      expect(p.status === "rejected" && p.reason).toMatch(/reserved/);
    }
  });

  it("refuses a source that is not a slug", () => {
    for (const source of ["", "Orders", "two words", "a:b"]) {
      expect(plan([openTask({ source })])[0].status).toBe("rejected");
    }
  });

  it("opens one task per (source, key), across a batch and across the ledger", () => {
    const batch = plan([openTask(), openTask({ brief: "again" })]);
    expect(batch.map((p) => p.status)).toEqual(["recorded", "duplicate"]);

    const existing = [f((batch[0] as { fact: NewFact }).fact)];
    const later = plan([openTask({ brief: "third time" })], existing);
    expect(later[0].status).toBe("duplicate");
    expect(later[0].status === "duplicate" && later[0].taskId).toBe("t-1");
  });

  it("honours keys an adapter claims for reasons the ledger cannot see", () => {
    const claimed = new Map([["orders:order-7", "t-chat"]]);
    const [p] = plan([openTask()], [], claimed);
    expect(p.status).toBe("duplicate");
    expect(p.status === "duplicate" && p.taskId).toBe("t-chat");
  });

  it("treats a keyless request as a fresh ask every time", () => {
    const both = plan([openTask({ key: undefined }), openTask({ key: undefined })]);
    expect(both.map((p) => p.status)).toEqual(["recorded", "recorded"]);
    expect(both[0].status === "recorded" && both[0].fact.payload).not.toHaveProperty("origin");
  });

  it("still reads the legacy issue origin when deciding what is new", () => {
    const legacy = [f({
      taskId: "t-old", kind: "Created", by: "github:zhangfand", source: "issue",
      payload: { brief: "old", issue: { url: "https://github.com/o/n/issues/1", repo: "o/n", number: 1, title: "t", author: "zhangfand", label: "conductor" } },
    })];
    const [p] = plan([openTask({ source: "github", key: "https://github.com/o/n/issues/1" })], legacy);
    expect(p.status).toBe("duplicate");
    expect(p.status === "duplicate" && p.taskId).toBe("t-old");
  });
});

describe("events", () => {
  const created = f({ taskId: "t-1", kind: "Created", by: "zhangfan", source: "do it", payload: { brief: "b", projectId: "playground", project: { workingDir: "/repo" } } });
  const event = (over: Partial<IngestRequest> = {}): IngestRequest =>
    ({ op: "push_event", source: "ci", taskId: "t-1", type: "build_failed", summary: "red", key: "build-9", ...over }) as IngestRequest;

  it("records an event as the runtime, with the source in the payload", () => {
    const [p] = plan([event()], [created]);
    expect(p.status).toBe("recorded");
    if (p.status !== "recorded") return;
    // `by` stays the runtime so an Event can never read as a person speaking
    // and reset the circuit breaker, whoever pushed it.
    expect(p.fact.by).toBe("runtime");
    expect(p.fact.payload).toMatchObject({ source: "ci", type: "build_failed", summary: "red", data: { key: "build-9" } });
  });

  it("records each key once, in a batch and against the ledger", () => {
    const batch = plan([event(), event({ summary: "still red" })], [created]);
    expect(batch.map((p) => p.status)).toEqual(["recorded", "duplicate"]);
    const withFact = [created, f((batch[0] as { fact: NewFact }).fact)];
    expect(plan([event()], withFact)[0].status).toBe("duplicate");
  });

  it("scopes keys by source, so two systems may use the same key", () => {
    const batch = plan([event(), event({ source: "github" })], [created]);
    expect(batch.map((p) => p.status)).toEqual(["recorded", "recorded"]);
  });

  it("falls back to the type as the key", () => {
    const batch = plan([event({ key: undefined }), event({ key: undefined, summary: "again" })], [created]);
    expect(batch.map((p) => p.status)).toEqual(["recorded", "duplicate"]);
  });

  it("refuses an unknown task and a closed one", () => {
    expect(plan([event({ taskId: "t-nope" })], [created])[0].status).toBe("rejected");
    const closed = [created, f({ taskId: "t-1", kind: "Completed", by: "zhangfan", payload: { reason: "done" } })];
    const [p] = plan([event()], closed);
    expect(p.status).toBe("rejected");
    expect(p.status === "rejected" && p.reason).toMatch(/completed/);
  });

  it("refuses a malformed type, an empty summary and oversized data", () => {
    expect(plan([event({ type: "Build Failed" })], [created])[0].status).toBe("rejected");
    expect(plan([event({ summary: "  " })], [created])[0].status).toBe("rejected");
    expect(plan([event({ data: { blob: "x".repeat(40_000) } })], [created])[0].status).toBe("rejected");
    expect(plan([event({ data: ["not", "an", "object"] as unknown as Record<string, unknown> })], [created])[0].status).toBe("rejected");
  });
});

describe("applying a plan", () => {
  it("appends only the recorded facts and reports the rest", () => {
    const appended: NewFact[] = [];
    const ledger = { append: (fact: NewFact) => { appended.push(fact); return { seq: appended.length }; } };
    const plans = plan([openTask(), openTask(), openTask({ source: "runtime" })]);
    const outcomes = applyIngest(ledger, plans);
    expect(outcomes.map((o) => o.status)).toEqual(["recorded", "duplicate", "rejected"]);
    expect(appended).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({ kind: "Created", taskId: "t-1", seq: 1 });
  });

  it("re-plans keyed intake under the write reservation so a later caller sees the winner", () => {
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
    const ledger = new LedgerRepository(drizzle(sqlite), "conductor");

    const [first] = ingestAtomically(ledger, { config, requests: [openTask()] });
    const [second] = ingestAtomically(ledger, { config, requests: [openTask({ brief: "same origin, later caller" })] });

    expect(first).toMatchObject({ status: "recorded", kind: "Created" });
    expect(second).toMatchObject({ status: "duplicate", taskId: first.taskId });
    expect(ledger.all().filter((fact) => fact.kind === "Created")).toHaveLength(1);
    sqlite.close();
  });
});
