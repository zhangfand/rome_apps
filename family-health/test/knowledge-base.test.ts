/**
 * The knowledge base under src/data/ must validate, SOURCES.md must be in
 * sync, and the collision guards must keep instrument names (ECG, echo, TCD,
 * QUS, 动脉硬化) away from lab analytes. Synthetic values only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDICATOR_DATA } from "../src/data/indicators.js";
import { IndicatorEntrySchema, validateKnowledgeBase, type IndicatorEntry, type KnowledgeBase, type Source } from "../src/data/schema.js";
import { renderSourcesMd } from "../src/data/sources-md.js";
import { LOINC_ATTRIBUTION, SOURCES } from "../src/data/sources.js";
import { THRESHOLDS } from "../src/data/thresholds.js";
import { criticalSourceIds } from "../src/domain/critical.js";
import { getIndicator } from "../src/domain/indicators.js";
import { ALLOWED_SHARED_ALIASES, isShortToken, mapIndicator } from "../src/domain/mapping.js";
import { normalizeKey } from "../src/domain/text.js";
import { isCompatibleUnit } from "../src/domain/units.js";

const unitCompatible = (unit: string, e: IndicatorEntry) => isCompatibleUnit(unit, getIndicator(e.code) ?? ({ ...e, explain: e.explain.text, ref: undefined } as never));
const opts = { normalizeKey, allowedShared: ALLOWED_SHARED_ALIASES, unitCompatible };
const real: KnowledgeBase = { sources: SOURCES, indicators: INDICATOR_DATA, thresholds: THRESHOLDS, criticalSourceIds: criticalSourceIds() };

describe("knowledge base validation", () => {
  it("the shipped data is valid", () => {
    expect(validateKnowledgeBase(real, opts)).toEqual([]);
  });

  it("has no numeric reference range, threshold or LOINC code without a verified source", () => {
    const unverified = new Set(SOURCES.filter((s) => s.level === "unverified").map((s) => s.id));
    for (const e of INDICATOR_DATA) {
      for (const r of e.ranges ?? []) if (r.low != null || r.high != null) expect(unverified.has(r.sourceId), `${e.code}/${r.id}`).toBe(false);
      if (e.loinc) expect(unverified.has(e.loinc.sourceId), e.code).toBe(false);
    }
    for (const t of THRESHOLDS) expect(unverified.has(t.sourceId), t.id).toBe(false);
  });

  const good: Source = { id: "test-ok", org: "TEST", title: "Synthetic", identifier: "TEST-1", scope: ["reference_range"], level: "national_cn", retrieved: "2026-01-01" };
  const base = IndicatorEntrySchema.parse(INDICATOR_DATA.find((e) => e.code === "GLU"));
  const kb = (patch: Partial<KnowledgeBase>): KnowledgeBase => ({ sources: [...SOURCES, good], indicators: [base], thresholds: [], ...patch });

  it("rejects numbers cited to an unverified source, and unverified ranges that carry numbers", () => {
    const withRange = (r: object) => kb({ indicators: [{ ...base, ranges: [{ id: "x", kind: "reference", level: "unverified", population: {}, unit: "mmol/L", sourceId: "legacy-unverified", ...r }] }] });
    expect(validateKnowledgeBase(withRange({ low: 1, high: 2 }), opts).join()).toMatch(/verified source/);
    expect(validateKnowledgeBase(withRange({ level: "national_cn", sourceId: "legacy-unverified", low: 1 }), opts).join()).toMatch(/verified source/);
    expect(validateKnowledgeBase(withRange({}), opts)).toEqual([]);
    expect(validateKnowledgeBase(withRange({ level: "national_cn", sourceId: "test-ok" }), opts).join()).toMatch(/without numbers must be level unverified/);
    expect(validateKnowledgeBase(withRange({ level: "national_cn", sourceId: "test-ok", low: 1, high: 2 }), opts)).toEqual([]);
    expect(validateKnowledgeBase(withRange({ level: "international", sourceId: "test-ok", low: 1 }), opts).join()).toMatch(/≠ source level/);
    expect(validateKnowledgeBase(withRange({ level: "national_cn", sourceId: "nope", low: 1 }), opts).join()).toMatch(/unknown sourceId nope/);
    expect(validateKnowledgeBase(withRange({ level: "national_cn", sourceId: "test-ok", low: 1, unit: "kg" }), opts).join()).toMatch(/not convertible/);
  });

  it("rejects LOINC codes cited to an unverified source", () => {
    const bad = kb({ indicators: [{ ...base, loinc: { code: "0000-0", longName: "Synthetic", sourceId: "legacy-unverified" } }] });
    expect(validateKnowledgeBase(bad, opts).join()).toMatch(/loinc cites an unverified source/);
  });

  it("rejects thresholds with numbers but no verified source, and unknown alternatives", () => {
    const t = (x: object) => kb({ thresholds: [{ id: "t", indicatorCodes: ["GLU"], name_zh: "测试", unit: "mmol/L", categories: [{ label_zh: "测试", low: 1, severity: "mild" }], sourceId: "test-ok", level: "national_cn", ...x }] });
    expect(validateKnowledgeBase(t({}), opts)).toEqual([]);
    expect(validateKnowledgeBase(t({ sourceId: "legacy-unverified", level: "unverified" }), opts).join()).toMatch(/numeric threshold must cite a verified source/);
    expect(validateKnowledgeBase(t({ alternativeOf: "missing" }), opts).join()).toMatch(/alternativeOf unknown/);
    expect(validateKnowledgeBase(t({ indicatorCodes: ["NOPE"] }), opts).join()).toMatch(/unknown indicator NOPE/);
  });

  it("rejects alias collisions that are not allow-listed", () => {
    const other = { ...base, code: "GLU_COPY", zh: "测试血糖副本", en: "Synthetic copy", aliases: ["空腹血糖"] };
    expect(validateKnowledgeBase(kb({ indicators: [base, other] }), opts).join()).toMatch(/alias "空腹血糖" shared by GLU, GLU_COPY/);
  });

  it("every critical-value rule points at an existing source", () => {
    for (const id of criticalSourceIds()) expect(SOURCES.some((s) => s.id === id), id).toBe(true);
  });

  it("SOURCES.md is in sync with src/data (run `pnpm sources:md`)", () => {
    const expected = renderSourcesMd({ sources: SOURCES, indicators: INDICATOR_DATA, thresholds: THRESHOLDS, loincAttribution: LOINC_ATTRIBUTION });
    const actual = readFileSync(join(import.meta.dirname, "..", "SOURCES.md"), "utf8");
    expect(actual).toBe(expected);
  });
});

describe("alias collision guards", () => {
  it("no alias of one indicator is a normalized alias of another, except the allow-list", () => {
    const owners = new Map<string, Set<string>>();
    for (const e of INDICATOR_DATA) {
      for (const a of [e.code, e.zh, e.en, ...e.aliases]) {
        const k = normalizeKey(a);
        if (!owners.has(k)) owners.set(k, new Set());
        owners.get(k)!.add(e.code);
      }
    }
    const allowed = new Map(ALLOWED_SHARED_ALIASES.map((a) => [a.key, new Set(a.codes)]));
    for (const [k, set] of owners) {
      if (set.size < 2) continue;
      expect(allowed.has(k), `unexpected shared alias ${k}: ${[...set]}`).toBe(true);
      for (const c of set) expect(allowed.get(k)!.has(c), `${k} → ${c}`).toBe(true);
    }
  });

  it("recognises short tokens", () => {
    for (const k of ["p", "k", "ca", "na", "cl", "mg", "t3", "t4", "tt", "pt", "hr", "rv5"]) expect(isShortToken(k), k).toBe(true);
    for (const k of ["p电轴", "ggt", "hdlc", "ca199", "甘油三酯"]) expect(isShortToken(k), k).toBe(k === "ggt");
  });

  // [raw name, section, expected code or null]
  const TABLE: Array<[string, string | null, string | null]> = [
    // 心电图: never 血磷 P / 甲功 T3 …
    ["P电轴", "心电图", "ECG_P_AXIS"],
    ["P电轴", null, "ECG_P_AXIS"],
    ["P轴", null, "ECG_P_AXIS"],
    ["P波", "心电图", null],
    ["P波", null, null],
    ["P波时限", "心电图", null],
    ["P-R间期", "心电图", "ECG_PR"],
    ["PR间期", null, "ECG_PR"],
    ["QRS电轴", "心电图", "ECG_QRS_AXIS"],
    ["T电轴", "心电图", "ECG_T_AXIS"],
    ["T波", "心电图", null],
    ["T波", null, null],
    ["QT间期", "心电图", "ECG_QT"],
    ["QTC间期", "心电图", "ECG_QTC"],
    ["RV5", "心电图", "ECG_RV5"],
    ["SV1", "心电图", "ECG_SV1"],
    ["心率", "心电图", "HR"],
    ["K", "心电图", null],
    ["P", "心电图", null],
    ["T3", "心电图", null],
    // 心脏彩超
    ["左房内径(LA)", "心脏彩超", "ECHO_LA"],
    ["LA", "心脏彩超", "ECHO_LA"],
    ["AO", "心脏彩超", "ECHO_AO"],
    ["LVEF", "心脏彩超", "ECHO_LVEF"],
    ["EF", "心脏彩超", "ECHO_LVEF"],
    ["FS", "心脏彩超", "ECHO_FS"],
    ["室间隔厚度(IVS)", "心脏彩超", "ECHO_IVS"],
    ["CA", "心脏彩超", null],
    // 经颅多普勒
    ["左侧大脑中动脉 PI", "超声经颅多普勒", "TCD_MCA_PI_L"],
    ["右侧大脑中动脉 Vm", "超声经颅多普勒", "TCD_MCA_VM_R"],
    ["左侧大脑中动脉 S/D", "超声经颅多普勒", "TCD_MCA_SD_L"],
    ["左侧大脑中动脉 深度(mm)", "超声经颅多普勒", "TCD_MCA_DEPTH_L"],
    ["PI", "超声经颅多普勒", null],
    ["PT", "超声经颅多普勒", null],
    // 超声骨密度 vs 双能X线骨密度
    ["T值", "超声骨密度检测", "QUS_T"],
    ["Z值", "超声骨密度检测", "QUS_Z"],
    ["SOS", "超声骨密度检测", "QUS_SOS"],
    ["BUA", "超声骨密度检测", "QUS_BUA"],
    ["骨质指数", "超声骨密度检测", "QUS_INDEX"],
    ["T值", "骨密度", "BMD_T"],
    // 动脉硬化
    ["血管硬化度(baPWV) 右", "动脉硬化检查", "BAPWV_R"],
    ["baPWV左", null, "BAPWV_L"],
    ["血管阻塞度(ABI) 左", "动脉硬化检查", "ABI_L"],
    ["上臂收缩压 右", "动脉硬化检查", "ARM_SBP_R"],
    ["脚踝舒张压 左", "动脉硬化检查", "ANKLE_DBP_L"],
    ["脉搏", "动脉硬化检查", "HR"],
    ["血管年龄", "动脉硬化检查", "VASCULAR_AGE"],
    ["NA", "动脉硬化检查", null],
    // 检验：short codes still work as whole, corroborated tokens
    ["P", "电解质", "P"],
    ["磷", null, "P"],
    ["血清磷 P", "生化", "P"],
    ["钾 K", "电解质", "K"],
    ["K", null, "K"],
    ["Ca 钙", null, "CA"],
    ["TT", "凝血", "TT"],
    ["PT", "凝血", "PT"],
    ["TT3(总三碘甲状腺原氨酸)", "甲状腺功能", "T3"],
    ["T3", null, "T3"],
    ["血清磷酸肌酸激酶", "生化", "CK"],
    ["磷酸肌酸激酶", null, "CK"],
    ["肌酸激酶(CK)", "生化", "CK"],
    ["LA", "生化", null],
    ["EF", "生化", null],
    ["13C呼气试验Hp检验结果", "13C呼气试验Hp", "HP_C13_QUAL"],
    ["DOB值", "13C呼气试验Hp", "HP_C13"],
    ["血清α-羟丁酸脱氢酶", "生化", "HBDH"],
    ["血清γ-谷氨酰基转移酶", "生化-肝功", "GGT"],
    ["胆红素", "尿常规", "U_BIL"],
    ["胆红素", "肝功能", "TBIL"],
    ["戴镜视力右", "眼科", "VA_CORRECTED_R"],
  ];

  it.each(TABLE)("%s (%s) → %s", (name, section, expected) => {
    expect(mapIndicator(name, { section })?.code ?? null).toBe(expected);
  });

  it("P电轴-style names never map to a lab analyte, whatever the section", () => {
    const labCats = new Set(["general", "blood_routine", "urine", "liver", "kidney", "uric_acid", "lipid", "glucose", "thyroid", "tumor", "bone", "coag", "electrolyte", "cardio", "vitamin", "infection", "digestive"]);
    const letters = ["P", "K", "T", "U", "Q", "R", "S", "CA", "NA", "CL", "MG", "T3", "T4", "TT", "PT", "HR"];
    const suffixes = ["电轴", "波", "波时限", "间期", "时限", "轴", " axis", "波电压", "内径", "流速"];
    for (const l of letters) {
      for (const suf of suffixes) {
        for (const section of [null, "心电图", "生化", "电解质"]) {
          const hit = mapIndicator(`${l}${suf}`, { section });
          const cat = hit ? getIndicator(hit.code)!.category : null;
          expect(cat && labCats.has(cat), `${l}${suf} @${section} → ${hit?.code}`).toBeFalsy();
        }
      }
    }
  });
});
