/**
 * Precedence / verdict / threshold engines, tested with SYNTHETIC fixtures:
 * every source, range and threshold below is fake (ids start with `test-`,
 * numbers chosen to be easy to reason about, not taken from any standard).
 */
import { describe, expect, it } from "vitest";
import type { RangeCandidate, Source, ThresholdInput } from "../data/schema.js";
import { computeFlag } from "./flags.js";
import { INDICATORS, defaultRange, getIndicator } from "./indicators.js";
import { LEVEL_ZH, RANGE_PRECEDENCE, fallbackRange, populationScore, standardRange, verdict } from "./provenance.js";
import { parseRefRange } from "./refRange.js";
import { THRESHOLD_PRECEDENCE, categorize, inBounds } from "./thresholds.js";
import type { IndicatorDef } from "./types.js";
import { parseResultValue } from "./values.js";

const src = (id: string, level: Source["level"]): Source => ({
  id,
  org: `TEST ORG ${id}`,
  title: `Synthetic source ${id}`,
  identifier: `TEST-${id}`,
  scope: ["reference_range", "decision_threshold"],
  level,
  retrieved: "2026-01-01",
});
const SOURCES = new Map(
  [
    src("test-national", "national_cn"),
    src("test-intl", "international"),
    src("test-intl-gl", "intl_guideline"),
    src("test-cn-gl", "cn_guideline"),
    src("test-cn-cons", "cn_consensus"),
  ].map((s) => [s.id, s]),
);

const range = (id: string, level: RangeCandidate["level"], low: number | undefined, high: number | undefined, extra: Partial<RangeCandidate> = {}): RangeCandidate => ({
  id,
  kind: "reference",
  level,
  population: {},
  low,
  high,
  unit: "mmol/L",
  sourceId: `test-${{ national_cn: "national", international: "intl", intl_guideline: "intl-gl", cn_guideline: "cn-gl", cn_consensus: "cn-cons", report: "x", unverified: "x" }[level]}`,
  ...extra,
});

const GLU = getIndicator("GLU")!;
const withRanges = (ranges: RangeCandidate[], extra: Partial<IndicatorDef> = {}): IndicatorDef => ({ ...GLU, ranges, ...extra });

describe("standard range precedence", () => {
  it("documents the order: national > international > intl guideline > CN guideline > CN consensus", () => {
    expect(RANGE_PRECEDENCE).toEqual(["national_cn", "international", "intl_guideline", "cn_guideline", "cn_consensus"]);
    expect(THRESHOLD_PRECEDENCE).toEqual(["national_cn", "cn_guideline", "cn_consensus", "international", "intl_guideline"]);
    expect(LEVEL_ZH.national_cn).toBe("国家标准");
    expect(LEVEL_ZH.unverified).toBe("未核实");
  });

  it("picks the national range and reports a conflict with a differing international one", () => {
    const def = withRanges([range("i", "international", 4, 7), range("n", "national_cn", 3, 6), range("g", "cn_guideline", 2, 8)]);
    const std = standardRange(def, { sex: "male", age: 40 }, SOURCES);
    expect(std.primary?.id).toBe("n");
    expect(std.primary?.source?.id).toBe("test-national");
    expect(std.alternatives.map((r) => r.id)).toEqual(["i", "g"]);
    expect(std.conflict?.national.id).toBe("n");
    expect(std.conflict?.international.id).toBe("i");
    expect(std.conflict?.note_zh).toContain("以国家标准为准");
    expect(std.legacy).toBeNull();
  });

  it("uses the declared conflict note, and none when bounds agree", () => {
    const def = withRanges([range("n", "national_cn", 3, 6), range("i", "international", 3, 6)], {
      conflict: { note_zh: "测试冲突说明", resolution: "测试处理", nationalRangeId: "n", internationalRangeId: "i" },
    });
    expect(standardRange(def, {}, SOURCES).conflict).toBeNull();
    const def2 = withRanges([range("n", "national_cn", 3, 6), range("i", "international", 3, 6.5)], { conflict: def.conflict });
    expect(standardRange(def2, {}, SOURCES).conflict?.note_zh).toBe("测试冲突说明");
  });

  it("falls back international → intl guideline → CN guideline → CN consensus", () => {
    const base = [range("c", "cn_consensus", 1, 9), range("g", "cn_guideline", 2, 8), range("ig", "intl_guideline", 2.5, 7.5)];
    expect(standardRange(withRanges(base), {}, SOURCES).primary?.id).toBe("ig");
    expect(standardRange(withRanges(base.slice(0, 2)), {}, SOURCES).primary?.id).toBe("g");
    expect(standardRange(withRanges(base.slice(0, 1)), {}, SOURCES).primary?.id).toBe("c");
  });

  it("prefers the most specific population and skips ones that do not apply", () => {
    const def = withRanges([
      range("all", "national_cn", 3, 6),
      range("m", "national_cn", 3.5, 6.5, { population: { sex: "male" } }),
      range("m60", "national_cn", 4, 7, { population: { sex: "male", age: { min: 60 } } }),
      range("preg", "national_cn", 1, 2, { population: { pregnancy: true } }),
    ]);
    expect(standardRange(def, { sex: "male", age: 65 }, SOURCES).primary?.id).toBe("m60");
    expect(standardRange(def, { sex: "male", age: 40 }, SOURCES).primary?.id).toBe("m");
    expect(standardRange(def, { sex: "female", age: 40 }, SOURCES).primary?.id).toBe("all");
    expect(standardRange(def, {}, SOURCES).primary?.id).toBe("all");
    expect(populationScore({ age: { min: 18, max: 60, maxInclusive: false } }, { age: 60 })).toBe(-1);
    expect(populationScore({ age: { min: 18, max: 60 } }, { age: 60 })).toBe(1);
  });

  it("converts candidate units to the canonical unit", () => {
    const def = withRanges([range("n", "national_cn", 70, 110, { unit: "mg/dL" })]);
    const p = standardRange(def, {}, SOURCES).primary!;
    expect(p.unit).toBe("mmol/L");
    expect(p.low).toBeCloseTo(3.885, 3);
    expect(p.high).toBeCloseTo(6.105, 3);
  });

  it("ignores report/unverified and number-less candidates, and falls back to the legacy range", () => {
    const def = withRanges([range("u", "unverified", undefined, undefined, { sourceId: "legacy-unverified" })]);
    const std = standardRange(def, { sex: "male" }, SOURCES);
    expect(std.primary).toBeNull();
    expect(std.legacy?.level).toBe("unverified");
    expect(std.legacy?.source?.id).toBe("legacy-unverified");
  });
});

describe("flag regression", () => {
  it("fallback range: verified standard when one applies, otherwise the old dictionary default", () => {
    for (const def of INDICATORS) {
      if (def.direction === "info") continue;
      for (const sex of ["male", "female", null] as const) {
        for (const age of [33, 65, null]) {
          const a = fallbackRange(def, { sex, age });
          const std = standardRange(def, { sex, age }).primary;
          const b = std ? { low: std.low ?? undefined, high: std.high ?? undefined } : defaultRange(def, sex);
          expect([a?.low ?? null, a?.high ?? null], `${def.code} ${sex} ${age}`).toEqual([b?.low ?? null, b?.high ?? null]);
        }
      }
    }
  });

  it("only these indicators changed their fallback numbers when verified ranges arrived", () => {
    const changed = new Set<string>();
    for (const def of INDICATORS) {
      if (def.direction === "info" || !def.ref) continue;
      for (const sex of ["male", "female"] as const) {
        for (const age of [33, 65]) {
          const a = fallbackRange(def, { sex, age });
          const b = defaultRange(def, sex);
          if (a?.low !== b?.low || a?.high !== b?.high) changed.add(def.code);
        }
      }
    }
    // Reviewed differences between the original dictionary and the standards:
    // ALP (WS/T 404.1 女性按年龄), TBIL/DBIL (WS/T 404.4 只有上限), CREA/UREA
    // (WS/T 404.5 按 60 岁分段), APOA1/APOB (血脂指南 2023 描述性范围).
    expect([...changed].sort()).toEqual(["ALP", "APOA1", "APOB", "CREA", "DBIL", "TBIL", "UREA"]);
  });

  it("verdict().flag equals computeFlag for a spread of values", () => {
    for (const code of ["GLU", "TG", "HDL_C", "ALT", "PLT", "HGB", "UA", "U_PRO", "HBSAG", "TSH", "BMI"]) {
      const def = getIndicator(code)!;
      for (const raw of ["0.1", "1", "3.5", "6.4↑", "↓0.9", "45", "150", "480", "阴性", "阳性(+)", "<0.5", "*2.0"]) {
        for (const refText of [null, "3.9-6.1", "<1.7", ">1.04", "阴性"]) {
          const value = parseResultValue(raw);
          const reportRange = parseRefRange(refText, "male");
          const expected = computeFlag({ value, reportRange, def, sex: "male" });
          const v = verdict({ value, valueNum: value.num, unit: def.unit, reportRange, reportRangeText: refText, def, who: { sex: "male", age: 50 } });
          expect(v.flag, `${code} ${raw} ${refText}`).toBe(expected);
        }
      }
    }
  });
});

describe("verdict basis, arrows and disagreement", () => {
  const def = withRanges([range("n", "national_cn", 3.9, 6.1)]);
  const run = (raw: string, refText: string | null, d: IndicatorDef = def) => {
    const value = parseResultValue(raw);
    return verdict(
      { value, valueNum: value.num, unit: "mmol/L", reportRange: parseRefRange(refText), reportRangeText: refText, def: d, who: { sex: "male", age: 50 }, report: { reportId: "r1", provider: "测试机构", examDate: "2026-01-01", page: 3 } },
      SOURCES,
    );
  };

  it("uses the printed range first (basis report) and cites the report + page", () => {
    const v = run("6.3", "3.9-6.5");
    expect(v.basis).toBe("report");
    expect(v.flag).toBe("normal");
    expect(v.usedRange?.level).toBe("report");
    expect(v.usedRange?.source?.org).toBe("测试机构");
    expect(v.usedRange?.locator).toBe("第 3 页");
    expect(v.reason_zh).toContain("以报告单为准");
    // …while the standard says high: disagreement
    expect(v.standardVerdict).toBe("H");
    expect(v.labVerdict).toBe("normal");
    expect(v.disagreement).toBe(true);
  });

  it("uses the standard range when nothing is printed (no disagreement possible)", () => {
    const v = run("6.3", null);
    expect(v.basis).toBe("standard");
    expect(v.flag).toBe("H");
    expect(v.usedRange?.source?.id).toBe("test-national");
    expect(v.disagreement).toBe(false);
  });

  it("uses the legacy range, labelled unverified, when there is no verified one", () => {
    const v = run("6.3", null, GLU);
    expect(v.basis).toBe("legacy");
    expect(v.usedRange?.levelZh).toBe("未核实");
    expect(v.standardVerdict).toBeNull();
    expect(v.disagreement).toBe(false);
  });

  it("a printed ↑/↓ decides the flag; the standard is still compared", () => {
    const up = run("5.0↑", null);
    expect(up.flag).toBe("H");
    expect(up.basis).toBe("report");
    expect(up.marker).toBe("H");
    expect(up.standardVerdict).toBe("normal");
    expect(up.disagreement).toBe(true);
    const agree = run("6.5↑", null);
    expect(agree.disagreement).toBe(false);
  });

  it("`*` alone and qualitative results never count as a disagreement", () => {
    expect(run("*5.0", "3.9-6.1").disagreement).toBe(false);
    const q = run("阳性", "阴性");
    expect(q.basis).toBe("report");
    expect(q.flag).toBe("abnormal");
    expect(q.disagreement).toBe(false);
  });

  it("keeps the printed unit with a printed range that was converted", () => {
    const ua = getIndicator("UA")!;
    const value = parseResultValue("7.8");
    const v = verdict({ value, valueNum: 463.944, unit: "μmol/L", reportRange: { low: 208.18, high: 428.256 }, reportRangeText: "3.5-7.2", rawUnit: "mg/dL", def: ua, who: {} }, SOURCES);
    expect(v.reportRange).toMatchObject({ text: "3.5-7.2", textUnit: "mg/dL", unit: "μmol/L", low: 208.18 });
    const same = verdict({ value, valueNum: 7.8, unit: "μmol/L", reportRange: { low: 3, high: 9 }, reportRangeText: "3-9", rawUnit: "umol/L", def: ua, who: {} }, SOURCES);
    expect(same.reportRange?.textUnit).toBeNull();
  });

  it("does not compare across units", () => {
    const value = parseResultValue("110");
    const v = verdict({ value, valueNum: 110, unit: "umol/X", reportRange: parseRefRange("70-100"), reportRangeText: "70-100", def, who: {} }, SOURCES);
    expect(v.standardVerdict).toBeNull();
    expect(v.disagreement).toBe(false);
  });
});

// ------------------------------------------------------------------ thresholds (synthetic)

const T = (t: Partial<ThresholdInput> & Pick<ThresholdInput, "id" | "indicatorCodes" | "categories" | "level" | "sourceId">): ThresholdInput => ({
  name_zh: t.id,
  unit: "",
  population: {},
  ...t,
});

const FIXTURES: ThresholdInput[] = [
  T({ id: "test-bmi-cn", indicatorCodes: ["BMI"], level: "national_cn", sourceId: "test-national", unit: "kg/m²", categories: [
    { label_zh: "偏瘦(测试)", high: 18, severity: "mild" },
    { label_zh: "正常(测试)", low: 18, high: 25, severity: "normal" },
    { label_zh: "超重(测试)", low: 25, high: 30, severity: "mild" },
    { label_zh: "肥胖(测试)", low: 30, severity: "moderate" },
  ] }),
  T({ id: "test-bmi-intl", indicatorCodes: ["BMI"], level: "international", sourceId: "test-intl", alternativeOf: "test-bmi-cn", categories: [
    { label_zh: "正常(国际测试)", high: 26, severity: "normal" },
    { label_zh: "超重(国际测试)", low: 26, high: 32, severity: "mild" },
    { label_zh: "肥胖(国际测试)", low: 32, severity: "moderate" },
  ] }),
  T({ id: "test-waist-m", indicatorCodes: ["WAIST"], level: "national_cn", sourceId: "test-national", population: { sex: "male" }, categories: [
    { label_zh: "正常(测试)", high: 100, severity: "normal" }, { label_zh: "腹型肥胖(测试)", low: 100, severity: "mild" }] }),
  T({ id: "test-waist-f", indicatorCodes: ["WAIST"], level: "national_cn", sourceId: "test-national", population: { sex: "female" }, categories: [
    { label_zh: "正常(测试)", high: 90, severity: "normal" }, { label_zh: "腹型肥胖(测试)", low: 90, severity: "mild" }] }),
  T({ id: "test-bp", indicatorCodes: ["SBP", "DBP"], level: "cn_guideline", sourceId: "test-cn-gl", unit: "mmHg", categories: [
    { label_zh: "正常(测试)", bounds: { SBP: { high: 130 }, DBP: { high: 85 } }, severity: "normal" },
    { label_zh: "一级(测试)", bounds: { SBP: { low: 130, high: 160 }, DBP: { low: 85, high: 100 } }, severity: "mild" },
    { label_zh: "二级(测试)", bounds: { SBP: { low: 160 }, DBP: { low: 100 } }, severity: "moderate" },
  ] }),
  T({ id: "test-bp-intl", indicatorCodes: ["SBP", "DBP"], level: "intl_guideline", sourceId: "test-intl-gl", unit: "mmHg", categories: [
    { label_zh: "高(国际测试)", bounds: { SBP: { low: 125 }, DBP: { low: 80 } }, severity: "mild" },
    { label_zh: "正常(国际测试)", bounds: { SBP: { high: 125 }, DBP: { high: 80 } }, severity: "normal", rank: -1 },
  ] }),
  T({ id: "test-fpg", indicatorCodes: ["GLU"], level: "cn_guideline", sourceId: "test-cn-gl", unit: "mmol/L", categories: [
    { label_zh: "正常(测试)", high: 6, severity: "normal" }, { label_zh: "受损(测试)", low: 6, high: 7.5, severity: "mild" }, { label_zh: "诊断切点(测试)", low: 7.5, severity: "moderate" }] }),
  T({ id: "test-hba1c", indicatorCodes: ["HBA1C"], level: "cn_guideline", sourceId: "test-cn-gl", unit: "%", categories: [
    { label_zh: "未达切点(测试)", high: 7, severity: "normal" }, { label_zh: "达诊断切点(测试)", low: 7, severity: "moderate" }] }),
  T({ id: "test-tg", indicatorCodes: ["TG"], level: "cn_consensus", sourceId: "test-cn-cons", unit: "mmol/L", categories: [
    { label_zh: "合适(测试)", high: 2, severity: "normal" }, { label_zh: "升高(测试)", low: 2, high: 6, severity: "mild" }, { label_zh: "重度升高(测试)", low: 6, severity: "severe" }] }),
  T({ id: "test-ldl-target", kind: "target", indicatorCodes: ["LDL_C"], level: "cn_guideline", sourceId: "test-cn-gl", unit: "mmol/L", categories: [
    { label_zh: "低危目标(测试)", high: 3, severity: "info" }, { label_zh: "高于低危目标(测试)", low: 3, severity: "info" }] }),
  T({ id: "test-ldl", indicatorCodes: ["LDL_C"], level: "cn_guideline", sourceId: "test-cn-gl", unit: "mmol/L", categories: [
    { label_zh: "合适(测试)", high: 3.5, severity: "normal" }, { label_zh: "升高(测试)", low: 3.5, severity: "mild" }] }),
  T({ id: "test-ua", indicatorCodes: ["UA"], level: "cn_guideline", sourceId: "test-cn-gl", unit: "μmol/L", categories: [
    { label_zh: "正常(测试)", high: 450, inclusivity: "[]", severity: "normal" }, { label_zh: "高尿酸(测试)", low: 450, inclusivity: "(]", severity: "mild" }] }),
  T({ id: "test-tscore", indicatorCodes: ["BMD_T"], level: "international", sourceId: "test-intl", categories: [
    { label_zh: "骨质疏松(测试)", high: -3, inclusivity: "[]", severity: "moderate", rank: 2 }, { label_zh: "骨量减少(测试)", low: -3, high: -1, inclusivity: "(]", severity: "mild", rank: 1 }, { label_zh: "正常(测试)", low: -1, inclusivity: "()", severity: "normal", rank: 0 }] }),
  T({ id: "test-bapwv", indicatorCodes: ["BAPWV_L", "BAPWV_R"], level: "cn_consensus", sourceId: "test-cn-cons", unit: "cm/s", categories: [
    { label_zh: "正常(测试)", high: 1500, severity: "normal" }, { label_zh: "增高(测试)", low: 1500, severity: "mild" }] }),
  T({ id: "test-abi", indicatorCodes: ["ABI_L", "ABI_R"], level: "cn_consensus", sourceId: "test-cn-cons", categories: [
    { label_zh: "降低(测试)", high: 0.8, inclusivity: "[]", severity: "moderate" }, { label_zh: "正常(测试)", low: 0.8, high: 1.5, inclusivity: "(]", severity: "normal" }, { label_zh: "过高(测试)", low: 1.5, inclusivity: "()", severity: "mild" }] }),
  T({ id: "test-egfr", indicatorCodes: ["EGFR"], level: "intl_guideline", sourceId: "test-intl-gl", unit: "mL/min/1.73m²", categories: [
    { label_zh: "G5(测试)", high: 10, severity: "severe", rank: 5 }, { label_zh: "G4(测试)", low: 10, high: 20, severity: "severe", rank: 4 }, { label_zh: "G3(测试)", low: 20, high: 50, severity: "moderate", rank: 3 },
    { label_zh: "G2(测试)", low: 50, high: 80, severity: "mild", rank: 2 }, { label_zh: "G1(测试)", low: 80, severity: "normal", rank: 1 }] }),
  T({ id: "test-age60", indicatorCodes: ["SBP"], level: "national_cn", sourceId: "test-national", population: { age: { min: 60 } }, unit: "mmHg", categories: [
    { label_zh: "老年正常(测试)", high: 150, severity: "normal" }, { label_zh: "老年偏高(测试)", low: 150, severity: "mild" }] }),
];
const cat = (code: string, v: number, who = {}, siblings?: Record<string, number>) => categorize(code, v, who, { data: FIXTURES, sources: SOURCES, siblings });

describe("threshold categorisation (synthetic fixtures)", () => {
  it("inclusivity helpers", () => {
    expect(inBounds(25, 25, 30)).toBe(true);
    expect(inBounds(30, 25, 30)).toBe(false);
    expect(inBounds(30, 25, 30, "(]")).toBe(true);
    expect(inBounds(25, 25, 30, "(]")).toBe(false);
  });

  it("BMI: national category primary, international alternative second", () => {
    const r = cat("BMI", 31.7);
    expect(r.primary).toMatchObject({ thresholdId: "test-bmi-cn", label_zh: "肥胖(测试)", level: "national_cn", levelZh: "国家标准" });
    expect(r.primary?.source?.id).toBe("test-national");
    expect(r.alternatives.map((a) => [a.thresholdId, a.label_zh, a.alternativeOf])).toEqual([["test-bmi-intl", "超重(国际测试)", "test-bmi-cn"]]);
    expect(cat("BMI", 25).primary?.label_zh).toBe("超重(测试)");
    expect(cat("BMI", 24.99).primary?.label_zh).toBe("正常(测试)");
  });

  it("an alternative leads only when its base threshold does not apply", () => {
    const onlyIntl = categorize("BMI", 27, {}, { data: FIXTURES.filter((t) => t.id !== "test-bmi-cn"), sources: SOURCES });
    expect(onlyIntl.primary?.thresholdId).toBe("test-bmi-intl");
  });

  it("waist: sex-specific populations", () => {
    expect(cat("WAIST", 95, { sex: "male" }).primary?.label_zh).toBe("正常(测试)");
    expect(cat("WAIST", 95, { sex: "female" }).primary?.label_zh).toBe("腹型肥胖(测试)");
    expect(cat("WAIST", 95, {}).primary).toBeNull();
  });

  it("blood pressure: SBP and DBP combined, the higher category wins; CN guideline beats international", () => {
    const r = cat("SBP", 128, {}, { DBP: 102 });
    expect(r.primary).toMatchObject({ thresholdId: "test-bp", label_zh: "二级(测试)", decidedBy: ["DBP"] });
    expect(r.alternatives[0]).toMatchObject({ thresholdId: "test-bp-intl", label_zh: "高(国际测试)" });
    expect(cat("DBP", 70, {}, { SBP: 165 }).primary?.label_zh).toBe("二级(测试)");
    expect(cat("SBP", 120, {}, { DBP: 70 }).primary?.label_zh).toBe("正常(测试)");
    // Without the sibling, only the code's own bound is used.
    expect(cat("SBP", 135).primary?.label_zh).toBe("一级(测试)");
  });

  it("age-specific national threshold takes precedence for older members", () => {
    expect(cat("SBP", 145, { age: 70 }, { DBP: 80 }).primary?.thresholdId).toBe("test-age60");
    expect(cat("SBP", 145, { age: 40 }, { DBP: 80 }).primary?.thresholdId).toBe("test-bp");
  });

  it("FPG / HbA1c / TG severe / UA / LDL with informational target", () => {
    expect(cat("GLU", 7.5).primary?.label_zh).toBe("诊断切点(测试)");
    expect(cat("GLU", 6.2).primary?.label_zh).toBe("受损(测试)");
    expect(cat("HBA1C", 7).primary?.label_zh).toBe("达诊断切点(测试)");
    expect(cat("TG", 6).primary).toMatchObject({ label_zh: "重度升高(测试)", severity: "severe" });
    expect(cat("UA", 450).primary?.label_zh).toBe("正常(测试)");
    expect(cat("UA", 451).primary?.label_zh).toBe("高尿酸(测试)");
    const ldl = cat("LDL_C", 3.2);
    expect(ldl.primary?.label_zh).toBe("合适(测试)");
    expect(ldl.targets.map((t) => t.label_zh)).toEqual(["高于低危目标(测试)"]);
  });

  it("T-score, baPWV/ABI (both sides), eGFR categories", () => {
    expect(cat("BMD_T", -3).primary?.label_zh).toBe("骨质疏松(测试)");
    expect(cat("BMD_T", -2).primary?.label_zh).toBe("骨量减少(测试)");
    expect(cat("BMD_T", -1).primary?.label_zh).toBe("骨量减少(测试)");
    expect(cat("BMD_T", 0).primary?.label_zh).toBe("正常(测试)");
    expect(cat("BAPWV_R", 1600).primary?.label_zh).toBe("增高(测试)");
    expect(cat("BAPWV_L", 1400).primary?.label_zh).toBe("正常(测试)");
    expect(cat("ABI_L", 0.8).primary?.label_zh).toBe("降低(测试)");
    expect(cat("ABI_R", 1.6).primary?.label_zh).toBe("过高(测试)");
    expect(cat("EGFR", 95).primary?.label_zh).toBe("G1(测试)");
    expect(cat("EGFR", 35).primary).toMatchObject({ label_zh: "G3(测试)", severity: "moderate" });
  });

  it("returns nothing for unknown codes and missing values", () => {
    expect(cat("ALT", 40).primary).toBeNull();
    expect(categorize("BMI", null).primary).toBeNull();
    expect(categorize("NOPE", 1).primary).toBeNull();
  });
});

describe("real thresholds (verified research)", () => {
  const who = { sex: "male" as const, age: 33 };
  it("BMI: national standard first, 肥胖症分级 second", () => {
    const c = categorize("BMI", 31.7, who);
    expect(c.primary).toMatchObject({ thresholdId: "bmi_cn", label_zh: "肥胖", level: "national_cn" });
    expect(c.alternatives.map((h) => [h.thresholdId, h.label_zh])).toContainEqual(["bmi_obesity_grade_cn", "轻度肥胖症"]);
    expect(categorize("BMI", 23.9, who).primary?.label_zh).toBe("体重正常");
    expect(categorize("BMI", 24, who).primary?.label_zh).toBe("超重");
  });
  it("blood pressure: the higher of SBP / DBP grades wins", () => {
    expect(categorize("SBP", 135, who, { siblings: { DBP: 92 } }).primary?.label_zh).toBe("1级高血压(轻度)");
    expect(categorize("SBP", 118, who, { siblings: { DBP: 78 } }).primary?.label_zh).toBe("正常血压");
    expect(categorize("DBP", 85, who, { siblings: { SBP: 118 } }).primary?.label_zh).toBe("正常高值");
    expect(categorize("SBP", 182, who, { siblings: { DBP: 95 } }).primary?.label_zh).toBe("3级高血压(重度)");
  });
  it("lipids: one band per value, HDL-C 降低, TG shows the 5.6 line second", () => {
    expect(categorize("LDL_C", 2.0, who).primary?.label_zh).toBe("理想水平");
    expect(categorize("LDL_C", 3.0, who).primary?.label_zh).toBe("合适水平");
    expect(categorize("LDL_C", 3.4, who).primary?.label_zh).toBe("边缘升高");
    expect(categorize("HDL_C", 0.72, who).primary?.label_zh).toBe("降低");
    expect(categorize("HDL_C", 1.2, who).primary?.severity).toBe("normal");
    const tg = categorize("TG", 7.33, who);
    expect(tg.primary).toMatchObject({ thresholdId: "thr_tg_primary_low_risk", label_zh: "升高" });
    expect(tg.alternatives.map((h) => h.thresholdId)).toContain("thr_tg_severe_pancreatitis");
    expect(categorize("TG", 5.6, who).alternatives.map((h) => h.thresholdId)).not.toContain("thr_tg_severe_pancreatitis");
    expect(categorize("TC", 6.91, who).primary?.label_zh).toBe("升高");
  });
  it("glucose, HbA1c, waist and uric acid", () => {
    expect(categorize("GLU", 6.5, who).primary?.label_zh).toBe("空腹血糖受损（IFG）");
    expect(categorize("HBA1C", 5.6, who).primary?.label_zh).toBe("未达糖尿病诊断切点");
    expect(categorize("WAIST", 88, who).primary?.label_zh).toBe("中心型肥胖前期");
    expect(categorize("WAIST", 88, { sex: "female", age: 33 }).primary?.label_zh).toBe("中心型肥胖");
    expect(categorize("UA", 430, who).primary?.severity).not.toBe("normal");
  });
  it("condition-specific thresholds (高血压患者, 痛风患者 …) never apply automatically", () => {
    expect(categorize("BAPWV_L", 1900, who).primary).toBeNull();
    const abi = categorize("ABI_L", 0.85, who);
    expect(abi.primary?.thresholdId).toBe("abi_pad_htn2024");
    expect([abi.primary, ...abi.alternatives].map((h) => h?.thresholdId)).not.toContain("abi_tod_htn2024");
    expect(categorize("UA", 400, who).targets).toEqual([]);
    expect(categorize("LDL_C", 3.0, who).targets).toEqual([]);
  });
});
