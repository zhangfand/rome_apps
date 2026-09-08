import { describe, expect, it } from "@rstest/core";
import {
  parseWorkerReply,
  replyInstructions,
  validateWorkerRun,
  WORKER_REPLY_SCHEMA,
  type WorkerReply,
} from "./worker-reply.js";

const ready: WorkerReply = { outcome: "ready", summary: "Delivered at /result" };
const waiting: WorkerReply = {
  outcome: "waiting",
  reason: "Check job /jobs/7 again",
  revisitAfterSeconds: 300,
};
const blocked: WorkerReply = { outcome: "blocked", question: "Which requirement wins?" };

describe("worker reply contract", () => {
  for (const value of [ready, waiting, blocked]) {
    it(`accepts ${value.outcome}`, () => {
      expect(parseWorkerReply(JSON.stringify(value))).toEqual({ ok: true, value });
    });
  }
  for (const value of [
    null,
    [],
    true,
    "ready",
    {},
    { outcome: "done", summary: "ok" },
    { outcome: "ready" },
    { outcome: "ready", summary: " \n " },
    { outcome: "ready", summary: 4 },
    { outcome: "ready", summary: "x".repeat(32_001) },
    { outcome: "blocked", question: "" },
    { ...waiting, unexpected: true },
    { ...waiting, summary: "extra" },
    ...[0, -1, 59, 1.5, 86_401, "300", null].map((delay) => ({ ...waiting, revisitAfterSeconds: delay })),
  ]) {
    it(`rejects invalid shape ${JSON.stringify(value).slice(0, 120)}`, () => {
      expect(parseWorkerReply(JSON.stringify(value)).ok).toBe(false);
    });
  }
  for (const text of [
    "Done!",
    "BLOCKED: which database?",
    '```json\n{"outcome":"ready","summary":"ok"}\n```',
    '{"outcome":"ready","summary":"ok"}\nExtra prose',
  ]) {
    it(`does not guess from prose: ${text.slice(0, 30)}`, () => {
      expect(parseWorkerReply(text).ok).toBe(false);
    });
  }
  it("accepts interval boundaries and leading JSON whitespace", () => {
    for (const delay of [60, 86_400]) {
      expect(parseWorkerReply(`\n ${JSON.stringify({ ...waiting, revisitAfterSeconds: delay })} \n`).ok).toBe(
        true,
      );
    }
  });
  it("publishes the exact validation schema in the prompt", () => {
    expect(replyInstructions()).toContain(JSON.stringify(WORKER_REPLY_SCHEMA));
    expect(replyInstructions()).toContain("YOU check");
    expect(replyInstructions()).not.toMatch(/GitHub|pull request|reviewer/);
  });
});

describe("bounded format repair", () => {
  it("does not repair a valid reply", async () => {
    const run = await validateWorkerRun(
      { ok: true, reply: JSON.stringify(waiting), sessionId: "s1" },
      async () => {
        throw new Error("must not call");
      },
    );
    expect(run).toMatchObject({ ok: true, result: waiting, sessionId: "s1" });
  });
  it("returns execution failures unchanged", async () => {
    const failure = { ok: false as const, error: "provider unavailable" };
    expect(
      await validateWorkerRun(failure, async () => {
        throw new Error("must not call");
      }),
    ).toEqual(failure);
  });
  it("repairs once in the returned session and preserves the original output", async () => {
    const calls: string[] = [];
    const run = await validateWorkerRun(
      { ok: true, reply: "Still waiting", sessionId: "s1" },
      async (prompt, sessionId) => {
        calls.push(sessionId);
        expect(prompt).toContain("Do not call tools, redo work");
        expect(prompt).toContain(JSON.stringify(WORKER_REPLY_SCHEMA));
        return { ok: true, reply: JSON.stringify(waiting), sessionId: "s1" };
      },
    );
    expect(calls).toEqual(["s1"]);
    expect(run).toMatchObject({ ok: true, result: waiting, repair: { originalReply: "Still waiting" } });
  });
  it("stops after a second malformed reply", async () => {
    let calls = 0;
    const run = await validateWorkerRun({ ok: true, reply: "old reply", sessionId: "s1" }, async () => {
      calls += 1;
      return { ok: true, reply: "still invalid" };
    });
    expect(calls).toBe(1);
    expect(run).toMatchObject({
      ok: false,
      failureKind: "reply_protocol",
      sessionId: "s1",
      reply: "still invalid",
      repair: { originalReply: "old reply" },
    });
  });
  it("does not rerun the task cold to repair when no session is available", async () => {
    const run = await validateWorkerRun({ ok: true, reply: "invalid" }, async () => {
      throw new Error("must not call");
    });
    expect(run).toMatchObject({ ok: false, failureKind: "reply_protocol" });
  });
  it("handles a failed repair summon without another attempt", async () => {
    const run = await validateWorkerRun({ ok: true, reply: "invalid", sessionId: "s1" }, async () => ({
      ok: false,
      error: "resume rejected",
    }));
    expect(run).toMatchObject({ ok: false, failureKind: "reply_protocol", sessionId: "s1" });
  });
  it("handles a thrown repair failure", async () => {
    const run = await validateWorkerRun({ ok: true, reply: "invalid", sessionId: "s1" }, async () => {
      throw new Error("unavailable");
    });
    expect(run).toMatchObject({ ok: false, failureKind: "reply_protocol", sessionId: "s1" });
  });
});
