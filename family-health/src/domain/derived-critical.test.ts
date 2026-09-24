import { describe, expect, it } from "vitest";
import { checkCritical, checkFindingRedFlags } from "./critical.js";
import { ageAt, agRatio, bmi, computeDerived, egfrCkdEpi2021, globulin, homaIr, nonHdl } from "./derived.js";

describe("age", () => {
  it("counts whole years at a date", () => {
    expect(ageAt("1985-06-15", "2025-06-14")).toBe(39);
    expect(ageAt("1985-06-15", "2025-06-15")).toBe(40);
    expect(ageAt(null, "2025-01-01")).toBeNull();
    expect(ageAt("2030-01-01", "2025-01-01")).toBeNull();
  });
});

describe("eGFR (CKD-EPI 2021, race-free)", () => {
  it("matches published calculator values", () => {
    // Scr 1.0 mg/dL (88.4 μmol/L), male, 50 y → 92
    expect(egfrCkdEpi2021(88.4, 50, "male")).toBe(92);
    // Scr 0.8 mg/dL, female, 60 y → 84
    expect(egfrCkdEpi2021(0.8 * 88.4, 60, "female")).toBe(84);
    // Scr 110 μmol/L, male, 68 y → 63
    expect(egfrCkdEpi2021(110, 68, "male")).toBe(63);
  });

  it("uses the low-creatinine branch below κ", () => {
    const v = egfrCkdEpi2021(0.6 * 88.4, 70, "female")!;
    expect(v).toBeGreaterThanOrEqual(96);
    expect(v).toBeLessThanOrEqual(97);
  });

  it("rejects missing or invalid inputs", () => {
    expect(egfrCkdEpi2021(0, 50, "male")).toBeNull();
    expect(egfrCkdEpi2021(80, 12, "male")).toBeNull();
    expect(egfrCkdEpi2021(80, 50, "unknown" as never)).toBeNull();
  });
});

describe("simple derived metrics", () => {
  it("computes HOMA-IR", () => {
    expect(homaIr(5.6, 10)).toBe(2.49);
    expect(homaIr(0, 10)).toBeNull();
  });
  it("computes non-HDL cholesterol", () => {
    expect(nonHdl(5.9, 1.2)).toBe(4.7);
    expect(nonHdl(1.0, 1.2)).toBeNull();
  });
  it("computes globulin and A/G ratio", () => {
    expect(globulin(72, 45)).toBe(27);
    expect(agRatio(45, 27)).toBe(1.67);
  });
  it("computes BMI", () => {
    expect(bmi(80, 175)).toBe(26.1);
    expect(bmi(80, 0)).toBeNull();
  });
});

describe("computeDerived", () => {
  it("fills in missing derived indicators for one exam", () => {
    const out = computeDerived(
      { TP: 72, ALB: 45, TC: 5.9, HDL_C: 1.2, GLU: 5.6, INS: 10, CREA: 88.4, WEIGHT: 80 },
      { sex: "male", age: 50, heightCm: 175 },
    );
    const byCode = Object.fromEntries(out.map((d) => [d.code, d.value]));
    expect(byCode).toMatchObject({ GLB: 27, AG_RATIO: 1.67, NON_HDL_C: 4.7, HOMA_IR: 2.49, EGFR: 92, BMI: 26.1 });
  });

  it("never overwrites values the report printed", () => {
    const out = computeDerived({ ALB: 45, GLB: 27, AG_RATIO: 1.5, TC: 5, HDL_C: 1, NON_HDL_C: 3.9 });
    expect(out.map((d) => d.code)).not.toContain("AG_RATIO");
    expect(out.map((d) => d.code)).not.toContain("NON_HDL_C");
  });

  it("skips eGFR without age or sex", () => {
    expect(computeDerived({ CREA: 90 }, { sex: "male" }).map((d) => d.code)).not.toContain("EGFR");
  });
});

describe("critical values", () => {
  it("flags urgent glucose and electrolyte values", () => {
    const alerts = checkCritical([
      { code: "GLU", value: 17.2 },
      { code: "K", value: 6.3 },
      { code: "K", value: null },
    ]);
    expect(alerts.map((a) => [a.code, a.level])).toEqual([
      ["GLU", "urgent"],
      ["K", "urgent"],
    ]);
    expect(alerts[0].message).toContain("尽快就医");
  });

  it("uses the soon level for moderately abnormal values", () => {
    expect(checkCritical([{ code: "GLU", value: 7.2 }])[0]).toMatchObject({ level: "soon" });
    expect(checkCritical([{ code: "UA", value: 560 }])[0]).toMatchObject({ level: "soon" });
    expect(checkCritical([{ code: "GLU", value: 5.4 }])).toEqual([]);
  });

  it("flags markedly elevated tumor markers", () => {
    expect(checkCritical([{ code: "AFP", value: 520 }])[0].level).toBe("urgent");
    expect(checkCritical([{ code: "CEA", value: 12 }])[0].level).toBe("soon");
    expect(checkCritical([{ code: "CEA", value: 6 }])).toEqual([]);
  });

  it("respects sex-specific rules", () => {
    expect(checkCritical([{ code: "CA125", value: 80 }], { sex: "male" })).toEqual([]);
    expect(checkCritical([{ code: "CA125", value: 80 }], { sex: "female" })[0].level).toBe("soon");
    expect(checkCritical([{ code: "TPSA", value: 12 }], { sex: "male" })[0].level).toBe("soon");
  });

  it("returns at most one alert per code with the most severe level, urgent first", () => {
    const alerts = checkCritical([
      { code: "TG", value: 6.0 },
      { code: "CREA", value: 500 },
    ]);
    expect(alerts.map((a) => [a.code, a.level])).toEqual([
      ["CREA", "urgent"],
      ["TG", "soon"],
    ]);
  });

  it("flags imaging findings by category and size", () => {
    expect(checkFindingRedFlags({ findingKey: "breast_nodule", rawText: "左乳低回声结节，BI-RADS 4a类" })?.level).toBe("soon");
    expect(checkFindingRedFlags({ findingKey: "thyroid_nodule", rawText: "甲状腺结节 TI-RADS 5类" })?.level).toBe("urgent");
    expect(checkFindingRedFlags({ findingKey: "thyroid_nodule", rawText: "甲状腺结节 TI-RADS 3类" })).toBeNull();
    expect(checkFindingRedFlags({ findingKey: "lung_nodule", rawText: "右肺上叶实性结节 9mm" })?.level).toBe("soon");
    expect(checkFindingRedFlags({ findingKey: "lung_nodule", rawText: "左肺下叶磨玻璃结节 5mm" })?.level).toBe("soon");
    expect(checkFindingRedFlags({ findingKey: "lung_nodule", rawText: "右肺微小结节 3mm" })).toBeNull();
    expect(checkFindingRedFlags({ findingKey: "gallbladder_polyp", rawText: "胆囊息肉 1.2cm" })?.level).toBe("soon");
    expect(checkFindingRedFlags({ findingKey: "gallbladder_polyp", rawText: "胆囊息肉 5mm" })).toBeNull();
  });
});
