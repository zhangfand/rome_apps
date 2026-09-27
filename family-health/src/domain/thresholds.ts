/**
 * Decision-threshold categorisation (BMI 分类, 血压分级, 糖尿病切点, 血脂分层,
 * 腹型肥胖, 高尿酸, 骨密度 T 值, baPWV / ABI, eGFR 分期 …).
 *
 * Thresholds are NOT reference ranges: a value can be inside the lab's
 * reference range and still be "边缘升高" by a guideline, so they are shown
 * separately and never change the result's flag.
 *
 * PRECEDENCE for thresholds (Chinese standards and guidelines first):
 *   1. national_cn   2. cn_guideline   3. cn_consensus   4. international   5. intl_guideline
 *   A threshold marked `alternativeOf` another one (e.g. the WHO BMI cut-points
 *   as the international alternative to the Chinese standard) is never the
 *   primary category while the threshold it is an alternative of applies; it
 *   is returned in `alternatives` so the UI can show it second.
 *   Within one level the most population-specific threshold wins.
 *
 * Multi-indicator thresholds (BP grades use SBP and DBP): each category may
 * give per-code `bounds`; every code with a value is placed in its category
 * and the highest-ranked category wins (收缩压与舒张压分属不同级别时按较高级别).
 */
import { THRESHOLDS } from "../data/thresholds.js";
import { ThresholdSchema, type Source, type SourceLevel, type Threshold, type ThresholdCategory, type ThresholdInput } from "../data/schema.js";
import { LEVEL_ZH, getSource, populationScore, type PersonCtx } from "./standard-range.js";

export const THRESHOLD_PRECEDENCE: SourceLevel[] = ["national_cn", "cn_guideline", "cn_consensus", "international", "intl_guideline"];

export interface ThresholdHit {
  thresholdId: string;
  name_zh: string;
  kind: "category" | "target";
  label_zh: string;
  severity: ThresholdCategory["severity"];
  rank: number;
  note_zh: string | null;
  level: SourceLevel;
  levelZh: string;
  source: Source | null;
  locator: string | null;
  alternativeOf: string | null;
  /** Verbatim source text behind the cut-points. */
  evidenceQuote: string | null;
  /** Codes that contributed (for combined thresholds). */
  decidedBy: string[];
  /** All categories of this threshold, for display ("≥28 肥胖"). */
  scale: Array<{ label_zh: string; low: number | null; high: number | null; inclusivity: string; bounds?: ThresholdCategory["bounds"] }>;
  unit: string;
}

export interface Categorisation {
  primary: ThresholdHit | null;
  alternatives: ThresholdHit[];
  /** Informational targets (e.g. LDL-C 目标值) that apply to this indicator. */
  targets: ThresholdHit[];
}

type Inc = "[)" | "(]" | "[]" | "()";

export function inBounds(v: number, low: number | undefined | null, high: number | undefined | null, inclusivity: Inc = "[)"): boolean {
  const lowInc = inclusivity[0] === "[";
  const highInc = inclusivity[1] === "]";
  if (low != null && (lowInc ? v < low : v <= low)) return false;
  if (high != null && (highInc ? v > high : v >= high)) return false;
  return true;
}

function categoryFor(t: Threshold, code: string, v: number): { cat: ThresholdCategory; rank: number } | null {
  let best: { cat: ThresholdCategory; rank: number } | null = null;
  t.categories.forEach((c, i) => {
    const rank = c.rank ?? i;
    let hit: boolean;
    if (c.bounds) {
      const b = c.bounds[code];
      if (!b) return;
      hit = inBounds(v, b.low, b.high, b.inclusivity ?? "[)");
    } else {
      hit = inBounds(v, c.low, c.high, c.inclusivity ?? "[)");
    }
    if (hit && (!best || rank > best.rank)) best = { cat: c, rank };
  });
  return best;
}

function hitFor(t: Threshold, values: Record<string, number>, sources?: Map<string, Source>): ThresholdHit | null {
  let best: { cat: ThresholdCategory; rank: number; codes: string[] } | null = null;
  for (const code of t.indicatorCodes) {
    const v = values[code];
    if (v == null || !Number.isFinite(v)) continue;
    const c = categoryFor(t, code, v);
    if (!c) continue;
    if (!best || c.rank > best.rank) best = { ...c, codes: [code] };
    else if (c.rank === best.rank) best.codes.push(code);
  }
  if (!best) return null;
  return {
    thresholdId: t.id,
    name_zh: t.name_zh,
    kind: t.kind,
    label_zh: best.cat.label_zh,
    severity: best.cat.severity,
    rank: best.rank,
    note_zh: best.cat.note_zh ?? null,
    level: t.level,
    levelZh: LEVEL_ZH[t.level],
    source: getSource(t.sourceId, sources) ?? null,
    locator: t.locator ?? null,
    alternativeOf: t.alternativeOf ?? null,
    evidenceQuote: t.evidenceQuote ?? null,
    decidedBy: best.codes,
    scale: t.categories.map((c) => ({ label_zh: c.label_zh, low: c.low ?? null, high: c.high ?? null, inclusivity: c.inclusivity ?? "[)", ...(c.bounds ? { bounds: c.bounds } : {}) })),
    unit: t.unit,
  };
}

let PARSED: Threshold[] | null = null;
function defaultThresholds(): Threshold[] {
  PARSED ??= THRESHOLDS.map((t) => ThresholdSchema.parse(t));
  return PARSED;
}

/**
 * Categorise a value (plus sibling values for combined thresholds such as
 * BP) against every applicable threshold. Pure; `data` / `sources` are
 * injectable for tests.
 */
export function categorize(
  code: string,
  value: number | null | undefined,
  who: PersonCtx = {},
  opts: { siblings?: Record<string, number>; data?: ThresholdInput[]; sources?: Map<string, Source> } = {},
): Categorisation {
  const empty: Categorisation = { primary: null, alternatives: [], targets: [] };
  if (value == null || !Number.isFinite(value)) return empty;
  const data = opts.data ? opts.data.map((t) => ThresholdSchema.parse(t)) : defaultThresholds();
  const values = { ...(opts.siblings ?? {}), [code]: value };

  const hits: Array<{ hit: ThresholdHit; rank: number; score: number }> = [];
  for (const t of data) {
    if (!t.indicatorCodes.includes(code)) continue;
    const rank = THRESHOLD_PRECEDENCE.indexOf(t.level);
    if (rank < 0) continue;
    const score = populationScore(t.population, who);
    if (score < 0) continue;
    const hit = hitFor(t, values, opts.sources);
    if (hit) hits.push({ hit, rank, score });
  }
  hits.sort((a, b) => a.rank - b.rank || b.score - a.score);

  const targets = hits.filter((h) => h.hit.kind === "target").map((h) => h.hit);
  const cats = hits.filter((h) => h.hit.kind === "category");
  const applied = new Set(cats.map((h) => h.hit.thresholdId));
  // Alternatives never lead while the threshold they are an alternative of applies.
  const leaders = cats.filter((h) => !h.hit.alternativeOf || !applied.has(h.hit.alternativeOf));
  const primary = leaders[0]?.hit ?? null;
  const alternatives = cats.map((h) => h.hit).filter((h) => h !== primary);
  return { primary, alternatives, targets };
}
