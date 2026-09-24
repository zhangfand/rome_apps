/**
 * Parsing of printed reference ranges:
 *
 *   `3.9-6.1`  `3.9～6.1`  `3.9 至 6.1`  `0.00--5.00`  `-1.0~1.0`
 *   `<5.2`  `＜5.2`  `≤40`  `>1.04`  `≥1.04`  `小于5.2`
 *   `阴性`  `阴性(-)`  `(-)`  `正常`
 *   `男:9-50 女:7-40`  `男性 130-175；女性 115-150`  `M 9-50 F 7-40`
 *
 * Units, `mmol/L` suffixes and other trailing text are ignored.
 */
import { normalizeWidth, squish } from "./text.js";
import type { NumericRange, Sex } from "./types.js";
import { normalizeQualitative } from "./values.js";

export interface ParsedRange extends NumericRange {
  /** Qualitative expectation (`阴性` / `正常`) when the range is not numeric. */
  qualitative?: string;
  /** Sex-specific ranges when the text had both. */
  bySex?: { male?: NumericRange; female?: NumericRange };
  text: string;
}

const NUM = String.raw`[+-]?\d+(?:\.\d+)?`;
const RANGE_RE = new RegExp(String.raw`(${NUM})\s*(?:-{1,2}|~{1,2}|至|到)\s*(${NUM})`);
const UPPER_RE = new RegExp(String.raw`(<=|<|小于等于|小于|低于|不超过|不高于)\s*(${NUM})`);
const LOWER_RE = new RegExp(String.raw`(>=|>|大于等于|大于|高于|不低于|不小于)\s*(${NUM})`);
const PAIR_RE = new RegExp(String.raw`^(${NUM})\s+(${NUM})$`);

function parseNumericPart(t: string): NumericRange | null {
  const range = t.match(RANGE_RE);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (Number.isFinite(low) && Number.isFinite(high) && low <= high) {
      return { low, high, lowInclusive: true, highInclusive: true };
    }
  }
  const upper = t.match(UPPER_RE);
  const lower = t.match(LOWER_RE);
  if (upper || lower) {
    const out: NumericRange = {};
    if (upper) {
      out.high = Number(upper[2]);
      out.highInclusive = upper[1] === "<=" || upper[1] === "小于等于" || upper[1] === "不超过" || upper[1] === "不高于";
    }
    if (lower) {
      out.low = Number(lower[2]);
      out.lowInclusive = lower[1] === ">=" || lower[1] === "大于等于" || lower[1] === "不低于" || lower[1] === "不小于";
    }
    if (out.low != null && out.high != null && out.low > out.high) return null;
    return out;
  }
  const pair = t.match(PAIR_RE);
  if (pair) {
    const low = Number(pair[1]);
    const high = Number(pair[2]);
    if (low < high) return { low, high, lowInclusive: true, highInclusive: true };
  }
  return null;
}

const SEX_SEGMENT_RE = /(男性?|女性?|\bM(?:ale)?\b|\bF(?:emale)?\b)\s*[:：]?\s*([^男女;；,，|]*?)(?=(?:[;；,，|]\s*)?(?:男|女|\bM(?:ale)?\b|\bF(?:emale)?\b)|$)/gi;

function parseSexSpecific(t: string): { male?: NumericRange; female?: NumericRange } | null {
  if (!/(男|女|\bM(ale)?\b|\bF(emale)?\b)/i.test(t)) return null;
  const out: { male?: NumericRange; female?: NumericRange } = {};
  for (const m of t.matchAll(SEX_SEGMENT_RE)) {
    const who = m[1].toLowerCase();
    const isMale = who.startsWith("男") || who === "m" || who === "male";
    const range = parseNumericPart(m[2]);
    if (!range) continue;
    if (isMale) out.male = out.male ?? range;
    else out.female = out.female ?? range;
  }
  return out.male || out.female ? out : null;
}

function union(a: NumericRange, b: NumericRange): NumericRange {
  const low = a.low != null && b.low != null ? Math.min(a.low, b.low) : undefined;
  const high = a.high != null && b.high != null ? Math.max(a.high, b.high) : undefined;
  return {
    low,
    high,
    lowInclusive: low == null ? undefined : (low === a.low ? a.lowInclusive : b.lowInclusive) ?? true,
    highInclusive: high == null ? undefined : (high === a.high ? a.highInclusive : b.highInclusive) ?? true,
  };
}

/**
 * Parse a printed reference range. Returns null when the text carries no
 * usable range. For sex-specific text the member's sex picks the range; with
 * unknown sex the union of both is used (never flags a value normal for
 * either sex).
 */
export function parseRefRange(raw: string | null | undefined, sex?: Sex | null): ParsedRange | null {
  if (raw == null) return null;
  const text = squish(normalizeWidth(String(raw)));
  if (!text) return null;
  // Remove thousands separators inside numbers (`1,000-5,000`).
  const t = text.replace(/(?<=\d),(?=\d{3}\b)/g, "");

  const bySex = parseSexSpecific(t);
  if (bySex) {
    const chosen =
      sex === "male" ? bySex.male ?? bySex.female : sex === "female" ? bySex.female ?? bySex.male : undefined;
    const range = chosen ?? (bySex.male && bySex.female ? union(bySex.male, bySex.female) : (bySex.male ?? bySex.female)!);
    return { ...range, bySex, text };
  }

  const numeric = parseNumericPart(t);
  if (numeric) return { ...numeric, text };

  const qual = normalizeQualitative(t.replace(/\s+/g, ""));
  if (qual && (qual.text === "阴性" || qual.text === "正常")) return { qualitative: qual.text, text };
  // Forms like `阴性(<1:10)` or `阴性 (-)` with extra noise.
  if (/^(阴性|正常)/.test(t)) return { qualitative: t.startsWith("正常") ? "正常" : "阴性", text };
  return null;
}

/** Human-readable form of a numeric range, e.g. `3.9–6.1`, `<5.2`, `≥1.04`. */
export function formatRange(range: NumericRange | null | undefined): string {
  if (!range) return "";
  const { low, high } = range;
  if (low != null && high != null) return `${low}–${high}`;
  if (high != null) return `${range.highInclusive === false ? "<" : "≤"}${high}`;
  if (low != null) return `${range.lowInclusive === false ? ">" : "≥"}${low}`;
  return "";
}
