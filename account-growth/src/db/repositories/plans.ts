import { desc } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";

export interface SavedPlan {
  id: string;
  title: string;
  markdown: string;
  performanceSummary: string | null;
  focus: string | null;
  createdAt: Date;
}

export class PlansRepository {
  private readonly tables;

  constructor(
    private readonly db: DrizzleDb,
    tablePrefix: string,
  ) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  async save(input: {
    title: string;
    markdown: string;
    performanceSummary?: string;
    focus?: string;
  }): Promise<SavedPlan> {
    const row: SavedPlan = {
      id: crypto.randomUUID(),
      title: input.title,
      markdown: input.markdown,
      performanceSummary: input.performanceSummary ?? null,
      focus: input.focus ?? null,
      createdAt: new Date(),
    };
    this.db.insert(this.tables.plans).values(row).run();
    return row;
  }

  async list(limit = 12): Promise<SavedPlan[]> {
    return this.db
      .select()
      .from(this.tables.plans)
      .orderBy(desc(this.tables.plans.createdAt))
      .limit(limit)
      .all();
  }
}

export function createPlansRepository(ctx: AppDbContext): PlansRepository {
  return new PlansRepository(ctx.connection, ctx.tablePrefix);
}
