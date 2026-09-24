import { describe, expect, it } from "vitest";
import { normalizeRow } from "./normalize.js";

describe("normalizeRow", () => {
  it("maps, converts and flags a typical lipid row", () => {
    const r = normalizeRow({ rawName: "甘油三酯(TG)", rawValue: "2.35↑", rawUnit: "mmol/L", refText: "0.45-1.70" });
    expect(r).toMatchObject({
      indicatorCode: "TG",
      valueNum: 2.35,
      unit: "mmol/L",
      unitStatus: "same",
      refLow: 0.45,
      refHigh: 1.7,
      flag: "H",
    });
  });

  it("converts value and printed range together", () => {
    const r = normalizeRow({ rawName: "葡萄糖", rawValue: "108", rawUnit: "mg/dL", refText: "70-110" });
    expect(r.indicatorCode).toBe("GLU");
    expect(r.unitStatus).toBe("converted");
    expect(r.valueNum).toBeCloseTo(5.99, 2);
    expect(r.refLow).toBeCloseTo(3.885, 3);
    expect(r.refHigh).toBeCloseTo(6.105, 3);
    expect(r.flag).toBe("normal");
  });

  it("handles qualitative urine rows", () => {
    const r = normalizeRow({ rawName: "尿蛋白", rawValue: "阳性(+)", refText: "阴性", section: "尿常规" });
    expect(r).toMatchObject({ indicatorCode: "U_PRO", valueText: "阳性", valueNum: null, flag: "abnormal" });
  });

  it("uses the dictionary range for the member's sex when none is printed", () => {
    expect(normalizeRow({ rawName: "谷丙转氨酶", rawValue: "45", rawUnit: "U/L" }, { sex: "female" }).flag).toBe("H");
    expect(normalizeRow({ rawName: "谷丙转氨酶", rawValue: "45", rawUnit: "U/L" }, { sex: "male" }).flag).toBe("normal");
  });

  it("reads arrows printed in a separate column", () => {
    expect(normalizeRow({ rawName: "HDL-C", rawValue: "0.92", rawUnit: "mmol/L", arrow: "↓" }).flag).toBe("L");
  });

  it("keeps unmapped rows with their raw number", () => {
    const r = normalizeRow({ rawName: "心理量表评分", rawValue: "12" });
    expect(r).toMatchObject({ indicatorCode: null, match: null, valueNum: 12, flag: null });
  });

  it("does not trend values whose unit cannot be converted", () => {
    const r = normalizeRow({ rawName: "GLU", rawValue: "5", rawUnit: "g/L" });
    expect(r).toMatchObject({ indicatorCode: "GLU", unitStatus: "incompatible", valueNum: null, unit: "g/L" });
  });

  it("honours a forced code from review or LLM fallback", () => {
    expect(normalizeRow({ rawName: "胆固醇总量(酶法)", rawValue: "5.5", indicatorCode: "TC" })).toMatchObject({
      indicatorCode: "TC",
      match: "forced",
      flag: "H",
    });
  });

  it("uses sex-specific printed ranges", () => {
    const row = { rawName: "尿酸", rawValue: "400", rawUnit: "μmol/L", refText: "男 208-428 女 155-357" };
    expect(normalizeRow(row, { sex: "male" }).flag).toBe("normal");
    expect(normalizeRow(row, { sex: "female" }).flag).toBe("H");
  });
});
