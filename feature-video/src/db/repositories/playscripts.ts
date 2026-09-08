import { asc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import type { PlayscriptDoc } from "../../lib/types.js";
import { createAppDbSchema } from "../schema.js";

/** A playscript row with `docJson` already decoded. */
export interface Playscript {
  id: string;
  projectId: string;
  name: string;
  startPath: string;
  doc: PlayscriptDoc;
  createdAt: Date;
  updatedAt: Date;
}

export type NewPlayscript = Omit<Playscript, "id" | "createdAt" | "updatedAt">;

export type PlayscriptPatch = Partial<Omit<NewPlayscript, "projectId">>;

interface PlayscriptRow {
  id: string;
  projectId: string;
  name: string;
  startPath: string;
  docJson: string;
  createdAt: Date;
  updatedAt: Date;
}

function decode(row: PlayscriptRow): Playscript {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    startPath: row.startPath,
    doc: JSON.parse(row.docJson) as PlayscriptDoc,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Reads and writes playscripts. `docJson` is decoded here, so callers only see `PlayscriptDoc`. */
export class PlayscriptsRepository {
  private readonly tables;

  constructor(
    private readonly db: DrizzleDb,
    tablePrefix: string,
  ) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  /** Oldest first. */
  async list(): Promise<Playscript[]> {
    const rows = this.db
      .select()
      .from(this.tables.playscripts)
      .orderBy(asc(this.tables.playscripts.createdAt))
      .all() as PlayscriptRow[];
    return rows.map(decode);
  }

  async listForProject(projectId: string): Promise<Playscript[]> {
    const rows = this.db
      .select()
      .from(this.tables.playscripts)
      .where(eq(this.tables.playscripts.projectId, projectId))
      .orderBy(asc(this.tables.playscripts.createdAt))
      .all() as PlayscriptRow[];
    return rows.map(decode);
  }

  async byId(id: string): Promise<Playscript | undefined> {
    const row = this.db
      .select()
      .from(this.tables.playscripts)
      .where(eq(this.tables.playscripts.id, id))
      .get() as PlayscriptRow | undefined;
    return row ? decode(row) : undefined;
  }

  /** Does not validate the doc — run the checker before storing a playscript a run will use. */
  async insert(input: NewPlayscript): Promise<Playscript> {
    const now = new Date();
    const playscript: Playscript = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .insert(this.tables.playscripts)
      .values({
        id: playscript.id,
        projectId: playscript.projectId,
        name: playscript.name,
        startPath: playscript.startPath,
        docJson: JSON.stringify(playscript.doc),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return playscript;
  }

  /** Returns the updated playscript, or undefined when no playscript has that id. */
  async update(id: string, patch: PlayscriptPatch): Promise<Playscript | undefined> {
    const existing = await this.byId(id);
    if (!existing) return undefined;
    const next: Playscript = { ...existing, ...patch, updatedAt: new Date() };
    this.db
      .update(this.tables.playscripts)
      .set({
        name: next.name,
        startPath: next.startPath,
        docJson: JSON.stringify(next.doc),
        updatedAt: next.updatedAt,
      })
      .where(eq(this.tables.playscripts.id, id))
      .run();
    return next;
  }

  /** Leaves the playscript's runs in place, so a finished recording outlives the script it came from. */
  async remove(id: string): Promise<boolean> {
    const existing = await this.byId(id);
    if (!existing) return false;
    this.db.delete(this.tables.playscripts).where(eq(this.tables.playscripts.id, id)).run();
    return true;
  }
}

export function createPlayscriptsRepository(ctx: AppDbContext): PlayscriptsRepository {
  return new PlayscriptsRepository(ctx.connection, ctx.tablePrefix);
}
