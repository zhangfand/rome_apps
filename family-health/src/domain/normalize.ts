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
import { parseResultValue, type ParsedValue } from "./values.js";

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
