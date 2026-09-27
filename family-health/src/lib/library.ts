/**
 * Read-model for 指标库: every dictionary entry with aliases, units, LOINC,
 * all candidate reference ranges and thresholds and the sources behind each
 * number — so the guardian can audit what the app relies on.
 */
import { LEGACY_SOURCE_ID, LOINC_ATTRIBUTION, SOURCES } from "../data/sources.js";
import { THRESHOLDS } from "../data/thresholds.js";
import { ThresholdSchema, type Source } from "../data/schema.js";
import { criticalRulesFor } from "../domain/critical.js";
import { CATEGORIES, CATEGORY_ZH, INDICATORS, getIndicator } from "../domain/indicators.js";
import { LEVEL_ZH, getSource, resolveCandidate } from "../domain/provenance.js";
import type { IndicatorDef, NumericRange, SexRange } from "../domain/types.js";

const sourceOrNull = (id: string | null | undefined): Source | null => getSource(id) ?? null;

function legacyRanges(ref: SexRange | undefined): Array<{ sex: "male" | "female" | null; range: NumericRange }> {
  if (!ref) return [];
  if ("male" in ref && "female" in ref) return [{ sex: "male", range: ref.male }, { sex: "female", range: ref.female }];
  return [{ sex: null, range: ref as NumericRange }];
}

export function libraryEntry(def: IndicatorDef) {
  const ranges = (def.ranges ?? []).map((c) => ({
    candidate: c,
    resolved: c.low != null || c.high != null ? resolveCandidate(c, def) : null,
    source: sourceOrNull(c.sourceId),
    levelZh: LEVEL_ZH[c.level],
  }));
  const thresholds = THRESHOLDS.map((t) => ThresholdSchema.parse(t))
    .filter((t) => t.indicatorCodes.includes(def.code))
    .map((t) => ({ ...t, levelZh: LEVEL_ZH[t.level], source: sourceOrNull(t.sourceId) }));
  const verified = ranges.some((r) => r.resolved && r.candidate.level !== "unverified") || thresholds.length > 0 || !!def.loinc;
  return {
    code: def.code,
    zh: def.zh,
    en: def.en,
    aliases: def.aliases,
    category: def.category,
    categoryZh: CATEGORY_ZH[def.category],
    unit: def.unit,
    valueType: def.valueType,
    direction: def.direction,
    conversions: def.conversions ?? [],
    side: def.side ?? null,
    sex: def.sex ?? null,
    derived: !!def.derived,
    explain: { text: def.explain, source: sourceOrNull(def.explainSourceId ?? LEGACY_SOURCE_ID) },
    loinc: def.loinc ? { ...def.loinc, source: sourceOrNull(def.loinc.sourceId) } : null,
    ranges,
    conflict: def.conflict ?? null,
    legacy: def.ref ? { ranges: legacyRanges(def.ref), source: sourceOrNull(def.refSourceId ?? LEGACY_SOURCE_ID) } : null,
    thresholds,
    critical: criticalRulesFor(def.code).map((r) => ({ op: r.op, threshold: r.threshold, level: r.level, message: r.message, sex: r.sex ?? null, source: sourceOrNull(r.sourceId) })),
    /** True when anything about this entry is backed by a verified source. */
    verified,
  };
}

export function libraryIndex() {
  const usage = new Map<string, number>();
  const bump = (id: string | null | undefined) => id && usage.set(id, (usage.get(id) ?? 0) + 1);
  for (const d of INDICATORS) {
    bump(d.explainSourceId);
    bump(d.refSourceId);
    bump(d.loinc?.sourceId);
    for (const r of d.ranges ?? []) bump(r.sourceId);
  }
  for (const t of THRESHOLDS) bump(t.sourceId);
  return {
    categories: CATEGORIES,
    levels: LEVEL_ZH,
    loincAttribution: LOINC_ATTRIBUTION,
    sources: SOURCES.map((s) => ({ ...s, levelZh: LEVEL_ZH[s.level], usedBy: usage.get(s.id) ?? 0 })),
    indicators: INDICATORS.map(libraryEntry),
  };
}

export function libraryDetail(code: string) {
  const def = getIndicator(code.toUpperCase());
  return def ? { ...libraryEntry(def), loincAttribution: LOINC_ATTRIBUTION } : null;
}
