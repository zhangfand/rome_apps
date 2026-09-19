import { describe, expect, it } from "@rstest/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { MessageReceipt, RomeAppContext } from "@rome-os/app-runtime";
import { createInterventionNoticeRepository } from "../db/repositories/intervention-notices.js";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import type { NewFact } from "./facts.js";
import { dispatchInterventionNotices } from "./intervention-notices.js";

describe("guardian intervention notice delivery", () => {
  it("delivers one notice to the approved origin and deduplicates repeated processing", async () => {
    const fixture = setup();
    const created = fixture.appendCreated("task-1", true);
    fixture.append({ taskId: "task-1", kind: "Returned", by: "worker-1", payload: { workerId: "worker-1", status: "blocked", summary: "need help" } });
    const asked = fixture.append({ taskId: "task-1", kind: "Asked", by: "orchestrator", payload: { question: "Choose A or B." } });

    expect(created.payload.interventionRoute?.threadId).toBe("discord-thread");
    const first = await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);
    const second = await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(first).toMatchObject({ queued: 1, delivered: 1 });
    expect(second).toMatchObject({ queued: 0, delivered: 0 });
    expect(fixture.sends).toHaveLength(1);
    expect(fixture.sends[0]).toMatchObject({
      connectionId: "discord-connection",
      conversationId: "discord-thread",
      message: { text: [
        "**Action needed · task-1**",
        "Conductor needs your input to continue this task.",
        "Open the Conductor Board to view the request and respond. You can also reply in this conversation with task ID task-1.",
      ].join("\n\n") },
    });
    const notice = fixture.notices.get(`task-1:asked:${asked.seq}`);
    expect(notice).toMatchObject({ status: "delivered", providerMessageId: "message-1" });
    fixture.close();
  });

  it("never interpolates arbitrary task or question text into Discord", async () => {
    const fixture = setup();
    const adversarial = [
      "The production password is Swordfish! Keep it private.",
      "Authorization: Bearer ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      "Use cloud access key AKIAIOSFODNN7EXAMPLE for this request.",
    ];
    for (const [index, secret] of adversarial.entries()) {
      const taskId = `secret-${index + 1}`;
      fixture.appendCreated(taskId, true, secret);
      fixture.append({ taskId, kind: "Asked", by: "orchestrator", payload: { question: secret } });
    }

    await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(fixture.sends).toHaveLength(adversarial.length);
    for (const [index, secret] of adversarial.entries()) {
      const text = String(fixture.sends[index]!.message.text);
      expect(text).toContain(`Action needed · secret-${index + 1}`);
      expect(text).toContain("Open the Conductor Board");
      expect(text).not.toContain(secret);
      expect(text).not.toContain("Swordfish");
      expect(text).not.toContain("ghp_");
      expect(text).not.toContain("AKIA");
    }
    fixture.close();
  });

  it("falls back to the Board when no approved route exists", async () => {
    const fixture = setup();
    fixture.appendCreated("board-only", false);
    const asked = fixture.append({ taskId: "board-only", kind: "Asked", by: "orchestrator", payload: { question: "Approve release?" } });

    const result = await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(result).toMatchObject({ boardOnly: 1, delivered: 0 });
    expect(fixture.sends).toEqual([]);
    expect(fixture.notices.get(`board-only:asked:${asked.seq}`)).toMatchObject({
      status: "board_only",
      failureCode: "origin_route_unavailable",
    });
    fixture.close();
  });

  it("does not retarget when the captured Discord connection is unavailable", async () => {
    const fixture = setup();
    fixture.talkRouter.list = async () => [{ connectionId: "different-connection", service: "discord" }];
    fixture.appendCreated("revoked", true);
    const asked = fixture.append({ taskId: "revoked", kind: "Asked", by: "orchestrator", payload: { question: "Approve?" } });

    await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(fixture.sends).toEqual([]);
    expect(fixture.notices.get(`revoked:asked:${asked.seq}`)).toMatchObject({
      status: "board_only",
      failureCode: "origin_connection_unavailable",
    });
    fixture.close();
  });

  it("keeps a notice eligible after an unrelated later guardian reply", async () => {
    const fixture = setup();
    fixture.appendCreated("answered", true);
    const asked = fixture.append({ taskId: "answered", kind: "Asked", by: "orchestrator", payload: { question: "Which option?" } });
    fixture.append({ taskId: "answered", kind: "Reply", by: "guardian", payload: { text: "Also update the README." } });

    await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(fixture.sends).toHaveLength(1);
    expect(fixture.notices.get(`answered:asked:${asked.seq}`)).toMatchObject({ status: "delivered" });
    fixture.close();
  });

  it("cancels a pending notice only when a reply explicitly resolves that Asked fact", async () => {
    const fixture = setup();
    fixture.appendCreated("answered", true);
    const asked = fixture.append({ taskId: "answered", kind: "Asked", by: "orchestrator", payload: { question: "Which option?" } });
    fixture.append({
      taskId: "answered",
      kind: "Reply",
      by: "guardian",
      payload: { text: "Option A", resolvesAskedSeq: asked.seq },
    });

    await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(fixture.sends).toEqual([]);
    expect(fixture.notices.get(`answered:asked:${asked.seq}`)).toMatchObject({ status: "cancelled" });
    fixture.close();
  });

  it("does not notify for progress, completion, or ordinary failures", async () => {
    const fixture = setup();
    fixture.appendCreated("routine", true);
    fixture.append({ taskId: "routine", kind: "Reported", by: "orchestrator", payload: { report: "Halfway done" } });
    fixture.append({ taskId: "routine", kind: "Failed", by: "runtime", payload: { workerId: "w1", error: "worker failed" } });
    fixture.append({ taskId: "routine", kind: "Completed", by: "orchestrator", payload: { reason: "done" } });

    const result = await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(result).toMatchObject({ queued: 0, delivered: 0, boardOnly: 0 });
    expect(fixture.sends).toEqual([]);
    expect(fixture.notices.forTask("routine")).toEqual([]);
    fixture.close();
  });

  it("never retries when a provider attempt has an uncertain outcome", async () => {
    const fixture = setup(async () => { throw new Error("transport lost after dispatch"); });
    fixture.appendCreated("unknown", true);
    const asked = fixture.append({ taskId: "unknown", kind: "Asked", by: "orchestrator", payload: { question: "Continue?" } });

    await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);
    await dispatchInterventionNotices(fixture.ctx, fixture.talkRouter);

    expect(fixture.sends).toHaveLength(1);
    expect(fixture.notices.get(`unknown:asked:${asked.seq}`)).toMatchObject({ status: "outcome_unknown" });
    fixture.close();
  });
});

function setup(sendResult: () => Promise<MessageReceipt> = async () => ({ conversationId: "discord-thread", messageId: "message-1" })) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE conductor__facts (seq integer PRIMARY KEY AUTOINCREMENT NOT NULL, id text NOT NULL, task_id text NOT NULL, kind text NOT NULL, by text NOT NULL, source text, payload text NOT NULL, created_at integer NOT NULL);
    CREATE INDEX conductor__facts_task_idx ON conductor__facts(task_id);
    CREATE TABLE conductor__locks (name text PRIMARY KEY NOT NULL, held_until integer NOT NULL);
    CREATE TABLE conductor__worker_health (worker_id text PRIMARY KEY NOT NULL, task_id text NOT NULL, owner_id text NOT NULL, last_heartbeat_at integer NOT NULL, expires_at integer NOT NULL);
    CREATE TABLE conductor__intervention_notices (key text PRIMARY KEY NOT NULL, task_id text NOT NULL, fact_seq integer NOT NULL, status text NOT NULL, provider_message_id text, failure_code text, created_at integer NOT NULL, attempted_at integer, settled_at integer);
    CREATE INDEX conductor__intervention_notices_task_idx ON conductor__intervention_notices(task_id);
  `);
  const db = { connection: drizzle(sqlite), tablePrefix: "conductor", tableName: (name: string) => `conductor__${name}` };
  const sends: Array<{ connectionId: string; conversationId: string; message: Record<string, unknown> }> = [];
  const ctx = {
    db,
    log: { warn: () => undefined },
  } as unknown as RomeAppContext;
  const talkRouter = {
    list: async () => [{ connectionId: "discord-connection", service: "discord" }],
    send: async (connectionId: string, conversationId: string, message: Record<string, unknown>) => {
      sends.push({ connectionId, conversationId, message });
      return sendResult();
    },
  };
  const ledger = createLedgerRepository(db as never);
  const notices = createInterventionNoticeRepository(db as never);
  const append = (fact: NewFact) => ledger.append(fact);
  return {
    ctx,
    talkRouter,
    sends,
    notices,
    append,
    appendCreated(taskId: string, withRoute: boolean, brief = "Ship the release") {
      return append({
        taskId,
        kind: "Created",
        by: "guardian",
        payload: {
          brief,
          ...(withRoute ? {
            interventionRoute: {
              channel: "discord" as const,
              connectionId: "discord-connection",
              threadId: "discord-thread",
              channelUserId: "guardian",
              visibility: "guardian-dm" as const,
            },
          } : {}),
        },
      });
    },
    close: () => sqlite.close(),
  };
}
