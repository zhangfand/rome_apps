import { asc, sql } from "drizzle-orm";
import type { AppDbContext } from "@rome-os/app-runtime";
import { INDICATORS } from "../../domain/indicators.js";
import type { IndicatorDef } from "../../domain/types.js";
import { createAppDbSchema } from "../schema.js";

/**
 * Upsert the canonical indicator dictionary (src/domain/indicators.ts) into
 * `indicator_defs`. Idempotent; safe to call on every startup. Rows for codes
 * that were removed from the dictionary are kept so historical results still
 * resolve to a name.
 */
export function syncIndicatorDefs(ctx: AppDbContext, defs: IndicatorDef[] = INDICATORS): { upserted: number } {
  const { indicatorDefs } = createAppDbSchema(ctx.tablePrefix);
  const now = new Date();
  const db = ctx.connection;
  db.transaction((tx) => {
    defs.forEach((d, i) => {
      const row = {
        code: d.code,
        nameZh: d.zh,
        nameEn: d.en,
        aliases: d.aliases,
        category: d.category,
        unit: d.unit,
        valueType: d.valueType,
        conversions: d.conversions ?? [],
        refRange: d.ref ?? null,
        direction: d.direction,
        sex: d.sex ?? null,
        derived: d.derived ?? false,
        explain: d.explain,
        sortOrder: i,
        updatedAt: now,
      };
      const { code: _code, ...update } = row;
      tx.insert(indicatorDefs).values(row).onConflictDoUpdate({ target: indicatorDefs.code, set: update }).run();
    });
  });
  return { upserted: defs.length };
}

export function listIndicatorDefs(ctx: AppDbContext) {
  const { indicatorDefs } = createAppDbSchema(ctx.tablePrefix);
  return ctx.connection.select().from(indicatorDefs).orderBy(asc(indicatorDefs.sortOrder)).all();
}

export function countIndicatorDefs(ctx: AppDbContext): number {
  const { indicatorDefs } = createAppDbSchema(ctx.tablePrefix);
  const row = ctx.connection.select({ n: sql<number>`count(*)` }).from(indicatorDefs).get();
  return Number(row?.n ?? 0);
}
