import { eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";

export const RUNTIME_CONTROL_KEY = "runtime_control";

export interface RuntimeControl {
  paused: boolean;
  updatedAt?: Date;
}

/**
 * Mutable operational control kept outside Conductor's durable configuration.
 * Pausing is deliberately cheap and does not rewrite the routine or the SOP.
 */
export class RuntimeControlRepository {
  private readonly tables;

  constructor(private readonly db: DrizzleDb, tablePrefix: string) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  get(): RuntimeControl {
    const row = this.db
      .select()
      .from(this.tables.config)
      .where(eq(this.tables.config.key, RUNTIME_CONTROL_KEY))
      .get();
    if (!row) return { paused: false };
    try {
      const value = JSON.parse(row.value) as { paused?: unknown };
      return { paused: value.paused === true, updatedAt: row.updatedAt };
    } catch {
      return { paused: false, updatedAt: row.updatedAt };
    }
  }

  setPaused(paused: boolean, now = new Date()): RuntimeControl {
    this.db
      .insert(this.tables.config)
      .values({ key: RUNTIME_CONTROL_KEY, value: JSON.stringify({ paused }), updatedAt: now })
      .onConflictDoUpdate({
        target: this.tables.config.key,
        set: { value: JSON.stringify({ paused }), updatedAt: now },
      })
      .run();
    return { paused, updatedAt: now };
  }
}

export function createRuntimeControlRepository(ctx: AppDbContext): RuntimeControlRepository {
  return new RuntimeControlRepository(ctx.connection, ctx.tablePrefix);
}
