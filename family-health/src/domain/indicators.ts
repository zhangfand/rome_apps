/**
 * Canonical dictionary of health-checkup indicators.
 *
 * The data itself lives in `src/data/indicators.ts` (reviewable, with sources;
 * see src/data/schema.ts). This module adapts it to the `IndicatorDef` shape
 * the rest of the app uses. Every lab value extracted from a report is mapped
 * onto one of these codes so values from different providers line up on one
 * trend line. A range printed on the report always wins; `ref` (the legacy,
 * unverified fallback) is only used when the report printed none.
 *
 * Synced into the `indicator_defs` table at startup (see db/repositories).
 */
import { INDICATOR_DATA } from "../data/indicators.js";
import { IndicatorEntrySchema } from "../data/schema.js";
import type { CategoryInfo, CategoryKey, IndicatorDef, NumericRange, SexRange } from "./types.js";

export const CATEGORIES: CategoryInfo[] = [
  { key: "general", zh: "一般检查", order: 1 },
  { key: "blood_routine", zh: "血常规", order: 2 },
  { key: "urine", zh: "尿常规", order: 3 },
  { key: "liver", zh: "肝功能", order: 4 },
  { key: "kidney", zh: "肾功能", order: 5 },
  { key: "uric_acid", zh: "尿酸", order: 6 },
  { key: "lipid", zh: "血脂", order: 7 },
  { key: "glucose", zh: "血糖", order: 8 },
  { key: "thyroid", zh: "甲状腺功能", order: 9 },
  { key: "tumor", zh: "肿瘤标志物", order: 10 },
  { key: "bone", zh: "骨密度/骨代谢", order: 11 },
  { key: "bone_qus", zh: "超声骨密度", order: 12 },
  { key: "coag", zh: "凝血功能", order: 13 },
  { key: "electrolyte", zh: "电解质", order: 14 },
  { key: "cardio", zh: "心血管/炎症", order: 15 },
  { key: "vitamin", zh: "维生素/营养", order: 16 },
  { key: "infection", zh: "感染/免疫", order: 17 },
  { key: "digestive", zh: "消化/胰腺", order: 18 },
  { key: "ecg", zh: "心电图", order: 19 },
  { key: "echo", zh: "心脏彩超", order: 20 },
  { key: "arterial", zh: "动脉硬化检测", order: 21 },
  { key: "tcd", zh: "经颅多普勒", order: 22 },
  { key: "eye", zh: "眼科", order: 23 },
];

export const CATEGORY_ZH: Record<CategoryKey, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.zh]),
) as Record<CategoryKey, string>;

function toDef(raw: (typeof INDICATOR_DATA)[number]): IndicatorDef {
  // Parse applies defaults (ranges: [], population: {}); invalid data fails loudly at import.
  const e = IndicatorEntrySchema.parse(raw);
  const def: IndicatorDef = {
    code: e.code,
    zh: e.zh,
    en: e.en,
    aliases: e.aliases,
    category: e.category,
    unit: e.unit,
    valueType: e.valueType,
    direction: e.direction,
    explain: e.explain.text,
    explainSourceId: e.explain.sourceId,
    ranges: e.ranges,
  };
  if (e.conversions) def.conversions = e.conversions;
  if (e.legacyRef) {
    def.ref = e.legacyRef as SexRange;
    def.refSourceId = e.legacyRefSourceId;
  }
  if (e.qualitativeNormal) def.qualitativeNormal = e.qualitativeNormal;
  if (e.decimals != null) def.decimals = e.decimals;
  if (e.sex) def.sex = e.sex;
  if (e.derived) def.derived = e.derived;
  if (e.side) def.side = e.side;
  if (e.loinc) def.loinc = e.loinc;
  if (e.conflict) def.conflict = e.conflict;
  return def;
}

export const INDICATORS: IndicatorDef[] = INDICATOR_DATA.map(toDef);

const BY_CODE = new Map(INDICATORS.map((d) => [d.code, d]));

export function getIndicator(code: string | null | undefined): IndicatorDef | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

export function indicatorsByCategory(category: CategoryKey): IndicatorDef[] {
  return INDICATORS.filter((d) => d.category === category);
}

/**
 * Resolve an indicator's default reference range for a member's sex. When sex
 * is unknown and the range is sex-specific, returns the union of both ranges
 * so nothing is flagged that would be normal for either sex.
 */
export function defaultRange(def: IndicatorDef, sex?: "male" | "female" | null): NumericRange | undefined {
  const ref = def.ref;
  if (!ref) return undefined;
  if ("male" in ref && "female" in ref) {
    if (sex === "male") return ref.male;
    if (sex === "female") return ref.female;
    const lows = [ref.male.low, ref.female.low].filter((v): v is number => v != null);
    const highs = [ref.male.high, ref.female.high].filter((v): v is number => v != null);
    return {
      low: lows.length === 2 ? Math.min(...lows) : undefined,
      high: highs.length === 2 ? Math.max(...highs) : undefined,
    };
  }
  return ref as NumericRange;
}
