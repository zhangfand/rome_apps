/**
 * Flag computation for a single result.
 *
 * Precedence:
 *   1. A marker printed by the report (↑ / ↓ / H / L) wins.
 *   2. Qualitative results: 阴性/正常 (or the indicator's own normal set) are
 *      normal, anything positive is `abnormal`.
 *   3. Numeric results are compared with the report's printed range, falling
 *      back to the dictionary default for the member's sex.
 *   4. A bare `*` / 异常 marker without a usable range yields `abnormal`.
 */
import { defaultRange } from "./indicators.js";
import type { ParsedRange } from "./refRange.js";
import type { Flag, IndicatorDef, NumericRange, Sex } from "./types.js";
import type { ParsedValue } from "./values.js";

export interface FlagInput {
  value: ParsedValue;
  /** Range printed on the report (already parsed), if any. */
  reportRange?: ParsedRange | NumericRange | null;
  def?: IndicatorDef | null;
  sex?: Sex | null;
}

function hasBounds(r: NumericRange | null | undefined): r is NumericRange {
  return !!r && (r.low != null || r.high != null);
}

/** Compare a (possibly censored) number against a numeric range. */
export function compareToRange(num: number, range: NumericRange, censor: "<" | ">" | null = null): "H" | "L" | "normal" {
  const { low, high } = range;
  const lowInc = range.lowInclusive !== false;
  const highInc = range.highInclusive !== false;
  if (censor === "<") {
    // True value is below `num`: only provably low when num <= low.
    if (low != null && (num < low || (num === low && lowInc))) return "L";
    return "normal";
  }
  if (censor === ">") {
    if (high != null && (num > high || (num === high && highInc))) return "H";
    return "normal";
  }
  if (low != null && (lowInc ? num < low : num <= low)) return "L";
  if (high != null && (highInc ? num > high : num >= high)) return "H";
  return "normal";
}

/** Normal qualitative values for an indicator (and optionally the report's own expectation). */
function qualitativeNormals(def?: IndicatorDef | null, reportRange?: ParsedRange | NumericRange | null): string[] {
  const set = new Set(def?.qualitativeNormal ?? ["阴性", "正常"]);
  const q = (reportRange as ParsedRange | undefined)?.qualitative;
  if (q) set.add(q);
  // 正常 always reads as normal for dipstick-style results.
  set.add("正常");
  return [...set];
}

/**
 * Compute the flag for one result. Returns null when there is nothing to
 * compare against (no range, no marker) or the value could not be parsed.
 */
export function computeFlag({ value, reportRange, def, sex }: FlagInput): Flag | null {
  if (value.marker === "H" || value.marker === "L") return value.marker;

  if (value.qualitative) {
    if (def?.direction === "info") return "normal";
    return qualitativeNormals(def, reportRange).includes(value.qualitative) ? (value.marker === "abnormal" ? "abnormal" : "normal") : "abnormal";
  }

  if (value.num == null) return value.marker === "abnormal" ? "abnormal" : null;

  let range: NumericRange | undefined;
  if (hasBounds(reportRange)) range = reportRange;
  else if (def && def.direction !== "info") range = defaultRange(def, sex);

  if (!hasBounds(range)) return value.marker === "abnormal" ? "abnormal" : null;
  const cmp = compareToRange(value.num, range, value.censor);
  if (cmp === "normal" && value.marker === "abnormal") return "abnormal";
  return cmp;
}

/**
 * Whether a flag is clinically concerning given the indicator's direction.
 * A high HDL-C is flagged `H` but is not a worry; a low ALT likewise.
 */
export function isConcerning(flag: Flag | null | undefined, def?: IndicatorDef | null): boolean {
  if (!flag || flag === "normal") return false;
  if (flag === "abnormal") return def?.direction !== "info";
  switch (def?.direction) {
    case "higher_worse":
      return flag === "H";
    case "lower_worse":
      return flag === "L";
    case "info":
      return false;
    default:
      return true;
  }
}
