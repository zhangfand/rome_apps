/**
 * Parsing of printed result values: numbers with embedded arrows / H / L
 * markers (`6.8↑`, `2.35 H`, `↓0.92`), censored values (`<0.5`, `>1000`),
 * qualitative results (`阴性(-)`, `+`, `++`, `弱阳性`, `未检出`) and blood
 * pressure pairs (`128/82`).
 */
import { normalizeWidth, squish } from "./text.js";

export type ReportMarker = "H" | "L" | "abnormal";

export interface ParsedValue {
  /** Numeric value when the result is a number (censored values keep the bound). */
  num: number | null;
  /** `<` / `>` when the report printed a censored value such as `<0.5`. */
  censor: "<" | ">" | null;
  /** Normalized qualitative text (阴性 / 阳性 / 弱阳性 / 正常 …) when not numeric. */
  qualitative: string | null;
  /** Grade for `+` style qualitative results (`++` → 2, `±` → 0.5). */
  grade: number | null;
  /** Flag the report printed next to the value (arrow, H/L, `*`). */
  marker: ReportMarker | null;
  /** The cleaned raw text. */
  text: string;
}

const NEGATIVE_RE = /^(阴性|阴|neg(ative)?|-|—|－|\(-\)|未检出|未见|无|正常|normal|nil|none)$/i;
const POSITIVE_RE = /^(阳性|阳|pos(itive)?|检出|\+{1,4}|[1-4]\+|\(\+{1,4}\)|\([1-4]\+\))$/i;
const WEAK_RE = /^(弱阳性|±|\+-|\(±\)|\(\+-\)|可疑|trace|微量)$/i;

/** Strip trailing / leading markers and return them separately. */
function extractMarker(text: string): { rest: string; marker: ReportMarker | null } {
  let marker: ReportMarker | null = null;
  let rest = text;
  const take = (re: RegExp, m: ReportMarker) => {
    if (re.test(rest)) {
      marker = marker ?? m;
      rest = rest.replace(re, " ");
    }
  };
  take(/↑+|▲|偏高|升高|高于参考值/g, "H");
  take(/↓+|▼|偏低|降低|低于参考值/g, "L");
  // H / L letters only when separated from the number (avoid eating units).
  // Units never end in a bare H/L right after a digit, so `2.35H` / `2.35 H` are safe.
  take(/(?<=[\d.)])\s*H\s*$|^\s*H\s+(?=[\d.<>])/g, "H");
  take(/(?<=[\d.)])\s*L\s*$|^\s*L\s+(?=[\d.<>])/g, "L");
  take(/\*+|异常/g, "abnormal");
  return { rest: squish(rest), marker };
}

/**
 * The printed value without its flag marker (`6.4↑` → `6.4`, `↓0.92` → `0.92`,
 * `阳性(+)*` → `阳性(+)`), for showing in an editable field. The raw text is
 * kept separately for provenance.
 */
export function stripValueMarker(raw: string | number | null | undefined): string {
  if (raw == null) return "";
  const text = String(raw).trim();
  const { rest } = extractMarker(text);
  return rest || text;
}

/**
 * Normalize a qualitative result to one of 阴性 / 阳性 / 弱阳性 / 正常, keeping
 * the grade for `+` results. Returns null when the text is not qualitative.
 */
export function normalizeQualitative(raw: string): { text: string; grade: number | null } | null {
  const t = squish(normalizeWidth(raw)).replace(/\s+/g, "");
  if (!t) return null;
  // Combined forms like 阴性(-) or 阳性(++)
  const inner = t.match(/^(阴性|阳性|弱阳性)\(([^)]*)\)$/);
  if (inner) {
    const base = inner[1];
    const plus = (inner[2].match(/\+/g) ?? []).length;
    return { text: base, grade: base === "阳性" ? Math.max(plus, 1) : base === "弱阳性" ? 0.5 : 0 };
  }
  if (/^(正常|normal)$/i.test(t)) return { text: "正常", grade: 0 };
  if (NEGATIVE_RE.test(t)) return { text: "阴性", grade: 0 };
  if (WEAK_RE.test(t)) return { text: "弱阳性", grade: 0.5 };
  if (POSITIVE_RE.test(t)) {
    const digit = t.match(/[1-4]/);
    const plus = (t.match(/\+/g) ?? []).length;
    return { text: "阳性", grade: digit ? Number(digit[0]) : Math.max(plus, 1) };
  }
  return null;
}

/** True when the printed result is a qualitative word/symbol rather than a number. */
export function isQualitativeText(raw: string): boolean {
  const { rest } = extractMarker(normalizeWidth(raw));
  if (/^[<>]=?\s*-?\d/.test(rest) || /^-?\d/.test(rest)) return false;
  return normalizeQualitative(rest) !== null;
}

/** Parse a printed result value. Never throws. */
export function parseResultValue(raw: string | number | null | undefined): ParsedValue {
  if (typeof raw === "number") {
    return { num: Number.isFinite(raw) ? raw : null, censor: null, qualitative: null, grade: null, marker: null, text: String(raw) };
  }
  const text = squish(normalizeWidth(raw ?? ""));
  const empty: ParsedValue = { num: null, censor: null, qualitative: null, grade: null, marker: null, text };
  if (!text) return empty;

  const { rest, marker } = extractMarker(text);

  // Qualitative first: `-` alone must not be read as a negative number.
  const qual = normalizeQualitative(rest);
  if (qual) return { ...empty, qualitative: qual.text, grade: qual.grade, marker };

  // Numbers: optional censor, thousands separators, trailing unit text.
  const m = rest.match(/^([<>]=?)?\s*(-?\d[\d,]*(?:\.\d+)?|-?\.\d+)(?:\s*[eE]([+-]?\d+))?/);
  if (m) {
    const censor = m[1] ? (m[1][0] as "<" | ">") : null;
    let num = Number(m[2].replace(/,/g, ""));
    if (m[3]) num *= 10 ** Number(m[3]);
    if (Number.isFinite(num)) return { ...empty, num, censor, marker };
  }
  return { ...empty, marker };
}

/** Split a blood-pressure reading such as `128/82 mmHg` into systolic / diastolic. */
export function splitBloodPressure(raw: string): { sbp: number; dbp: number } | null {
  const m = normalizeWidth(raw).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  const sbp = Number(m[1]);
  const dbp = Number(m[2]);
  if (sbp < 50 || sbp > 300 || dbp < 20 || dbp > 200 || dbp >= sbp) return null;
  return { sbp, dbp };
}
