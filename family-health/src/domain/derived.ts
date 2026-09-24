/**
 * Metrics computed from other results. All inputs are in canonical units
 * (see indicators.ts): creatinine μmol/L, glucose mmol/L, insulin μU/mL,
 * lipids mmol/L, proteins g/L, weight kg, height cm.
 */
import { getIndicator } from "./indicators.js";
import type { Sex } from "./types.js";
import { roundTo } from "./units.js";

/** Whole years between a birth date (YYYY-MM-DD) and a reference date. */
export function ageAt(birthDate: string | null | undefined, at: string | Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  const d = typeof at === "string" ? new Date(`${at.slice(0, 10)}T00:00:00Z`) : at;
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return null;
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * eGFR by the 2021 CKD-EPI creatinine equation (race-free), in
 * mL/min/1.73m². Inputs: serum creatinine in μmol/L, age in years, sex.
 *
 *   eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × (1.012 if female)
 *   κ = 0.7 (F) / 0.9 (M), α = -0.241 (F) / -0.302 (M), Scr in mg/dL
 */
export function egfrCkdEpi2021(creatinineUmolL: number, age: number, sex: Sex): number | null {
  if (!(creatinineUmolL > 0) || !(age >= 18) || (sex !== "male" && sex !== "female")) return null;
  const scr = creatinineUmolL / 88.4;
  const female = sex === "female";
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = scr / kappa;
  const egfr = 142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
  return roundTo(egfr, 0);
}

/** HOMA-IR = fasting glucose (mmol/L) × fasting insulin (μU/mL) / 22.5. */
export function homaIr(glucoseMmolL: number, insulinUUmL: number): number | null {
  if (!(glucoseMmolL > 0) || !(insulinUUmL > 0)) return null;
  return roundTo((glucoseMmolL * insulinUUmL) / 22.5, 2);
}

/** Non-HDL cholesterol = TC − HDL-C (mmol/L). */
export function nonHdl(tc: number, hdl: number): number | null {
  if (!(tc > 0) || !(hdl > 0) || hdl > tc) return null;
  return roundTo(tc - hdl, 2);
}

/** Globulin = total protein − albumin (g/L). */
export function globulin(tp: number, alb: number): number | null {
  if (!(tp > 0) || !(alb > 0) || alb >= tp) return null;
  return roundTo(tp - alb, 1);
}

/** Albumin / globulin ratio. */
export function agRatio(alb: number, glb: number): number | null {
  if (!(alb > 0) || !(glb > 0)) return null;
  return roundTo(alb / glb, 2);
}

/** BMI = weight (kg) / height (m)². */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 50)) return null;
  const m = heightCm / 100;
  return roundTo(weightKg / (m * m), 1);
}

function ratio(a: number | undefined, b: number | undefined, decimals: number): number | null {
  if (!(a != null && a >= 0) || !(b != null && b > 0)) return null;
  return roundTo(a / b, decimals);
}

export interface DerivedContext {
  sex?: Sex | null;
  /** Age in whole years at the exam date. */
  age?: number | null;
  /** Member's height (cm) when the report itself has none. */
  heightCm?: number | null;
}

export interface DerivedValue {
  code: string;
  value: number;
  /** Codes the value was computed from. */
  from: string[];
}

/**
 * Compute derived indicators that the report did not already print.
 * `values` maps indicator codes to canonical numeric values for one exam.
 */
export function computeDerived(values: Record<string, number | undefined>, ctx: DerivedContext = {}): DerivedValue[] {
  const v = { ...values };
  const out: DerivedValue[] = [];
  const add = (code: string, value: number | null, from: string[]) => {
    if (value == null || !Number.isFinite(value) || v[code] != null) return;
    v[code] = value;
    out.push({ code, value, from });
  };

  if (v.TP != null && v.ALB != null) add("GLB", globulin(v.TP, v.ALB), ["TP", "ALB"]);
  if (v.ALB != null && v.GLB != null) add("AG_RATIO", agRatio(v.ALB, v.GLB), ["ALB", "GLB"]);
  if (v.TBIL != null && v.DBIL != null && v.TBIL >= v.DBIL) add("IBIL", roundTo(v.TBIL - v.DBIL, 1), ["TBIL", "DBIL"]);
  if (v.AST != null && v.ALT != null) add("AST_ALT", ratio(v.AST, v.ALT, 2), ["AST", "ALT"]);
  if (v.TC != null && v.HDL_C != null) add("NON_HDL_C", nonHdl(v.TC, v.HDL_C), ["TC", "HDL_C"]);
  if (v.GLU != null && v.INS != null) add("HOMA_IR", homaIr(v.GLU, v.INS), ["GLU", "INS"]);
  if (v.CREA != null && ctx.age != null && ctx.sex) add("EGFR", egfrCkdEpi2021(v.CREA, ctx.age, ctx.sex), ["CREA"]);
  const height = v.HEIGHT ?? ctx.heightCm ?? undefined;
  if (v.WEIGHT != null && height != null) add("BMI", bmi(v.WEIGHT, height), v.HEIGHT != null ? ["WEIGHT", "HEIGHT"] : ["WEIGHT"]);
  if (v.WAIST != null && v.HIP != null) add("WHR", ratio(v.WAIST, v.HIP, 2), ["WAIST", "HIP"]);
  if (v.FPSA != null && v.TPSA != null) add("FPSA_RATIO", ratio(v.FPSA, v.TPSA, 2), ["FPSA", "TPSA"]);
  if (v.PGI != null && v.PGII != null) add("PGR", ratio(v.PGI, v.PGII, 2), ["PGI", "PGII"]);

  // Keep only codes that exist in the dictionary (defensive against typos).
  return out.filter((d) => getIndicator(d.code));
}
