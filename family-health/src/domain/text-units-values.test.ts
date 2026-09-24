import { describe, expect, it } from "vitest";
import { getIndicator } from "./indicators.js";
import { nameCandidates, normalizeKey, normalizeWidth } from "./text.js";
import { fromCanonical, normalizeUnit, toCanonical } from "./units.js";
import { isQualitativeText, normalizeQualitative, parseResultValue, splitBloodPressure } from "./values.js";

const def = (code: string) => {
  const d = getIndicator(code);
  if (!d) throw new Error(`missing ${code}`);
  return d;
};

describe("text normalization", () => {
  it("folds full-width characters, micro sign and dashes", () => {
    expect(normalizeWidth("（ＴＧ）＜５．２")).toBe("(TG)<5.2");
    expect(normalizeWidth("µmol/L")).toBe("μmol/L");
    expect(normalizeWidth("3.9—6.1")).toBe("3.9-6.1");
    expect(normalizeWidth("≤40")).toBe("<=40");
  });

  it("builds case/space/punctuation-insensitive keys but keeps % and #", () => {
    expect(normalizeKey("甘油三酯（TG）")).toBe("甘油三酯tg");
    expect(normalizeKey("CA19-9")).toBe(normalizeKey("ca 199"));
    expect(normalizeKey("HDL-C")).toBe("hdlc");
    expect(normalizeKey("NEUT%")).not.toBe(normalizeKey("NEUT#"));
    expect(normalizeKey("★ALT")).toBe("alt");
  });

  it("splits bracketed and bilingual names into candidates", () => {
    expect(nameCandidates("甘油三酯(TG)")).toEqual(expect.arrayContaining(["甘油三酯(TG)", "甘油三酯", "TG"]));
    expect(nameCandidates("TG/甘油三酯")).toEqual(expect.arrayContaining(["TG", "甘油三酯"]));
    expect(nameCandidates("ALT 谷丙转氨酶")).toEqual(expect.arrayContaining(["ALT", "谷丙转氨酶"]));
    expect(nameCandidates("血清总胆固醇测定")).toContain("总胆固醇");
  });
});

describe("unit normalization", () => {
  it.each([
    ["umol/L", "μmol/L"],
    ["µmol/l", "μmol/L"],
    ["微摩尔/升", "μmol/L"],
    ["MMOL/L", "mmol/L"],
    ["mg/dl", "mg/dL"],
    ["10*9/L", "10^9/L"],
    ["×10⁹/L", "10^9/L"],
    ["G/L", "10^9/L"],
    ["g/l", "g/L"],
    ["x10^12/L", "10^12/L"],
    ["IU/L", "U/L"],
    ["uIU/mL", "μIU/mL"],
    ["kg/m2", "kg/m²"],
    ["bpm", "次/分"],
    ["mg/L FEU", "mg/L"],
    ["ｍｍＨｇ", "mmHg"],
    ["", ""],
  ])("normalizes %s → %s", (raw, expected) => {
    expect(normalizeUnit(raw)).toBe(expected);
  });

  it("keeps unknown units readable", () => {
    expect(normalizeUnit(" S/CO ")).toBe("S/CO");
  });
});

describe("unit conversion", () => {
  it("converts glucose mg/dL → mmol/L", () => {
    const r = toCanonical(100, "mg/dL", def("GLU"));
    expect(r.status).toBe("converted");
    expect(r.value).toBeCloseTo(5.55, 2);
    expect(r.unit).toBe("mmol/L");
  });

  it("converts lipids with their own factors", () => {
    expect(toCanonical(200, "mg/dL", def("TC")).value).toBeCloseTo(5.17, 2);
    expect(toCanonical(150, "mg/dL", def("TG")).value).toBeCloseTo(1.69, 2);
    expect(toCanonical(40, "mg/dl", def("HDL_C")).value).toBeCloseTo(1.03, 2);
  });

  it("converts uric acid and creatinine to μmol/L", () => {
    expect(toCanonical(7, "mg/dL", def("UA")).value).toBeCloseTo(416.4, 1);
    expect(toCanonical(1.0, "mg/dL", def("CREA")).value).toBeCloseTo(88.4, 1);
  });

  it("supports affine conversions (HbA1c mmol/mol → %)", () => {
    expect(toCanonical(48, "mmol/mol", def("HBA1C")).value).toBeCloseTo(6.54, 1);
    expect(fromCanonical(6.5, "mmol/mol", def("HBA1C"))).toBeCloseTo(47.5, 0);
  });

  it("treats equivalent spellings as the same unit", () => {
    expect(toCanonical(2.1, "μIU/mL", def("TSH")).status).toBe("same");
    expect(toCanonical(12, "mU/L", def("INS")).status).toBe("same");
    expect(toCanonical(3, "μg/L", def("CEA")).status).toBe("same");
    expect(toCanonical(20, "kU/L", def("CA199")).status).toBe("same");
  });

  it("assumes the canonical unit when none is printed", () => {
    expect(toCanonical(5.6, "", def("GLU"))).toEqual({ value: 5.6, unit: "mmol/L", status: "assumed" });
  });

  it("reports incompatible units instead of guessing", () => {
    expect(toCanonical(5, "g/L", def("GLU")).status).toBe("incompatible");
  });

  it("converts weight in 斤 for chat-logged values", () => {
    expect(toCanonical(150, "斤", def("WEIGHT")).value).toBe(75);
  });
});

describe("result value parsing", () => {
  it("parses numbers with report markers", () => {
    expect(parseResultValue("6.8↑")).toMatchObject({ num: 6.8, marker: "H" });
    expect(parseResultValue("↓0.92")).toMatchObject({ num: 0.92, marker: "L" });
    expect(parseResultValue("2.35 H")).toMatchObject({ num: 2.35, marker: "H" });
    expect(parseResultValue("2.35H")).toMatchObject({ num: 2.35, marker: "H" });
    expect(parseResultValue("3.1 L")).toMatchObject({ num: 3.1, marker: "L" });
    expect(parseResultValue("5.2*")).toMatchObject({ num: 5.2, marker: "abnormal" });
    expect(parseResultValue("５．６")).toMatchObject({ num: 5.6, marker: null });
    expect(parseResultValue("1,234")).toMatchObject({ num: 1234 });
    expect(parseResultValue("-1.8")).toMatchObject({ num: -1.8, qualitative: null });
  });

  it("parses censored values", () => {
    expect(parseResultValue("<0.5")).toMatchObject({ num: 0.5, censor: "<" });
    expect(parseResultValue("＞1000")).toMatchObject({ num: 1000, censor: ">" });
  });

  it("parses qualitative results with grades", () => {
    expect(parseResultValue("阴性(-)")).toMatchObject({ qualitative: "阴性", num: null });
    expect(parseResultValue("-")).toMatchObject({ qualitative: "阴性" });
    expect(parseResultValue("阳性(++)")).toMatchObject({ qualitative: "阳性", grade: 2 });
    expect(parseResultValue("+")).toMatchObject({ qualitative: "阳性", grade: 1 });
    expect(parseResultValue("2+")).toMatchObject({ qualitative: "阳性", grade: 2 });
    expect(parseResultValue("±")).toMatchObject({ qualitative: "弱阳性" });
    expect(parseResultValue("未检出")).toMatchObject({ qualitative: "阴性" });
    expect(parseResultValue("正常")).toMatchObject({ qualitative: "正常" });
    expect(normalizeQualitative("NEG")?.text).toBe("阴性");
  });

  it("tells qualitative text from numbers", () => {
    expect(isQualitativeText("阴性")).toBe(true);
    expect(isQualitativeText("+")).toBe(true);
    expect(isQualitativeText("5.6")).toBe(false);
    expect(isQualitativeText("-1.2")).toBe(false);
  });

  it("handles empty input without throwing", () => {
    expect(parseResultValue(null)).toMatchObject({ num: null, qualitative: null });
    expect(parseResultValue("未做")).toMatchObject({ num: null, qualitative: null });
  });

  it("splits blood pressure readings", () => {
    expect(splitBloodPressure("128/82 mmHg")).toEqual({ sbp: 128, dbp: 82 });
    expect(splitBloodPressure("１４５／９５")).toEqual({ sbp: 145, dbp: 95 });
    expect(splitBloodPressure("82/128")).toBeNull();
  });
});
