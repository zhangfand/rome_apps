import { describe, expect, it } from "vitest";
import { CATEGORIES, INDICATORS, defaultRange } from "./indicators.js";
import { ambiguousAliasKeys, mapIndicator, searchIndicators, sectionCategory } from "./mapping.js";
import { normalizeUnit, toCanonical } from "./units.js";

describe("indicator dictionary integrity", () => {
  it("has ~150 indicators with unique codes", () => {
    expect(INDICATORS.length).toBeGreaterThanOrEqual(150);
    const codes = INDICATORS.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("covers every required category", () => {
    const cats = new Set(INDICATORS.map((d) => d.category));
    for (const c of CATEGORIES) expect(cats.has(c.key)).toBe(true);
  });

  it("gives every indicator a Chinese name, explanation and aliases", () => {
    for (const d of INDICATORS) {
      expect(d.zh, d.code).toMatch(/[一-鿿]/);
      expect(d.explain.length, d.code).toBeGreaterThan(8);
      expect(d.aliases.length, d.code).toBeGreaterThan(0);
    }
  });

  it("has sane default ranges", () => {
    for (const d of INDICATORS) {
      for (const sex of ["male", "female"] as const) {
        const r = defaultRange(d, sex);
        if (r?.low != null && r?.high != null) expect(r.low, d.code).toBeLessThan(r.high);
      }
    }
  });

  it("declares conversions whose units normalize and differ from the canonical unit", () => {
    for (const d of INDICATORS) {
      for (const c of d.conversions ?? []) {
        expect(normalizeUnit(c.unit), `${d.code} ${c.unit}`).not.toBe(normalizeUnit(d.unit));
        expect(toCanonical(1, c.unit, d).status, `${d.code} ${c.unit}`).toBe("converted");
      }
    }
  });

  it("only shares aliases where specimen/unit disambiguation is intended", () => {
    const allowed = new Set([
      "glu", "葡萄糖", "wbc", "白细胞", "rbc", "红细胞", "尿白细胞",
      "中性粒细胞", "淋巴细胞", "单核细胞", "嗜酸性粒细胞", "嗜碱性粒细胞",
      "红细胞分布宽度", "红细胞体积分布宽度",
    ]);
    const unexpected = ambiguousAliasKeys().filter((a) => !allowed.has(a.key));
    expect(unexpected).toEqual([]);
  });
});

describe("alias mapping", () => {
  it.each([
    ["甘油三酯", "TG"],
    ["三酰甘油", "TG"],
    ["TG", "TG"],
    ["甘油三酯(TG)", "TG"],
    ["甘油三酯（ＴＧ）", "TG"],
    ["  tg ", "TG"],
    ["总胆固醇 TC", "TC"],
    ["高密度脂蛋白胆固醇(HDL-C)", "HDL_C"],
    ["HDL-C", "HDL_C"],
    ["低密度脂蛋白", "LDL_C"],
    ["谷丙转氨酶(ALT)", "ALT"],
    ["丙氨酸氨基转移酶", "ALT"],
    ["γ-谷氨酰转肽酶", "GGT"],
    ["r-GT", "GGT"],
    ["糖类抗原19-9", "CA199"],
    ["CA 19-9", "CA199"],
    ["CA19-9", "CA199"],
    ["细胞角蛋白19片段(CYFRA21-1)", "CYFRA211"],
    ["空腹血糖(GLU)", "GLU"],
    ["糖化血红蛋白(HbA1c)", "HBA1C"],
    ["尿酸 UA", "UA"],
    ["血清尿酸", "UA"],
    ["肌酐(酶法)", "CREA"],
    ["血肌酐", "CREA"],
    ["估算肾小球滤过率(eGFR)", "EGFR"],
    ["促甲状腺激素(TSH)", "TSH"],
    ["25-羟维生素D", "VITD"],
    ["25(OH)D", "VITD"],
    ["脂蛋白(a)", "LPA"],
    ["Lp(a)", "LPA"],
    ["同型半胱氨酸", "HCY"],
    ["超敏C反应蛋白(hs-CRP)", "HSCRP"],
    ["C13呼气试验", "HP_C13"],
    ["骨密度T值", "BMD_T"],
    ["T值", "BMD_T"],
    ["血红蛋白(HGB)", "HGB"],
    ["胃蛋白酶原Ⅰ", "PGI"],
    ["胃蛋白酶原Ⅱ", "PGII"],
    ["收缩压", "SBP"],
    ["腰围", "WAIST"],
    ["NEUT%", "NEUT_PCT"],
    ["NEUT#", "NEUT"],
    ["★ALT", "ALT"],
    ["TG/甘油三酯", "TG"],
  ])("%s → %s", (raw, code) => {
    expect(mapIndicator(raw)?.code).toBe(code);
  });

  it("disambiguates blood vs urine glucose by value and section", () => {
    expect(mapIndicator("葡萄糖", { value: "5.6", unit: "mmol/L" })?.code).toBe("GLU");
    expect(mapIndicator("葡萄糖", { value: "阴性" })?.code).toBe("U_GLU");
    expect(mapIndicator("GLU", { section: "尿常规", value: "-" })?.code).toBe("U_GLU");
    expect(mapIndicator("GLU", { section: "生化全套", value: "6.2" })?.code).toBe("GLU");
  });

  it("disambiguates counts vs percentages by unit", () => {
    expect(mapIndicator("中性粒细胞", { unit: "%", value: "62.1" })?.code).toBe("NEUT_PCT");
    expect(mapIndicator("中性粒细胞", { unit: "10^9/L", value: "3.4" })?.code).toBe("NEUT");
    expect(mapIndicator("红细胞分布宽度", { unit: "fL", value: "42" })?.code).toBe("RDW_SD");
  });

  it("disambiguates blood vs urine white cells", () => {
    expect(mapIndicator("白细胞", { unit: "10*9/L", value: "6.2" })?.code).toBe("WBC");
    expect(mapIndicator("白细胞", { section: "尿常规", value: "阴性" })?.code).toBe("U_WBC");
    expect(mapIndicator("白细胞", { section: "尿常规", unit: "/μL", value: "12" })?.code).toBe("U_WBC_MICRO");
    expect(mapIndicator("WBC", { value: "6.1" })?.code).toBe("WBC");
  });

  it("marks unresolved ambiguity", () => {
    const hit = mapIndicator("中性粒细胞");
    expect(hit?.kind).toBe("ambiguous");
    expect(hit?.alternatives?.length).toBeGreaterThan(0);
  });

  it("returns null for unknown names", () => {
    expect(mapIndicator("心理量表评分")).toBeNull();
    expect(mapIndicator("")).toBeNull();
  });

  it("maps report section headings to categories", () => {
    expect(sectionCategory("尿常规检查")).toBe("urine");
    expect(sectionCategory("血脂四项")).toBe("lipid");
    expect(sectionCategory("生化")).toBeUndefined();
  });

  it("searches the dictionary for the reviewer dropdown", () => {
    expect(searchIndicators("胆固醇").map((d) => d.code)).toEqual(expect.arrayContaining(["TC", "HDL_C", "LDL_C"]));
    expect(searchIndicators("alt")[0].code).toBe("ALT");
  });
});
