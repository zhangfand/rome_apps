/**
 * Hard physiological limits for manually entered values (chat measurements,
 * reviewer edits). These are not reference ranges: anything outside them is
 * almost certainly a typo or a unit mix-up (体重 7000 kg, 血糖 108 mmol/L), so
 * the value is rejected with a clear message instead of becoming "latest".
 * All bounds are in the indicator's canonical unit and deliberately wide.
 */
import { getIndicator } from "./indicators.js";

const B: Record<string, [number, number]> = {
  // 一般检查
  HEIGHT: [30, 250],
  WEIGHT: [1, 400],
  BMI: [8, 100],
  WAIST: [30, 250],
  HIP: [30, 250],
  WHR: [0.4, 2],
  BODY_FAT: [1, 75],
  VISCERAL_FAT: [1, 60],
  SBP: [50, 300],
  DBP: [20, 200],
  HR: [20, 250],
  // 血常规
  WBC: [0.1, 500],
  RBC: [0.5, 10],
  HGB: [20, 260],
  HCT: [5, 80],
  PLT: [1, 3000],
  MCV: [40, 150],
  // 生化
  GLU: [0.5, 60],
  GLU_2H: [0.5, 60],
  HBA1C: [2, 25],
  TC: [0.3, 30],
  TG: [0.05, 100],
  HDL_C: [0.05, 10],
  LDL_C: [0.05, 25],
  UA: [10, 2000],
  CREA: [5, 3000],
  UREA: [0.3, 100],
  ALT: [0, 20000],
  AST: [0, 20000],
  TBIL: [0, 1000],
  ALB: [5, 70],
  TP: [20, 150],
  K: [1, 10],
  NA: [90, 200],
  CA: [0.5, 5],
  HCY: [0, 500],
};

/** Codes that may legitimately be negative (T/Z scores). Every other numeric value must be ≥ 0. */
const SIGNED = new Set(["BMD_T", "BMD_Z"]);

export interface PlausibilityIssue {
  code: string;
  name: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  message: string;
}

export function plausibleRange(code: string): [number, number] | null {
  return B[code] ?? null;
}

const fmt = (n: number) => String(+n.toPrecision(6));

/** Null when the canonical-unit value is plausible for the indicator. */
export function checkPlausible(code: string | null | undefined, value: number | null | undefined): PlausibilityIssue | null {
  if (!code || value == null) return null;
  const def = getIndicator(code);
  const unit = def?.unit ?? "";
  const name = def?.zh ?? code;
  const range = B[code] ?? (SIGNED.has(code) ? null : ([0, Number.POSITIVE_INFINITY] as [number, number]));
  if (!Number.isFinite(value)) {
    return { code, name, value, unit, min: range?.[0] ?? -Infinity, max: range?.[1] ?? Infinity, message: `${name}的数值无效。` };
  }
  if (!range || (value >= range[0] && value <= range[1])) return null;
  const [min, max] = range;
  const shown = `${fmt(value)}${unit ? ` ${unit}` : ""}`;
  const accepted = Number.isFinite(max) ? `${fmt(min)}–${fmt(max)}${unit ? ` ${unit}` : ""}` : `不小于 ${fmt(min)}`;
  return {
    code,
    name,
    value,
    unit,
    min,
    max,
    message: `${name} ${shown} 超出合理范围（${accepted}），请检查数值和单位是否填错。`,
  };
}
