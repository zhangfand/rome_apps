/**
 * Standard reference ranges from the knowledge base (see provenance.ts for the
 * precedence rules). Kept separate from provenance.ts so flags.ts can use the
 * fallback range without an import cycle.
 */
import { LEGACY_SOURCE_ID, SOURCES } from "../data/sources.js";
import type { Population, RangeCandidate, Source, SourceLevel } from "../data/schema.js";
import { defaultRange } from "./indicators.js";
import type { IndicatorDef, NumericRange, Sex } from "./types.js";
import { toCanonical } from "./units.js";

export const LEVEL_ZH: Record<SourceLevel, string> = {
  national_cn: "国家标准",
  international: "国际标准",
  cn_guideline: "中国指南",
  cn_consensus: "中国共识",
  intl_guideline: "国际指南",
  report: "报告单",
  unverified: "未核实",
};

/** Order used to pick a standard REFERENCE RANGE (see header). */
export const RANGE_PRECEDENCE: SourceLevel[] = ["national_cn", "international", "intl_guideline", "cn_guideline", "cn_consensus"];

const SOURCE_INDEX = new Map(SOURCES.map((s) => [s.id, s]));

export function getSource(id: string | null | undefined, sources: Map<string, Source> = SOURCE_INDEX): Source | undefined {
  // An injected index (tests) falls back to the built-in sources.
  return id ? sources.get(id) ?? SOURCE_INDEX.get(id) : undefined;
}

export interface PersonCtx {
  sex?: Sex | null;
  age?: number | null;
}

/**
 * Does a candidate's population apply to this person? Returns a specificity
 * score (higher = more specific) or -1 when it does not apply. Sex- or
 * age-specific candidates never apply when that attribute is unknown, and
 * pregnancy- or condition-specific ones never apply (the app tracks neither
 * pregnancy nor diagnoses such as 高血压/痛风).
 */
export function populationScore(pop: Population | undefined, who: PersonCtx): number {
  if (!pop) return 0;
  if (pop.pregnancy) return -1;
  if (pop.condition) return -1;
  let score = 0;
  if (pop.sex) {
    if (!who.sex || who.sex !== pop.sex) return -1;
    score += 2;
  }
  if (pop.age && (pop.age.min != null || pop.age.max != null)) {
    if (who.age == null) return -1;
    if (pop.age.min != null && who.age < pop.age.min) return -1;
    if (pop.age.max != null && (pop.age.maxInclusive === false ? who.age >= pop.age.max : who.age > pop.age.max)) return -1;
    score += 1;
  }
  return score;
}

export interface ResolvedRange {
  id: string;
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  /** Canonical unit of the indicator (or the printed unit for report ranges that could not be converted). */
  unit: string;
  level: SourceLevel;
  levelZh: string;
  source: Source | null;
  locator: string | null;
  population: Population | null;
  conditions: string | null;
  /** Verbatim source text behind the numbers (verified candidates only). */
  evidenceQuote?: string | null;
  /** Printed text for report ranges. */
  text: string | null;
  /** Unit printed next to the report range (may differ from `unit` when the value was converted). */
  textUnit?: string | null;
}

function toCanonicalRange(c: RangeCandidate, def: IndicatorDef): { low: number | null; high: number | null } | null {
  const conv = (v: number | undefined) => {
    if (v == null) return null;
    const out = toCanonical(v, c.unit, def);
    return out.status === "incompatible" ? undefined : out.value;
  };
  const low = conv(c.low);
  const high = conv(c.high);
  if (low === undefined || high === undefined) return null;
  return { low, high };
}

export function resolveCandidate(c: RangeCandidate, def: IndicatorDef, sources?: Map<string, Source>): ResolvedRange | null {
  const b = toCanonicalRange(c, def);
  if (!b) return null;
  return {
    id: c.id,
    low: b.low,
    high: b.high,
    lowInclusive: c.lowInclusive !== false,
    highInclusive: c.highInclusive !== false,
    unit: def.unit,
    level: c.level,
    levelZh: LEVEL_ZH[c.level],
    source: getSource(c.sourceId, sources) ?? null,
    locator: c.locator ?? null,
    population: c.population ?? null,
    conditions: c.conditions ?? null,
    evidenceQuote: c.evidenceQuote ?? null,
    text: null,
  };
}

export interface StandardRangeResult {
  primary: ResolvedRange | null;
  /** Other applicable verified candidates (e.g. the international range when the national one is primary). */
  alternatives: ResolvedRange[];
  conflict: { note_zh: string; resolution: string; national: ResolvedRange; international: ResolvedRange } | null;
  /** The original unverified fallback, when no verified range applies. */
  legacy: ResolvedRange | null;
}

const sameBounds = (a: ResolvedRange, b: ResolvedRange) => a.low === b.low && a.high === b.high && a.lowInclusive === b.lowInclusive && a.highInclusive === b.highInclusive;

export function standardRange(def: IndicatorDef, who: PersonCtx = {}, sources?: Map<string, Source>): StandardRangeResult {
  const scored: Array<{ r: ResolvedRange; rank: number; score: number }> = [];
  for (const c of def.ranges ?? []) {
    if (c.low == null && c.high == null) continue;
    const rank = RANGE_PRECEDENCE.indexOf(c.level);
    if (rank < 0) continue;
    const score = populationScore(c.population, who);
    if (score < 0) continue;
    const r = resolveCandidate(c, def, sources);
    if (r) scored.push({ r, rank, score });
  }
  scored.sort((a, b) => a.rank - b.rank || b.score - a.score);
  const primary = scored[0]?.r ?? null;
  const alternatives = scored.slice(1).map((s) => s.r);

  let conflict: StandardRangeResult["conflict"] = null;
  const national = scored.find((s) => s.r.level === "national_cn")?.r;
  const intl = scored.find((s) => s.r.level === "international" || s.r.level === "intl_guideline")?.r;
  if (national && intl && !sameBounds(national, intl)) {
    conflict = {
      note_zh: def.conflict?.note_zh ?? "国家标准与国际标准的参考范围不同，本应用以国家标准为准。",
      resolution: def.conflict?.resolution ?? "以国家标准为准",
      national,
      international: intl,
    };
  }

  let legacy: ResolvedRange | null = null;
  if (!primary && def.ref && def.direction !== "info") {
    const r = defaultRange(def, who.sex);
    if (r && (r.low != null || r.high != null)) {
      legacy = {
        id: "legacy",
        low: r.low ?? null,
        high: r.high ?? null,
        lowInclusive: r.lowInclusive !== false,
        highInclusive: r.highInclusive !== false,
        unit: def.unit,
        level: "unverified",
        levelZh: LEVEL_ZH.unverified,
        source: getSource(def.refSourceId ?? LEGACY_SOURCE_ID, sources) ?? null,
        locator: null,
        population: who.sex ? { sex: who.sex } : null,
        conditions: null,
        text: null,
      };
    }
  }
  return { primary, alternatives, conflict, legacy };
}

/** The numeric range used when the report printed none: verified standard first, then the legacy fallback. */
export function fallbackRange(def: IndicatorDef, who: PersonCtx = {}, sources?: Map<string, Source>): NumericRange | undefined {
  const std = standardRange(def, who, sources);
  const r = std.primary ?? std.legacy;
  if (!r) return undefined;
  return { low: r.low ?? undefined, high: r.high ?? undefined, lowInclusive: r.lowInclusive, highInclusive: r.highInclusive };
}

