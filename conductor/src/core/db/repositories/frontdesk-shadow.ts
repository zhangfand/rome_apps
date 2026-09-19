import { desc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";
import type {
  ActualFrontdeskOutcome,
  FrontdeskComparison,
  FrontdeskDecision,
  FrontdeskState,
  JevEvaluation,
} from "../../frontdesk/types.js";

export type FrontdeskShadowStatus = "running" | "completed" | "error" | "skipped_missing_api_key";

export interface FrontdeskShadowRow {
  id: string;
  sessionId: string;
  channelThreadKey: string;
  input: string;
  state: FrontdeskState;
  status: FrontdeskShadowStatus;
  model?: string;
  decision?: FrontdeskDecision;
  rawResponse?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  error?: string;
  actual: ActualFrontdeskOutcome;
  matched?: boolean;
  mismatch?: string;
  createdAt: Date;
  completedAt?: Date;
}

function json<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as T;
}

function toRow(row: ReturnType<FrontdeskShadowRepository["rawRecent"]>[number]): FrontdeskShadowRow {
  return {
    id: row.id,
    sessionId: row.sessionId,
    channelThreadKey: row.channelThreadKey,
    input: row.input,
    state: JSON.parse(row.state) as FrontdeskState,
    status: row.status as FrontdeskShadowStatus,
    ...(row.model ? { model: row.model } : {}),
    ...(row.decision ? { decision: json<FrontdeskDecision>(row.decision) } : {}),
    ...(row.rawResponse ? { rawResponse: json(row.rawResponse) } : {}),
    ...(row.inputTokens !== null ? { inputTokens: row.inputTokens } : {}),
    ...(row.outputTokens !== null ? { outputTokens: row.outputTokens } : {}),
    ...(row.latencyMs !== null ? { latencyMs: row.latencyMs } : {}),
    ...(row.error ? { error: row.error } : {}),
    actual: {
      ...(row.actualKind ? { kind: row.actualKind as ActualFrontdeskOutcome["kind"] } : {}),
      ...(row.actualTaskId ? { taskId: row.actualTaskId } : {}),
      ...(row.actualProjectId ? { projectId: row.actualProjectId } : {}),
    },
    ...(row.matched !== null ? { matched: row.matched } : {}),
    ...(row.mismatch ? { mismatch: row.mismatch } : {}),
    createdAt: row.createdAt,
    ...(row.completedAt ? { completedAt: row.completedAt } : {}),
  };
}

export class FrontdeskShadowRepository {
  private readonly table;

  constructor(private readonly db: DrizzleDb, tablePrefix: string) {
    this.table = createAppDbSchema(tablePrefix).frontdeskShadowRuns;
  }

  begin(input: {
    id: string;
    sessionId: string;
    channelThreadKey: string;
    message: string;
    state: FrontdeskState;
    status?: FrontdeskShadowStatus;
  }): void {
    this.db.insert(this.table).values({
      id: input.id,
      sessionId: input.sessionId,
      channelThreadKey: input.channelThreadKey,
      input: input.message,
      state: JSON.stringify(input.state),
      status: input.status ?? "running",
      createdAt: new Date(),
    }).run();
  }

  complete(
    id: string,
    evaluation: JevEvaluation,
    actual: ActualFrontdeskOutcome,
    comparison: FrontdeskComparison,
  ): void {
    this.db.update(this.table).set({
      status: "completed",
      model: evaluation.model,
      decision: JSON.stringify(evaluation.decision),
      rawResponse: JSON.stringify(evaluation.rawResponse),
      inputTokens: evaluation.usage.inputTokens,
      outputTokens: evaluation.usage.outputTokens,
      latencyMs: evaluation.latencyMs,
      actualKind: actual.kind,
      actualTaskId: actual.taskId,
      actualProjectId: actual.projectId,
      matched: comparison.matched,
      mismatch: comparison.mismatch,
      completedAt: new Date(),
    }).where(eq(this.table.id, id)).run();
  }

  fail(id: string, error: string, actual: ActualFrontdeskOutcome): void {
    this.db.update(this.table).set({
      status: "error",
      error,
      actualKind: actual.kind,
      actualTaskId: actual.taskId,
      actualProjectId: actual.projectId,
      completedAt: new Date(),
    }).where(eq(this.table.id, id)).run();
  }

  finishSkipped(id: string, actual: ActualFrontdeskOutcome): void {
    this.db.update(this.table).set({
      status: "skipped_missing_api_key",
      actualKind: actual.kind,
      actualTaskId: actual.taskId,
      actualProjectId: actual.projectId,
      completedAt: new Date(),
    }).where(eq(this.table.id, id)).run();
  }

  rawRecent(limit: number) {
    return this.db.select().from(this.table).orderBy(desc(this.table.createdAt)).limit(limit).all();
  }

  recent(limit: number): FrontdeskShadowRow[] {
    return this.rawRecent(limit).map(toRow);
  }
}

export function createFrontdeskShadowRepository(ctx: AppDbContext): FrontdeskShadowRepository {
  return new FrontdeskShadowRepository(ctx.connection, ctx.tablePrefix);
}
