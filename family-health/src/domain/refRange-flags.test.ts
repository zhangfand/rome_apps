import { describe, expect, it } from "vitest";
import { computeFlag, isConcerning } from "./flags.js";
import { defaultRange, getIndicator } from "./indicators.js";
import { formatRange, parseRefRange } from "./refRange.js";
import { parseResultValue } from "./values.js";

const def = (code: string) => getIndicator(code)!;

describe("reference range parsing", () => {
  it.each([
    ["3.9-6.1", { low: 3.9, high: 6.1 }],
    ["3.9～6.1", { low: 3.9, high: 6.1 }],
    ["3.9~6.1 mmol/L", { low: 3.9, high: 6.1 }],
    ["3.9 至 6.1", { low: 3.9, high: 6.1 }],
    ["0.00--5.00", { low: 0, high: 5 }],
    ["-1.0~1.0", { low: -1, high: 1 }],
    ["1.003-1.030", { low: 1.003, high: 1.03 }],
    ["3.9—6.1", { low: 3.9, high: 6.1 }],
  ])("parses interval %s", (text, expected) => {
    expect(parseRefRange(text)).toMatchObject({ ...expected, lowInclusive: true, highInclusive: true });
  });

  it("parses one-sided bounds with inclusivity", () => {
    expect(parseRefRange("<5.2")).toMatchObject({ high: 5.2, highInclusive: false });
    expect(parseRefRange("<5.2")?.low).toBeUndefined();
    expect(parseRefRange("＜5.2")).toMatchObject({ high: 5.2, highInclusive: false });
    expect(parseRefRange("≤40")).toMatchObject({ high: 40, highInclusive: true });
    expect(parseRefRange(">1.04")).toMatchObject({ low: 1.04, lowInclusive: false });
    expect(parseRefRange("≥1.04")).toMatchObject({ low: 1.04, lowInclusive: true });
    expect(parseRefRange("小于5.2")).toMatchObject({ high: 5.2 });
    expect(parseRefRange(">-1.0")).toMatchObject({ low: -1 });
  });

  it("parses qualitative expectations", () => {
    expect(parseRefRange("阴性")).toMatchObject({ qualitative: "阴性" });
    expect(parseRefRange("阴性(-)")).toMatchObject({ qualitative: "阴性" });
    expect(parseRefRange("(-)")).toMatchObject({ qualitative: "阴性" });
    expect(parseRefRange("正常")).toMatchObject({ qualitative: "正常" });
  });

  it("parses sex-specific ranges and picks by sex", () => {
    const text = "男:9-50 女:7-40";
    expect(parseRefRange(text, "male")).toMatchObject({ low: 9, high: 50 });
    expect(parseRefRange(text, "female")).toMatchObject({ low: 7, high: 40 });
    expect(parseRefRange(text)).toMatchObject({ low: 7, high: 50, bySex: { male: { low: 9 }, female: { high: 40 } } });
    expect(parseRefRange("男性 130-175；女性 115-150", "female")).toMatchObject({ low: 115, high: 150 });
    expect(parseRefRange("M 208-428 F 155-357", "male")).toMatchObject({ low: 208, high: 428 });
  });

  it("does not mistake units for sex markers", () => {
    expect(parseRefRange("82-100 fL")).toMatchObject({ low: 82, high: 100 });
    expect(parseRefRange("3.5-5.3 mmol/L")).toMatchObject({ low: 3.5, high: 5.3 });
  });

  it("returns null for unusable text", () => {
    expect(parseRefRange("")).toBeNull();
    expect(parseRefRange("见报告")).toBeNull();
    expect(parseRefRange("6.1-3.9")).toBeNull();
  });

  it("formats ranges for display", () => {
    expect(formatRange({ low: 3.9, high: 6.1 })).toBe("3.9–6.1");
    expect(formatRange({ high: 5.2, highInclusive: false })).toBe("<5.2");
    expect(formatRange({ low: 1.04 })).toBe("≥1.04");
  });
});

describe("flag computation", () => {
  it("respects report arrows first, even against the range", () => {
    const flag = computeFlag({ value: parseResultValue("5.0↑"), reportRange: parseRefRange("3.9-6.1"), def: def("GLU") });
    expect(flag).toBe("H");
  });

  it("computes H / L / normal from the printed range", () => {
    const range = parseRefRange("3.9-6.1");
    expect(computeFlag({ value: parseResultValue("6.8"), reportRange: range, def: def("GLU") })).toBe("H");
    expect(computeFlag({ value: parseResultValue("3.5"), reportRange: range, def: def("GLU") })).toBe("L");
    expect(computeFlag({ value: parseResultValue("6.1"), reportRange: range, def: def("GLU") })).toBe("normal");
  });

  it("treats `<x` as exclusive", () => {
    const range = parseRefRange("<5.2");
    expect(computeFlag({ value: parseResultValue("5.2"), reportRange: range, def: def("TC") })).toBe("H");
    expect(computeFlag({ value: parseResultValue("5.19"), reportRange: range, def: def("TC") })).toBe("normal");
  });

  it("falls back to the sex-specific dictionary range", () => {
    expect(computeFlag({ value: parseResultValue("45"), def: def("ALT"), sex: "female" })).toBe("H");
    expect(computeFlag({ value: parseResultValue("45"), def: def("ALT"), sex: "male" })).toBe("normal");
    // Unknown sex uses the union of both ranges.
    expect(computeFlag({ value: parseResultValue("45"), def: def("ALT") })).toBe("normal");
    expect(defaultRange(def("UA"))).toMatchObject({ low: 155, high: 428 });
  });

  it("handles censored values", () => {
    expect(computeFlag({ value: parseResultValue("<0.5"), reportRange: parseRefRange("<5"), def: def("CEA") })).toBe("normal");
    expect(computeFlag({ value: parseResultValue(">1000"), reportRange: parseRefRange("<7"), def: def("AFP") })).toBe("H");
  });

  it("flags qualitative positives as abnormal and negatives as normal", () => {
    expect(computeFlag({ value: parseResultValue("阳性(+)"), reportRange: parseRefRange("阴性"), def: def("U_PRO") })).toBe("abnormal");
    expect(computeFlag({ value: parseResultValue("阴性"), reportRange: parseRefRange("阴性"), def: def("U_PRO") })).toBe("normal");
    expect(computeFlag({ value: parseResultValue("弱阳性"), def: def("U_URO") })).toBe("normal");
    expect(computeFlag({ value: parseResultValue("阳性"), def: def("HBSAB") })).toBe("normal");
    expect(computeFlag({ value: parseResultValue("阴性"), def: def("HP_C13") })).toBe("normal");
  });

  it("keeps a bare abnormal marker when there is no range", () => {
    expect(computeFlag({ value: parseResultValue("12*") })).toBe("abnormal");
    expect(computeFlag({ value: parseResultValue("12") })).toBeNull();
  });

  it("does not flag informational indicators without a printed range", () => {
    expect(computeFlag({ value: parseResultValue("178"), def: def("HEIGHT") })).toBeNull();
  });

  it("reads concern through the indicator's direction", () => {
    expect(isConcerning("H", def("HDL_C"))).toBe(false);
    expect(isConcerning("L", def("HDL_C"))).toBe(true);
    expect(isConcerning("H", def("TG"))).toBe(true);
    expect(isConcerning("L", def("ALT"))).toBe(false);
    expect(isConcerning("abnormal", def("U_PRO"))).toBe(true);
    expect(isConcerning("normal", def("TG"))).toBe(false);
  });
});
