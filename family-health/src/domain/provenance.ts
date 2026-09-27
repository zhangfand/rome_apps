/**
 * Provenance of every number the app shows: which reference range decided a
 * flag, where that range comes from, and whether the lab's printed range and
 * the standard range disagree.
 *
 * PRECEDENCE (pure functions, unit-tested in provenance.test.ts)
 *
 * Standard reference range for an indicator (`standardRange`):
 *   1. national_cn      国家标准 (e.g. WS/T 404, WS/T 405)
 *   2. international    国际标准 (IFCC / CLSI / ISO … reference intervals)
 *   3. intl_guideline   国际指南
 *   4. cn_guideline     中国指南
 *   5. cn_consensus     中国共识
 *   Among candidates of the same level, the one whose population matches the
 *   member most specifically (sex, then age) wins. `report` and `unverified`
 *   candidates are never standard ranges. When a national and an
 *   international range both exist and differ, both are returned with a
 *   conflict note; the national range stays primary.
 *   Rationale for putting international reference intervals above Chinese
 *   guidelines FOR RANGES: guidelines mostly publish decision thresholds, not
 *   reference intervals; a laboratory reference interval standard is the
 *   closer kind of evidence. (Decision thresholds use the opposite order —
 *   see thresholds.ts.)
 *
 * Verdict for one result (`verdict`):
 *   - basis `report`: the lab printed a usable range (or a qualitative
 *     expectation) or a ↑/↓/H/L marker → the lab decides. 检测方法/试剂不同，
 *     报告单上的范围与本次检测对应，所以以报告单为准。
 *   - basis `standard`: no printed range → the verified standard range.
 *   - basis `legacy`: nothing verified yet → the app's original fallback range
 *     (shown as 未核实).
 *   Printed markers: ↑/H and ↓/L are the lab's own verdict and always set the
 *   flag (as before); `*`/异常 turns an otherwise normal numeric result into
 *   `abnormal`. The standard verdict is computed independently from the value.
 *   `disagreement` is true only when the value can be compared to both a lab
 *   range/marker (H/L/normal) and a VERIFIED standard range in the same unit,
 *   and the two verdicts differ. `abnormal`-only markers and qualitative
 *   results never count as a disagreement.
 */
import type { Source } from "../data/schema.js";
import { compareToRange, computeFlag } from "./flags.js";
import type { ParsedRange } from "./refRange.js";
import { LEVEL_ZH, standardRange, type PersonCtx, type ResolvedRange, type StandardRangeResult } from "./standard-range.js";
import type { Flag, IndicatorDef, NumericRange } from "./types.js";
import { normalizeUnit } from "./units.js";
import type { ParsedValue } from "./values.js";

export {
  LEVEL_ZH,
  RANGE_PRECEDENCE,
  fallbackRange,
  getSource,
  populationScore,
  resolveCandidate,
  standardRange,
  type PersonCtx,
  type ResolvedRange,
  type StandardRangeResult,
} from "./standard-range.js";

// ------------------------------------------------------------------ verdict

export interface ReportContext {
  reportId: string;
  provider: string | null;
  examDate: string | null;
  page: number | null;
}

export interface VerdictInput {
  value: ParsedValue;
  /** Canonical value when the row was converted; else the raw number. */
  valueNum: number | null;
  /** Unit of `valueNum`/printed range after normalization (canonical when converted). */
  unit: string;
  /** The lab's printed range, in `unit`. */
  reportRange: (ParsedRange | NumericRange) | null;
  reportRangeText: string | null;
  /** Unit printed on the report row (the printed range is in this unit). */
  rawUnit?: string | null;
  def: IndicatorDef | null | undefined;
  who: PersonCtx;
  report?: ReportContext | null;
}

export type BasicVerdict = "H" | "L" | "normal";

export interface Verdict {
  flag: Flag | null;
  basis: "report" | "standard" | "legacy" | "none";
  /** Plain-Chinese explanation of which range decided and why. */
  reason_zh: string;
  usedRange: ResolvedRange | null;
  reportRange: ResolvedRange | null;
  standard: StandardRangeResult | null;
  /** Printed ↑/↓/H/L/* marker, if any. */
  marker: "H" | "L" | "abnormal" | null;
  labVerdict: BasicVerdict | "abnormal" | null;
  standardVerdict: BasicVerdict | null;
  disagreement: boolean;
}

const hasBounds = (r: NumericRange | null | undefined): r is NumericRange => !!r && (r.low != null || r.high != null);

function reportSource(ctx: ReportContext | null | undefined): Source | null {
  if (!ctx) return null;
  return {
    id: `report:${ctx.reportId}`,
    org: ctx.provider || "体检机构",
    title: "体检报告单",
    identifier: ctx.examDate ? `体检日期 ${ctx.examDate}` : "体检报告",
    locator: ctx.page ? `第 ${ctx.page} 页` : undefined,
    scope: ["reference_range"],
    level: "report",
    retrieved: ctx.examDate ?? "1970-01-01",
  };
}

export function verdict(input: VerdictInput, sources?: Map<string, Source>): Verdict {
  const { value, def, who } = input;
  const marker = value.marker;
  const flag = computeFlag({ value, reportRange: input.reportRange, def, sex: who.sex ?? null, age: who.age ?? null, sources });
  const std = def ? standardRange(def, who, sources) : null;
  const comparable = !!def && normalizeUnit(input.unit) === normalizeUnit(def.unit);

  const printedRange = hasBounds(input.reportRange) ? input.reportRange : null;
  const printedQual = (input.reportRange as ParsedRange | null)?.qualitative ?? null;
  const src = reportSource(input.report);
  const reportRange: ResolvedRange | null =
    printedRange || printedQual || input.reportRangeText
      ? {
          id: "report",
          low: printedRange?.low ?? null,
          high: printedRange?.high ?? null,
          lowInclusive: printedRange?.lowInclusive !== false,
          highInclusive: printedRange?.highInclusive !== false,
          unit: input.unit,
          level: "report",
          levelZh: LEVEL_ZH.report,
          source: src,
          locator: src?.locator ?? null,
          population: null,
          conditions: null,
          text: input.reportRangeText,
          // Only set when the value was converted: the printed range is then in this (printed) unit.
          textUnit: input.rawUnit && normalizeUnit(input.rawUnit) && normalizeUnit(input.rawUnit) !== normalizeUnit(input.unit) ? input.rawUnit : null,
        }
      : null;

  let basis: Verdict["basis"] = "none";
  let usedRange: ResolvedRange | null = null;
  let reason = "";
  if (marker === "H" || marker === "L") {
    basis = "report";
    usedRange = reportRange;
    reason = "报告单上直接标注了↑/↓（偏高/偏低），以报告单为准。";
  } else if (printedRange || (value.qualitative && reportRange)) {
    basis = "report";
    usedRange = reportRange;
    reason = "报告单印有本次检测的参考范围。不同医院的检测方法和试剂不同，参考范围也会不同，所以以报告单为准。";
  } else if (value.qualitative) {
    basis = "none";
    reason = "定性结果（阴性/阳性），按常规判断：阴性为正常。";
  } else if (std?.primary) {
    basis = "standard";
    usedRange = std.primary;
    reason = `报告单没有印参考范围，使用${std.primary.levelZh}的参考范围。`;
  } else if (std?.legacy) {
    basis = "legacy";
    usedRange = std.legacy;
    reason = "报告单没有印参考范围，暂用本应用内置的参考范围（尚未与标准核对）。";
  } else {
    reason = "没有可用的参考范围，无法判断高低。";
  }

  // Lab verdict: printed marker first, else the printed range.
  let labVerdict: Verdict["labVerdict"] = null;
  if (marker === "H" || marker === "L") labVerdict = marker;
  else if (printedRange && input.valueNum != null) labVerdict = compareToRange(input.valueNum, printedRange, value.censor);
  else if (marker === "abnormal") labVerdict = "abnormal";

  // Standard verdict: verified standard only, same unit, numeric value.
  let standardVerdict: BasicVerdict | null = null;
  if (std?.primary && comparable && input.valueNum != null && !value.qualitative) {
    standardVerdict = compareToRange(input.valueNum, {
      low: std.primary.low ?? undefined,
      high: std.primary.high ?? undefined,
      lowInclusive: std.primary.lowInclusive,
      highInclusive: std.primary.highInclusive,
    }, value.censor);
  }
  const disagreement = !!(labVerdict && labVerdict !== "abnormal" && standardVerdict && (printedRange || marker) && labVerdict !== standardVerdict);

  return { flag, basis, reason_zh: reason, usedRange, reportRange, standard: std, marker, labVerdict, standardVerdict, disagreement };
}
