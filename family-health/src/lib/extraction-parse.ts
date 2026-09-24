/**
 * Validation and repair of the extractor / mapper agents' JSON. Models
 * occasionally return numbers as strings, omit nullable fields, put page
 * numbers outside the batch, or wrap everything in an extra object; this
 * module coerces what it safely can and drops what it cannot.
 */
import { getFinding } from "../domain/findings.js";
import { getIndicator } from "../domain/indicators.js";
import { isCompatibleUnit } from "../domain/units.js";
import { normalizeExamDate } from "./dates.js";

export interface ExtractedResult {
  page: number;
  section: string | null;
  name: string;
  value: string;
  unit: string | null;
  ref: string | null;
  flag: string | null;
}

export interface ExtractedFinding {
  page: number;
  organ: string | null;
  text: string;
  findingKey: string | null;
  severity: string | null;
}

export interface ExtractorBatch {
  examDate: string | null;
  provider: string | null;
  results: ExtractedResult[];
  findings: ExtractedFinding[];
  skippedPages: number[];
}

const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.trim();
  // `-` and `无` are meaningful results (negative); only drop null-like tokens.
  return t && !/^(null|none|n\/a|undefined)$/i.test(t) ? t : null;
};

function unwrap(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.results) || Array.isArray(obj.findings)) return obj;
  for (const key of ["data", "output", "result", "extraction"]) {
    const inner = obj[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) return unwrap(inner);
  }
  return obj;
}

function clampPage(v: unknown, pages: number[]): number {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isInteger(n) && pages.includes(n)) return n;
  return pages[0];
}

/**
 * Validate one extractor batch. Returns null when the payload is not an
 * object at all (the caller retries); otherwise a repaired batch.
 */
export function parseExtractorOutput(raw: unknown, pages: number[], now: Date = new Date()): ExtractorBatch | null {
  const obj = unwrap(raw);
  if (!obj) return null;
  const results: ExtractedResult[] = [];
  for (const item of Array.isArray(obj.results) ? obj.results : []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = str(r.name ?? r.item ?? r.raw_name);
    const value = str(r.value ?? r.result ?? r.raw_value);
    if (!name || value == null) continue;
    if (name.length > 60) continue; // prose, not a table row
    results.push({
      page: clampPage(r.page, pages),
      section: str(r.section),
      name,
      value,
      unit: str(r.unit),
      ref: str(r.ref ?? r.reference ?? r.ref_range),
      flag: str(r.flag ?? r.arrow),
    });
  }
  const findings: ExtractedFinding[] = [];
  for (const item of Array.isArray(obj.findings) ? obj.findings : []) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const text = str(f.text ?? f.raw_text ?? f.conclusion);
    if (!text) continue;
    const key = str(f.finding_key ?? f.key);
    findings.push({
      page: clampPage(f.page, pages),
      organ: str(f.organ),
      text,
      findingKey: key && getFinding(key) ? key : null,
      severity: str(f.severity),
    });
  }
  const skipped = (Array.isArray(obj.skipped_pages) ? obj.skipped_pages : []).map(Number).filter((n) => pages.includes(n));
  return {
    examDate: normalizeExamDate(str(obj.exam_date), now),
    provider: str(obj.provider),
    results,
    findings,
    skippedPages: skipped,
  };
}

export interface MapperInput {
  name: string;
  unit: string | null;
  section: string | null;
}

/**
 * Validate the mapper agent's answer. Only codes that exist in the dictionary
 * and are compatible with the row's unit are accepted.
 */
export function parseMapperOutput(raw: unknown, inputs: MapperInput[]): Map<string, string> {
  const out = new Map<string, string>();
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(obj.mappings) ? obj.mappings : Array.isArray(raw) ? (raw as unknown[]) : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const name = str(m.raw_name ?? m.name);
    const code = str(m.code);
    if (!name || !code) continue;
    const input = inputs.find((i) => i.name === name);
    const def = getIndicator(code.toUpperCase());
    if (!input || !def) continue;
    if (input.unit && def.valueType === "numeric" && !isCompatibleUnit(input.unit, def)) continue;
    out.set(name, def.code);
  }
  return out;
}
