import { and, asc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";

export const NOTICE_STATUSES = [
  "pending",
  "sending",
  "delivered",
  "board_only",
  "outcome_unknown",
  "cancelled",
] as const;
export type InterventionNoticeStatus = (typeof NOTICE_STATUSES)[number];

export interface InterventionNotice {
  key: string;
  taskId: string;
  factSeq: number;
  status: InterventionNoticeStatus;
  providerMessageId?: string;
  failureCode?: string;
  createdAt: Date;
  attemptedAt?: Date;
  settledAt?: Date;
}

export function interventionNoticeKey(taskId: string, factSeq: number): string {
  return `${taskId}:asked:${factSeq}`;
}

/** Mutable delivery state kept outside the append-only task ledger. */
export class InterventionNoticeRepository {
  private readonly tables;

  constructor(private readonly db: DrizzleDb, tablePrefix: string) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  enqueue(taskId: string, factSeq: number, now = new Date()): InterventionNotice {
    const key = interventionNoticeKey(taskId, factSeq);
    this.db.insert(this.tables.interventionNotices).values({
      key,
      taskId,
      factSeq,
      status: "pending",
      createdAt: now,
    }).onConflictDoNothing().run();
    return this.get(key)!;
  }

  get(key: string): InterventionNotice | undefined {
    const row = this.db.select().from(this.tables.interventionNotices)
      .where(eq(this.tables.interventionNotices.key, key)).get();
    return row ? toNotice(row) : undefined;
  }

  forTask(taskId: string): InterventionNotice[] {
    return this.db.select().from(this.tables.interventionNotices)
      .where(eq(this.tables.interventionNotices.taskId, taskId))
      .orderBy(asc(this.tables.interventionNotices.factSeq)).all().map(toNotice);
  }

  pending(): InterventionNotice[] {
    return this.db.select().from(this.tables.interventionNotices)
      .where(eq(this.tables.interventionNotices.status, "pending"))
      .orderBy(asc(this.tables.interventionNotices.factSeq)).all().map(toNotice);
  }

  /** Atomic claim: concurrent dispatchers cannot both make a send visible. */
  claim(key: string, now = new Date()): boolean {
    const result = this.db.update(this.tables.interventionNotices)
      .set({ status: "sending", attemptedAt: now })
      .where(and(
        eq(this.tables.interventionNotices.key, key),
        eq(this.tables.interventionNotices.status, "pending"),
      )).run();
    return result.changes === 1;
  }

  cancel(key: string, now = new Date()): void {
    this.settlePending(key, "cancelled", "resolved_before_dispatch", now);
  }

  boardOnly(key: string, failureCode: string, now = new Date()): void {
    this.settlePending(key, "board_only", failureCode, now);
  }

  delivered(key: string, providerMessageId: string, now = new Date()): void {
    this.db.update(this.tables.interventionNotices).set({
      status: "delivered",
      providerMessageId,
      failureCode: null,
      settledAt: now,
    }).where(and(
      eq(this.tables.interventionNotices.key, key),
      eq(this.tables.interventionNotices.status, "sending"),
    )).run();
  }

  outcomeUnknown(key: string, failureCode: string, now = new Date()): void {
    this.db.update(this.tables.interventionNotices).set({
      status: "outcome_unknown",
      failureCode,
      settledAt: now,
    }).where(and(
      eq(this.tables.interventionNotices.key, key),
      eq(this.tables.interventionNotices.status, "sending"),
    )).run();
  }

  /** A prior process may have sent after claiming; never retry that row. */
  recoverInterrupted(now = new Date()): number {
    return this.db.update(this.tables.interventionNotices).set({
      status: "outcome_unknown",
      failureCode: "interrupted_after_claim",
      settledAt: now,
    }).where(eq(this.tables.interventionNotices.status, "sending")).run().changes;
  }

  private settlePending(
    key: string,
    status: "board_only" | "cancelled",
    failureCode: string,
    now: Date,
  ): void {
    this.db.update(this.tables.interventionNotices).set({ status, failureCode, settledAt: now })
      .where(and(
        eq(this.tables.interventionNotices.key, key),
        eq(this.tables.interventionNotices.status, "pending"),
      )).run();
  }
}

type NoticeRow = {
  key: string;
  taskId: string;
  factSeq: number;
  status: string;
  providerMessageId: string | null;
  failureCode: string | null;
  createdAt: Date;
  attemptedAt: Date | null;
  settledAt: Date | null;
};

function toNotice(row: NoticeRow): InterventionNotice {
  return {
    key: row.key,
    taskId: row.taskId,
    factSeq: row.factSeq,
    status: row.status as InterventionNoticeStatus,
    ...(row.providerMessageId ? { providerMessageId: row.providerMessageId } : {}),
    ...(row.failureCode ? { failureCode: row.failureCode } : {}),
    createdAt: row.createdAt,
    ...(row.attemptedAt ? { attemptedAt: row.attemptedAt } : {}),
    ...(row.settledAt ? { settledAt: row.settledAt } : {}),
  };
}

export function createInterventionNoticeRepository(ctx: AppDbContext): InterventionNoticeRepository {
  return new InterventionNoticeRepository(ctx.connection, ctx.tablePrefix);
}
