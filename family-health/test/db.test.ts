import { describe, expect, it } from "vitest";
import { INDICATORS } from "../src/domain/indicators.js";
import { countIndicatorDefs, listIndicatorDefs, syncIndicatorDefs } from "../src/db/repositories/indicator-defs.js";
import { createTestDb } from "./sqlite.js";

describe("migrations", () => {
  it("create every table with the app prefix", () => {
    const { raw } = createTestDb();
    const tables = (raw.prepare("select name from sqlite_master where type='table' order by name").all() as Array<{ name: string }>)
      .map((r) => r.name)
      .filter((n) => n.startsWith("family_health__"));
    expect(tables).toEqual([
      "family_health__findings",
      "family_health__indicator_defs",
      "family_health__insights",
      "family_health__interventions",
      "family_health__measurements",
      "family_health__members",
      "family_health__reports",
      "family_health__results",
    ]);
  });
});

describe("indicator_defs sync", () => {
  it("upserts the whole dictionary idempotently", () => {
    const { ctx } = createTestDb();
    expect(syncIndicatorDefs(ctx).upserted).toBe(INDICATORS.length);
    expect(countIndicatorDefs(ctx)).toBe(INDICATORS.length);
    syncIndicatorDefs(ctx);
    expect(countIndicatorDefs(ctx)).toBe(INDICATORS.length);
  });

  it("round-trips JSON columns and ordering", () => {
    const { ctx } = createTestDb();
    syncIndicatorDefs(ctx);
    const rows = listIndicatorDefs(ctx);
    expect(rows[0].code).toBe(INDICATORS[0].code);
    const tg = rows.find((r) => r.code === "TG")!;
    expect(tg.aliases).toContain("三酰甘油");
    expect(tg.conversions).toEqual([{ unit: "mg/dL", factor: 0.01129 }]);
    const alt = rows.find((r) => r.code === "ALT")!;
    expect(alt.refRange).toEqual({ male: { low: 9, high: 50 }, female: { low: 7, high: 40 } });
    expect(rows.find((r) => r.code === "EGFR")!.derived).toBe(true);
  });

  it("updates changed definitions in place", () => {
    const { ctx } = createTestDb();
    syncIndicatorDefs(ctx);
    const changed = INDICATORS.map((d) => (d.code === "TG" ? { ...d, explain: "已更新" } : d));
    syncIndicatorDefs(ctx, changed);
    expect(listIndicatorDefs(ctx).find((r) => r.code === "TG")!.explain).toBe("已更新");
  });
});
