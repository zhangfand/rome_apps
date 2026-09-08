import { desc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import type { RunFile, RunReport, RunStatus } from "../../lib/types.js";
import { createAppDbSchema } from "../schema.js";

/** A run row with `reportJson` and `filesJson` already decoded. */
export interface Run {
  id: string;
  playscriptId: string;
  status: RunStatus;
  /** Absolute path to the run's output directory. */
  dir: string;
  report: RunReport | null;
  files: RunFile[];
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface NewRun {
  playscriptId: string;
  dir: string;
  /** Supplied when the caller derives the run directory from the id, so the two agree. */
  id?: string;
}

interface RunRow {
  id: string;
  playscriptId: string;
  status: string;
  dir: string;
  reportJson: string | null;
  filesJson: string | null;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

function decode(row: RunRow): Run {
  return {
    id: row.id,
    playscriptId: row.playscriptId,
    status: row.status as RunStatus,
    dir: row.dir,
    report: row.reportJson ? (JSON.parse(row.reportJson) as RunReport) : null,
    files: row.filesJson ? (JSON.parse(row.filesJson) as RunFile[]) : [],
    error: row.error,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

/**
 * Reads and writes runs. A run is created `queued` and moves through `running`
 * to `done` or `failed`; the status writers below are the only way it moves,
 * and they stamp `finishedAt` on the terminal states.
 */
export class RunsRepository {
  private readonly tables;

  constructor(
    private readonly db: DrizzleDb,
    tablePrefix: string,
  ) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  /** Newest first. */
  async list(limit = 50): Promise<Run[]> {
    const rows = this.db
      .select()
      .from(this.tables.runs)
      .orderBy(desc(this.tables.runs.startedAt))
      .limit(limit)
      .all() as RunRow[];
    return rows.map(decode);
  }

  /** Newest first. */
  async listForPlayscript(playscriptId: string, limit = 50): Promise<Run[]> {
    const rows = this.db
      .select()
      .from(this.tables.runs)
      .where(eq(this.tables.runs.playscriptId, playscriptId))
      .orderBy(desc(this.tables.runs.startedAt))
      .limit(limit)
      .all() as RunRow[];
    return rows.map(decode);
  }

  async byId(id: string): Promise<Run | undefined> {
    const row = this.db.select().from(this.tables.runs).where(eq(this.tables.runs.id, id)).get() as
      | RunRow
      | undefined;
    return row ? decode(row) : undefined;
  }

  /** Creates the run in `queued`. Does not create the directory on disk. */
  async insert(input: NewRun): Promise<Run> {
    const now = new Date();
    const run: Run = {
      id: input.id ?? crypto.randomUUID(),
      playscriptId: input.playscriptId,
      status: "queued",
      dir: input.dir,
      report: null,
      files: [],
      error: null,
      startedAt: now,
      finishedAt: null,
    };
    this.db
      .insert(this.tables.runs)
      .values({
        id: run.id,
        playscriptId: run.playscriptId,
        status: run.status,
        dir: run.dir,
        reportJson: null,
        filesJson: null,
        error: null,
        startedAt: now,
        finishedAt: null,
      })
      .run();
    return run;
  }

  /**
   * Moves the run to `status`. `done` and `failed` stamp `finishedAt`; `error`
   * is stored on `failed` and cleared otherwise. Returns the updated run, or
   * undefined when no run has that id.
   */
  async updateStatus(id: string, status: RunStatus, error?: string): Promise<Run | undefined> {
    const existing = await this.byId(id);
    if (!existing) return undefined;
    const terminal = status === "done" || status === "failed";
    const next: Run = {
      ...existing,
      status,
      error: status === "failed" ? (error ?? existing.error) : null,
      finishedAt: terminal ? new Date() : null,
    };
    this.db
      .update(this.tables.runs)
      .set({ status: next.status, error: next.error, finishedAt: next.finishedAt })
      .where(eq(this.tables.runs.id, id))
      .run();
    return next;
  }

  /** Replaces the report. Leaves the status alone, so the caller marks the run done separately. */
  async setReport(id: string, report: RunReport): Promise<Run | undefined> {
    const existing = await this.byId(id);
    if (!existing) return undefined;
    this.db
      .update(this.tables.runs)
      .set({ reportJson: JSON.stringify(report) })
      .where(eq(this.tables.runs.id, id))
      .run();
    return { ...existing, report };
  }

  /** Replaces the whole file list, so the caller passes every artifact it wants recorded. */
  async setFiles(id: string, files: RunFile[]): Promise<Run | undefined> {
    const existing = await this.byId(id);
    if (!existing) return undefined;
    this.db
      .update(this.tables.runs)
      .set({ filesJson: JSON.stringify(files) })
      .where(eq(this.tables.runs.id, id))
      .run();
    return { ...existing, files };
  }

  /** Does not delete the run directory on disk. */
  async remove(id: string): Promise<boolean> {
    const existing = await this.byId(id);
    if (!existing) return false;
    this.db.delete(this.tables.runs).where(eq(this.tables.runs.id, id)).run();
    return true;
  }
}

export function createRunsRepository(ctx: AppDbContext): RunsRepository {
  return new RunsRepository(ctx.connection, ctx.tablePrefix);
}
