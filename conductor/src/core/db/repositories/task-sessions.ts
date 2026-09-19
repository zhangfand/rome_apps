import { asc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";

export type TaskSessionRole = "coordinator" | "worker";

export interface TaskSessionRef {
  taskId: string;
  sessionId: string;
  sessionType: string;
  role: TaskSessionRole;
  workerId?: string;
  jobId?: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export class TaskSessionRepository {
  private readonly tables;

  constructor(private readonly db: DrizzleDb, tablePrefix: string) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  record(input: Omit<TaskSessionRef, "createdAt" | "lastSeenAt">): TaskSessionRef {
    const now = new Date();
    const row = this.db.insert(this.tables.taskSessions).values({
      id: crypto.randomUUID(),
      taskId: input.taskId,
      sessionId: input.sessionId,
      sessionType: input.sessionType,
      role: input.role,
      workerId: input.workerId,
      jobId: input.jobId,
      createdAt: now,
      lastSeenAt: now,
    }).onConflictDoUpdate({
      target: [this.tables.taskSessions.taskId, this.tables.taskSessions.sessionId],
      set: {
        sessionType: input.sessionType,
        role: input.role,
        workerId: input.workerId,
        jobId: input.jobId,
        lastSeenAt: now,
      },
    }).returning().get();
    return toRef(row);
  }

  forTask(taskId: string): TaskSessionRef[] {
    return this.db.select().from(this.tables.taskSessions)
      .where(eq(this.tables.taskSessions.taskId, taskId))
      .orderBy(asc(this.tables.taskSessions.createdAt))
      .all()
      .map(toRef);
  }

  all(): TaskSessionRef[] {
    return this.db.select().from(this.tables.taskSessions)
      .orderBy(asc(this.tables.taskSessions.createdAt))
      .all()
      .map(toRef);
  }
}

type TaskSessionRow = {
  taskId: string;
  sessionId: string;
  sessionType: string;
  role: string;
  workerId: string | null;
  jobId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
};

function toRef(row: TaskSessionRow): TaskSessionRef {
  return {
    taskId: row.taskId,
    sessionId: row.sessionId,
    sessionType: row.sessionType,
    role: row.role === "worker" ? "worker" : "coordinator",
    workerId: row.workerId ?? undefined,
    jobId: row.jobId ?? undefined,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export function createTaskSessionRepository(ctx: AppDbContext): TaskSessionRepository {
  return new TaskSessionRepository(ctx.connection, ctx.tablePrefix);
}
