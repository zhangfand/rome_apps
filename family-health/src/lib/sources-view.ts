/**
 * Read-model for 数据来源: every source the knowledge base cites, what it
 * supports (source -> indicators), how it was checked, and the research gaps.
 * Read-only; the inverse view of 指标库.
 */
import { RESEARCH_GAPS } from "../data/verified.js";
import { GAPS_ZH, GAP_KIND_ZH, RESEARCH_TOPIC_ZH, SOURCE_NOTES_ZH } from "../data/source-notes-zh.js";
import { LEGACY_SOURCE_ID, SOURCES } from "../data/sources.js";
import { THRESHOLDS } from "../data/thresholds.js";
import { LEVELS, ThresholdSchema, type Source } from "../data/schema.js";
import { INDICATORS, getIndicator } from "../domain/indicators.js";
import { LEVEL_ZH, resolveCandidate, standardRange } from "../domain/provenance.js";

const PARSED_THRESHOLDS = () => THRESHOLDS.map((t) => ThresholdSchema.parse(t));
const nameOf = (code: string) => getIndicator(code)?.zh ?? code;

function usage(id: string) {
  const rangeCodes = new Set<string>();
  let ranges = 0;
  for (const d of INDICATORS) {
    for (const r of d.ranges ?? []) {
      if (r.sourceId !== id) continue;
      ranges++;
      rangeCodes.add(d.code);
    }
  }
  const thresholds = PARSED_THRESHOLDS().filter((t) => t.sourceId === id);
  const thresholdCodes = new Set(thresholds.flatMap((t) => t.indicatorCodes));
  const explanations = INDICATORS.filter((d) => (d.explainSourceId ?? LEGACY_SOURCE_ID) === id).length;
  const legacyRanges = INDICATORS.filter((d) => d.ref && (d.refSourceId ?? LEGACY_SOURCE_ID) === id).length;
  const codes = new Set([...rangeCodes, ...thresholdCodes]);
  return { ranges, thresholds: thresholds.length, explanations, legacyRanges, indicators: codes.size };
}

function summary(s: Source) {
  const note = SOURCE_NOTES_ZH[s.id] ?? null;
  return {
    ...s,
    levelZh: LEVEL_ZH[s.level],
    note,
    needsOfficialCheck: s.verifiedVia === "secondary",
    usage: usage(s.id),
  };
}

export function sourcesIndex() {
  const sources = SOURCES.map(summary);
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, sources.filter((s) => s.level === l).length]));
  const known = new Set(INDICATORS.map((d) => d.code));
  return {
    levels: LEVEL_ZH,
    counts: {
      total: sources.length,
      verified: sources.filter((s) => s.level !== "unverified").length,
      primary: sources.filter((s) => s.verifiedVia === "primary").length,
      needsOfficialCheck: sources.filter((s) => s.needsOfficialCheck).length,
      byLevel,
    },
    sources,
    gapKinds: GAP_KIND_ZH,
    gaps: GAPS_ZH.map((g) => ({ ...g, indicators: g.codes.filter((c) => known.has(c)).map((c) => ({ code: c, zh: nameOf(c) })) })),
    research: Object.entries(RESEARCH_TOPIC_ZH).map(([file, topic]) => ({
      file,
      topic,
      gaps: RESEARCH_GAPS.filter((g) => g.research === file).map(({ what, tried }) => ({ what, tried })),
    })),
  };
}

export function sourceDetail(id: string) {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) return null;
  const ranges = INDICATORS.flatMap((d) =>
    (d.ranges ?? [])
      .filter((r) => r.sourceId === id)
      .map((r) => ({
        code: d.code,
        zh: d.zh,
        candidate: r,
        resolved: r.low != null || r.high != null ? resolveCandidate(r, d) : null,
      })),
  );
  const thresholds = PARSED_THRESHOLDS()
    .filter((t) => t.sourceId === id)
    .map((t) => ({ ...t, levelZh: LEVEL_ZH[t.level], indicators: t.indicatorCodes.map((c) => ({ code: c, zh: nameOf(c) })) }));
  // For the built-in (unverified) data: which indicators still rely on it.
  const legacyInUse =
    s.level === "unverified"
      ? INDICATORS.filter((d) => d.ref && d.direction !== "info" && !standardRange(d, { sex: "male", age: 40 }).primary && !standardRange(d, { sex: "female", age: 40 }).primary).map((d) => ({
          code: d.code,
          zh: d.zh,
        }))
      : [];
  return { ...summary(s), ranges, thresholds, legacyInUse };
}
