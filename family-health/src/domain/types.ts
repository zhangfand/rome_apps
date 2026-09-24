/** Shared domain types for 家庭体检助手. Pure data, no runtime code. */

export type Sex = "male" | "female";

export type Relation = "本人" | "配偶" | "父亲" | "母亲" | "子女" | "其他";
export const RELATIONS: readonly Relation[] = ["本人", "配偶", "父亲", "母亲", "子女", "其他"];

export type CategoryKey =
  | "general"
  | "blood_routine"
  | "urine"
  | "liver"
  | "kidney"
  | "uric_acid"
  | "lipid"
  | "glucose"
  | "thyroid"
  | "tumor"
  | "bone"
  | "coag"
  | "electrolyte"
  | "cardio"
  | "vitamin"
  | "infection";

/**
 * Numeric reference interval in the indicator's canonical unit. Either bound
 * may be absent (`<5.2` has only `high`). Bounds are inclusive by default,
 * which matches how Chinese reports print `3.9-6.1`.
 */
export interface NumericRange {
  low?: number;
  high?: number;
  lowInclusive?: boolean;
  highInclusive?: boolean;
}

export type SexRange = NumericRange | { male: NumericRange; female: NumericRange };

/**
 * A unit conversion into the canonical unit:
 * `canonical = raw * factor + (offset ?? 0)`.
 */
export interface UnitConversion {
  unit: string;
  factor: number;
  offset?: number;
}

/**
 * How an out-of-range value should be read.
 * - `higher_worse` / `lower_worse`: only one side is usually concerning
 * - `both`: either side is concerning
 * - `qualitative`: positive/negative result
 * - `info`: shown for context, never flagged by default
 */
export type Direction = "higher_worse" | "lower_worse" | "both" | "qualitative" | "info";

export interface IndicatorDef {
  code: string;
  zh: string;
  en: string;
  aliases: string[];
  category: CategoryKey;
  /** Canonical unit; empty string for unitless ratios and qualitative tests. */
  unit: string;
  valueType: "numeric" | "qualitative";
  conversions?: UnitConversion[];
  /** Default reference interval used when the report did not print one. */
  ref?: SexRange;
  /** For qualitative tests: values considered normal. Defaults to 阴性. */
  qualitativeNormal?: string[];
  direction: Direction;
  /** Display precision in the canonical unit. */
  decimals?: number;
  /** Only meaningful for one sex (PSA, CA125…). */
  sex?: Sex;
  /** Computed from other indicators (eGFR, HOMA-IR, non-HDL…). */
  derived?: boolean;
  /** One or two plain-language Chinese sentences: what it measures and why it matters. */
  explain: string;
}

/** Parsed flag of a single result. */
export type Flag = "H" | "L" | "normal" | "abnormal";

export interface CategoryInfo {
  key: CategoryKey;
  zh: string;
  order: number;
}
