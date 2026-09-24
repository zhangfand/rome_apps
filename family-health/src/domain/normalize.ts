/**
 * One-stop deterministic normalization of a single extracted report row:
 * dictionary mapping → value parsing → unit conversion → reference range →
 * flag. The extraction pipeline calls this for every row the vision agent
 * returns; rows whose name cannot be mapped keep their raw fields and go to
 * the LLM mapping fallback / human review.
 */
import { computeFlag } from "./flags.js";
import { getIndicator } from "./indicators.js";
import { mapIndicator, type MatchKind } from "./mapping.js";
import { parseRefRange, type ParsedRange } from "./refRange.js";
import type { Flag, IndicatorDef, NumericRange, Sex } from "./types.js";
import { normalizeUnit, toCanonical, type ConversionStatus } from "./units.js";
import { parseResultValue, splitBloodPressure, type ParsedValue } from "./values.js";

export interface RawRow {
  rawName: string;
  rawValue: string | number | null;
  rawUnit?: string | null;
  refText?: string | null;
  /** Arrow / H / L printed in a separate column. */
  arrow?: string | null;
  section?: string | null;
  /** Force a specific code (reviewer choice or LLM mapping fallback). */
  indicatorCode?: string | null;
}

export interface NormalizedRow {
  indicatorCode: string | null;
  match: MatchKind | "forced" | null;
  alternatives?: string[];
  parsed: ParsedValue;
  /** Value in the indicator's canonical unit (null for qualitative / incompatible units). */
  valueNum: number | null;
  /** Normalized qualitative text (阴性 / 阳性 / …) when not numeric. */
  valueText: string | null;
  /** Canonical unit when converted, else the normalized raw unit. */
  unit: string;
  unitStatus: ConversionStatus | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: Flag | null;
}

function convertRange(range: NumericRange, rawUnit: string | null | undefined, def: IndicatorDef): NumericRange | null {
  const conv = (v: number | undefined) => (v == null ? undefined : toCanonical(v, rawUnit, def));
  const low = conv(range.low);
  const high = conv(range.high);
  if ((low && low.status === "incompatible") || (high && high.status === "incompatible")) return null;
  return { ...range, low: low?.value, high: high?.value };
}

function arrowMarker(arrow: string | null | undefined): "H" | "L" | "abnormal" | null {
  if (!arrow) return null;
  const a = arrow.trim();
  if (/↑|^h$|高/i.test(a)) return "H";
  if (/↓|^l$|低/i.test(a)) return "L";
  if (/\*|异常|!/.test(a)) return "abnormal";
  return null;
}

export function normalizeRow(row: RawRow, ctx: { sex?: Sex | null } = {}): NormalizedRow {
  const parsed = parseResultValue(row.rawValue);
  const marker = parsed.marker ?? arrowMarker(row.arrow);
  const value: ParsedValue = { ...parsed, marker };

  let def: IndicatorDef | undefined;
  let match: NormalizedRow["match"] = null;
  let alternatives: string[] | undefined;
  if (row.indicatorCode) {
    def = getIndicator(row.indicatorCode);
    match = def ? "forced" : null;
  }
  if (!def) {
    const hit = mapIndicator(row.rawName, {
      section: row.section,
      unit: row.rawUnit,
      value: typeof row.rawValue === "number" ? String(row.rawValue) : row.rawValue,
    });
    if (hit) {
      def = getIndicator(hit.code);
      match = hit.kind;
      alternatives = hit.alternatives;
    }
  }

  const reportRange: ParsedRange | null = parseRefRange(row.refText, ctx.sex);
  const flag = computeFlag({ value, reportRange, def, sex: ctx.sex });

  let valueNum: number | null = null;
  let unit = normalizeUnit(row.rawUnit);
  let unitStatus: ConversionStatus | null = null;
  let refLow: number | null = reportRange?.low ?? null;
  let refHigh: number | null = reportRange?.high ?? null;

  if (def && value.num != null && def.valueType === "numeric") {
    const c = toCanonical(value.num, row.rawUnit, def);
    unitStatus = c.status;
    if (c.status !== "incompatible") {
      valueNum = c.value;
      unit = def.unit;
      if (reportRange && (reportRange.low != null || reportRange.high != null)) {
        const conv = convertRange(reportRange, row.rawUnit, def);
        refLow = conv?.low ?? null;
        refHigh = conv?.high ?? null;
      }
    }
  } else if (!def && value.num != null) {
    // Unmapped numeric rows keep the raw number so they are not lost.
    valueNum = value.num;
  }

  return {
    indicatorCode: def?.code ?? null,
    match,
    alternatives,
    parsed: value,
    valueNum,
    valueText: value.qualitative,
    unit,
    unitStatus,
    refLow,
    refHigh,
    refText: row.refText?.trim() || null,
    flag,
  };
}

/** Split a printed pair range like `90-139/60-89` or `<140/90`; null when it is not a pair. */
function splitPairRange(ref: string | null | undefined): [string, string] | null {
  if (!ref) return null;
  const t = ref.trim();
  const m = t.match(/^([<>≤≥]=?|小于|低于)?\s*([^/]+?)\s*\/\s*([^/]+)$/);
  if (!m) return null;
  const prefix = m[1] ?? "";
  return [`${prefix}${m[2].trim()}`, `${prefix}${m[3].trim()}`];
}

/**
 * Some report rows carry two indicators in one printed line — most commonly
 * `血压 138/88 mmHg`. Split such a row into its component rows (named with
 * dictionary names so they map exactly); returns null for ordinary rows.
 */
export function splitCompoundRow(row: RawRow): RawRow[] | null {
  const name = row.rawName ?? "";
  if (!/血压|blood\s*pressure|^\s*bp\s*$/i.test(name) || /收缩|舒张|高压|低压|sbp|dbp/i.test(name)) return null;
  const bp = splitBloodPressure(String(row.rawValue ?? ""));
  if (!bp) return null;
  const refs = splitPairRange(row.refText);
  // A printed ↑/↓ on the pair cannot be attributed to one component; only keep
  // it when there is no range to recompute the flag from.
  const arrow = refs ? null : row.arrow;
  return [
    { ...row, rawName: "收缩压", rawValue: String(bp.sbp), refText: refs?.[0] ?? null, arrow, indicatorCode: null },
    { ...row, rawName: "舒张压", rawValue: String(bp.dbp), refText: refs?.[1] ?? null, arrow, indicatorCode: null },
  ];
}
