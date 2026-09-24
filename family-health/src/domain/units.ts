/**
 * Unit normalization and conversion into each indicator's canonical unit.
 *
 * Reports spell units dozens of ways (`umol/L`, `μmol/l`, `µmol/L`, `微摩尔/升`,
 * `10*9/L`, `×10⁹/L`, `G/L` …). `normalizeUnit` folds those spellings onto one
 * canonical spelling; `toCanonical` then converts a value using the
 * indicator's declared conversions (mg/dL ↔ mmol/L etc.).
 */
import type { IndicatorDef } from "./types.js";
import { normalizeWidth } from "./text.js";

/** canonical spelling → spellings that mean exactly the same unit */
const SPELLINGS: Record<string, string[]> = {
  "μmol/L": ["umol/l", "micromol/l", "微摩尔/升", "微摩尔/l"],
  "mmol/L": ["mmol/l", "毫摩尔/升", "毫摩尔/l"],
  "nmol/L": ["nmol/l", "纳摩尔/升"],
  "pmol/L": ["pmol/l"],
  "mg/dL": ["mg/dl", "mg%", "mg/100ml"],
  "mg/L": ["mg/l"],
  "g/L": ["g/l", "克/升"],
  "g/dL": ["g/dl", "g%"],
  "U/L": ["u/l", "iu/l", "单位/升"],
  "U/mL": ["u/ml"],
  "IU/mL": ["iu/ml"],
  "kU/L": ["ku/l"],
  "kIU/L": ["kiu/l"],
  "mIU/L": ["miu/l"],
  "μIU/mL": ["uiu/ml"],
  "μU/mL": ["uu/ml"],
  "mU/L": ["mu/l"],
  "ng/mL": ["ng/ml"],
  "μg/L": ["ug/l"],
  "μg/mL": ["ug/ml"],
  "pg/mL": ["pg/ml"],
  "ng/L": ["ng/l"],
  "ng/dL": ["ng/dl"],
  "μg/dL": ["ug/dl"],
  "10^9/L": ["10^9/l", "109/l", "10e9/l", "x10^9/l", "x109/l", "*10^9/l", "10*9/l"],
  "10^12/L": ["10^12/l", "1012/l", "10e12/l", "x10^12/l", "x1012/l", "10*12/l", "t/l"],
  "%": ["%", "百分比"],
  "fL": ["fl"],
  "pg": ["pg"],
  "mmHg": ["mmhg", "毫米汞柱"],
  "次/分": ["次/分", "次/分钟", "次/min", "bpm", "/min", "beats/min"],
  kg: ["kg", "公斤"],
  cm: ["cm", "厘米"],
  "kg/m²": ["kg/m2", "kg/m^2"],
  s: ["s", "秒", "sec"],
  "mL/min/1.73m²": ["ml/min/1.73m2", "ml/min/1.73m^2", "ml/min.1.73m2", "ml/min"],
  "‰": ["‰", "permil", "dob"],
  "dpm/mmol": ["dpm/mmol", "dpm/mmolco2", "dpm/mmol.co2"],
  "mg/g": ["mg/g", "mg/gcr", "mg/g.cr", "mg/gcre"],
  "mg/mmol": ["mg/mmol", "mg/mmolcr"],
  "/μL": ["/ul", "个/ul", "cells/ul", "cell/ul"],
  "/HP": ["/hp", "个/hp", "/hpf", "个/hpf"],
  "mm/h": ["mm/h", "mm/hr", "mm/1h", "mm/60min"],
  "g/cm²": ["g/cm2", "g/cm^2"],
  "mmol/mol": ["mmol/mol"],
};

/** Units that are numerically identical (factor 1) even though spelled differently. */
const EQUIVALENT_GROUPS: string[][] = [
  ["U/mL", "kU/L"],
  ["IU/mL", "kIU/L"],
  ["mIU/L", "μIU/mL", "μU/mL", "mU/L"],
  ["ng/mL", "μg/L"],
  ["pg/mL", "ng/L"],
  ["mg/L", "μg/mL"],
  ["U/L"],
];

const LOOKUP = new Map<string, string>();
for (const [canonical, spellings] of Object.entries(SPELLINGS)) {
  LOOKUP.set(unitKey(canonical), canonical);
  for (const s of spellings) LOOKUP.set(unitKey(s), canonical);
}

function unitKey(raw: string): string {
  return normalizeWidth(raw)
    .replace(/\s+/g, "")
    .replace(/[µμ]/g, "u")
    .replace(/[×]/g, "x")
    .replace(/(?<=\d)\*\*/g, "^")
    .toLowerCase();
}

/**
 * Fold a raw unit string to its canonical spelling. Unknown units are returned
 * width-normalized and trimmed so they still display sensibly. Specimen
 * qualifiers such as ` FEU` (D-dimer) are dropped.
 */
export function normalizeUnit(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = normalizeWidth(raw).trim();
  if (!s) return "";
  // `G/L` (giga per litre) is a cell count; `g/L` is grams. Decide on case first.
  if (/^G\/L$/.test(s)) return "10^9/L";
  if (/^T\/L$/.test(s)) return "10^12/L";
  s = s.replace(/\s*\(?FEU\)?\s*$/i, "").replace(/^\[|\]$/g, "");
  const hit = LOOKUP.get(unitKey(s));
  return hit ?? s;
}

function equivalent(a: string, b: string): boolean {
  if (a === b) return true;
  return EQUIVALENT_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

export type ConversionStatus =
  /** Unit already canonical (or an exact equivalent). */
  | "same"
  /** Converted with a declared factor. */
  | "converted"
  /** No unit printed; assumed canonical. */
  | "assumed"
  /** Unit not convertible to the canonical unit. */
  | "incompatible";

export interface CanonicalValue {
  value: number;
  unit: string;
  status: ConversionStatus;
}

/**
 * Convert `value` in `rawUnit` to the indicator's canonical unit. Returns the
 * input unchanged with status `incompatible` when no conversion is known, so
 * callers keep the raw value but do not trend it against canonical values.
 */
export function toCanonical(value: number, rawUnit: string | null | undefined, def: IndicatorDef): CanonicalValue {
  const unit = normalizeUnit(rawUnit);
  const canonical = def.unit;
  if (!unit) return { value, unit: canonical, status: "assumed" };
  if (equivalent(unit, canonical) || normalizeUnit(canonical) === unit) {
    return { value, unit: canonical, status: "same" };
  }
  for (const conv of def.conversions ?? []) {
    const cu = normalizeUnit(conv.unit);
    if (equivalent(cu, unit)) {
      const out = value * conv.factor + (conv.offset ?? 0);
      return { value: roundTo(out, (def.decimals ?? 2) + 2), unit: canonical, status: "converted" };
    }
  }
  return { value, unit, status: "incompatible" };
}

/** Convert a canonical value back into another unit the indicator knows about. */
export function fromCanonical(value: number, targetUnit: string, def: IndicatorDef): number | null {
  const unit = normalizeUnit(targetUnit);
  if (equivalent(unit, def.unit)) return value;
  const conv = (def.conversions ?? []).find((c) => equivalent(normalizeUnit(c.unit), unit));
  if (!conv) return null;
  return (value - (conv.offset ?? 0)) / conv.factor;
}

/** True when `rawUnit` can be expressed in the indicator's canonical unit. */
export function isCompatibleUnit(rawUnit: string | null | undefined, def: IndicatorDef): boolean {
  if (!rawUnit || !normalizeUnit(rawUnit)) return true;
  return toCanonical(1, rawUnit, def).status !== "incompatible";
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
