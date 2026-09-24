/**
 * Deterministic red-flag checks, independent of any LLM output.
 *
 * Two levels:
 * - `urgent`: 建议尽快就医 — values in (or near) laboratory critical ranges,
 *   or markedly elevated tumor markers. Drives the prominent banner.
 * - `soon`: 建议近期专科就诊 — clearly abnormal values that deserve a doctor
 *   visit in the coming weeks rather than routine follow-up.
 *
 * Thresholds follow common Chinese laboratory critical-value lists and
 * guideline cut-offs; they are deliberately conservative. All values are in
 * the indicator's canonical unit.
 */
import { getIndicator } from "./indicators.js";
import { parseSeverity, type ParsedSeverity } from "./findings.js";
import type { Sex } from "./types.js";

export type AlertLevel = "urgent" | "soon";

interface Rule {
  code: string;
  op: ">=" | "<=" | ">" | "<";
  threshold: number;
  level: AlertLevel;
  message: string;
  sex?: Sex;
}

const R = (code: string, op: Rule["op"], threshold: number, level: AlertLevel, message: string, sex?: Sex): Rule => ({
  code, op, threshold, level, message, sex,
});

export const CRITICAL_RULES: Rule[] = [
  // 血糖
  R("GLU", ">=", 16.7, "urgent", "空腹血糖极高（≥16.7 mmol/L），可能出现高血糖急症，请尽快就医。"),
  R("GLU", "<=", 2.8, "urgent", "血糖过低（≤2.8 mmol/L），存在低血糖风险，请尽快就医。"),
  R("GLU", ">=", 7.0, "soon", "空腹血糖达到糖尿病诊断阈值（≥7.0 mmol/L），建议内分泌科就诊确认。"),
  R("HBA1C", ">=", 9, "soon", "糖化血红蛋白明显升高（≥9%），近期血糖控制很差，建议尽快内分泌科就诊。"),
  R("GLU_2H", ">=", 16.7, "urgent", "餐后血糖极高（≥16.7 mmol/L），请尽快就医。"),
  // 电解质
  R("K", ">=", 6.0, "urgent", "血钾过高（≥6.0 mmol/L），可能引起严重心律失常，请尽快就医。"),
  R("K", "<=", 3.0, "urgent", "血钾过低（≤3.0 mmol/L），可能引起心律失常和乏力，请尽快就医。"),
  R("NA", ">=", 155, "urgent", "血钠过高（≥155 mmol/L），请尽快就医。"),
  R("NA", "<=", 125, "urgent", "血钠过低（≤125 mmol/L），请尽快就医。"),
  R("CA", ">=", 3.0, "urgent", "血钙过高（≥3.0 mmol/L），请尽快就医。"),
  R("CA", "<=", 1.75, "urgent", "血钙过低（≤1.75 mmol/L），请尽快就医。"),
  // 肾功能
  R("CREA", ">=", 442, "urgent", "肌酐明显升高（≥442 μmol/L），提示肾功能严重受损，请尽快肾内科就医。"),
  R("CREA", ">=", 177, "soon", "肌酐升高（≥177 μmol/L），建议近期肾内科就诊。"),
  R("EGFR", "<", 15, "urgent", "估算肾小球滤过率 <15，提示肾功能衰竭风险，请尽快肾内科就医。"),
  R("EGFR", "<", 30, "soon", "估算肾小球滤过率 <30，肾功能明显下降，建议近期肾内科就诊。"),
  R("UA", ">=", 540, "soon", "尿酸明显升高（≥540 μmol/L），建议风湿免疫科或内分泌科评估是否需要降尿酸治疗。"),
  // 肝功能
  R("ALT", ">=", 400, "urgent", "谷丙转氨酶明显升高（≥400 U/L），提示急性肝损伤可能，请尽快就医。"),
  R("ALT", ">=", 150, "soon", "谷丙转氨酶升高超过 3 倍上限，建议近期消化科/肝病科就诊。"),
  R("AST", ">=", 400, "urgent", "谷草转氨酶明显升高（≥400 U/L），请尽快就医。"),
  R("AST", ">=", 120, "soon", "谷草转氨酶升高超过 3 倍上限，建议近期就医。"),
  R("TBIL", ">=", 171, "urgent", "总胆红素明显升高（≥171 μmol/L），请尽快就医。"),
  R("TBIL", ">=", 60, "soon", "总胆红素升高约 3 倍，建议近期消化科就诊。"),
  // 血常规
  R("HGB", "<", 60, "urgent", "血红蛋白过低（<60 g/L），重度贫血，请尽快就医。"),
  R("HGB", "<", 90, "soon", "血红蛋白偏低（<90 g/L），中度贫血，建议近期血液科就诊。"),
  R("HGB", ">", 200, "urgent", "血红蛋白过高（>200 g/L），请尽快就医。"),
  R("PLT", "<", 30, "urgent", "血小板过低（<30×10⁹/L），有出血风险，请尽快就医。"),
  R("PLT", "<", 50, "soon", "血小板偏低（<50×10⁹/L），建议近期血液科就诊。"),
  R("PLT", ">", 1000, "urgent", "血小板过高（>1000×10⁹/L），请尽快就医。"),
  R("WBC", "<", 2.0, "urgent", "白细胞过低（<2.0×10⁹/L），感染风险增加，请尽快就医。"),
  R("WBC", ">", 30, "urgent", "白细胞过高（>30×10⁹/L），请尽快就医。"),
  R("NEUT", "<", 0.5, "urgent", "中性粒细胞过低（<0.5×10⁹/L），请尽快就医。"),
  // 血脂
  R("TG", ">=", 11.3, "urgent", "甘油三酯极高（≥11.3 mmol/L），急性胰腺炎风险高，请尽快就医。"),
  R("TG", ">=", 5.6, "soon", "甘油三酯明显升高（≥5.6 mmol/L），建议近期内分泌科/心内科就诊。"),
  R("LDL_C", ">=", 4.9, "soon", "低密度脂蛋白胆固醇很高（≥4.9 mmol/L），需排查家族性高胆固醇血症，建议心内科就诊。"),
  // 血压
  R("SBP", ">=", 180, "urgent", "收缩压 ≥180 mmHg，属于重度升高，请尽快就医。"),
  R("DBP", ">=", 110, "urgent", "舒张压 ≥110 mmHg，属于重度升高，请尽快就医。"),
  R("SBP", ">=", 160, "soon", "收缩压 ≥160 mmHg，建议近期心内科就诊。"),
  R("DBP", ">=", 100, "soon", "舒张压 ≥100 mmHg，建议近期心内科就诊。"),
  // 心脏
  R("CTNI", ">", 0.1, "urgent", "肌钙蛋白升高，提示心肌损伤可能，请立即就医。"),
  R("NT_PROBNP", ">=", 1800, "urgent", "NT-proBNP 明显升高，提示心功能不全可能，请尽快就医。"),
  R("NT_PROBNP", ">=", 450, "soon", "NT-proBNP 升高，建议近期心内科就诊。"),
  R("INR", ">=", 4, "urgent", "INR ≥4，出血风险高，请尽快就医。"),
  // 甲状腺
  R("TSH", ">=", 10, "soon", "促甲状腺激素明显升高（≥10），提示甲状腺功能减退，建议内分泌科就诊。"),
  R("TSH", "<", 0.1, "soon", "促甲状腺激素明显降低（<0.1），提示甲亢可能，建议内分泌科就诊。"),
  // 肿瘤标志物：明显升高才提示，轻度升高交给常规复查
  R("AFP", ">=", 400, "urgent", "甲胎蛋白明显升高（≥400 ng/mL），请尽快肝病科/肝胆外科就医。"),
  R("AFP", ">=", 20, "soon", "甲胎蛋白升高（≥20 ng/mL），建议近期肝病科就诊并复查。"),
  R("CEA", ">=", 20, "urgent", "癌胚抗原明显升高（≥20 ng/mL），请尽快就医进一步检查。"),
  R("CEA", ">=", 10, "soon", "癌胚抗原升高（≥10 ng/mL），建议近期就医复查。"),
  R("CA199", ">=", 185, "urgent", "CA19-9 明显升高（≥5 倍上限），请尽快就医进一步检查。"),
  R("CA199", ">=", 74, "soon", "CA19-9 升高（≥2 倍上限），建议近期消化科就诊复查。"),
  R("CA125", ">=", 175, "urgent", "CA125 明显升高（≥5 倍上限），请尽快妇科就医。", "female"),
  R("CA125", ">=", 70, "soon", "CA125 升高（≥2 倍上限），建议近期妇科就诊复查。", "female"),
  R("CA153", ">=", 125, "urgent", "CA15-3 明显升高（≥5 倍上限），请尽快就医。", "female"),
  R("CA153", ">=", 50, "soon", "CA15-3 升高（≥2 倍上限），建议近期乳腺外科就诊复查。", "female"),
  R("CA724", ">=", 35, "urgent", "CA72-4 明显升高（≥5 倍上限），请尽快就医。"),
  R("CA724", ">=", 14, "soon", "CA72-4 升高（≥2 倍上限），建议近期消化科就诊复查。"),
  R("CYFRA211", ">=", 16.5, "urgent", "CYFRA21-1 明显升高（≥5 倍上限），请尽快就医。"),
  R("CYFRA211", ">=", 6.6, "soon", "CYFRA21-1 升高（≥2 倍上限），建议近期呼吸科就诊复查。"),
  R("NSE", ">=", 81.5, "urgent", "NSE 明显升高（≥5 倍上限），请尽快就医。"),
  R("NSE", ">=", 32.6, "soon", "NSE 升高（≥2 倍上限），建议近期复查（注意排除溶血）。"),
  R("SCC", ">=", 7.5, "urgent", "SCC 明显升高（≥5 倍上限），请尽快就医。"),
  R("SCC", ">=", 3, "soon", "SCC 升高（≥2 倍上限），建议近期复查。"),
  R("PROGRP", ">=", 325, "urgent", "ProGRP 明显升高（≥5 倍上限），请尽快就医。"),
  R("PROGRP", ">=", 130, "soon", "ProGRP 升高（≥2 倍上限），建议近期呼吸科就诊复查。"),
  R("TPSA", ">=", 20, "urgent", "总 PSA 明显升高（≥20 ng/mL），请尽快泌尿外科就医。", "male"),
  R("TPSA", ">=", 10, "soon", "总 PSA 升高（≥10 ng/mL），建议近期泌尿外科就诊。", "male"),
  // 骨密度
  R("BMD_T", "<=", -2.5, "soon", "骨密度 T 值 ≤-2.5，达到骨质疏松标准，建议骨科/内分泌科就诊。"),
];

export interface CriticalAlert {
  code: string;
  name: string;
  level: AlertLevel;
  value: number;
  unit: string;
  message: string;
}

function hit(rule: Rule, value: number): boolean {
  switch (rule.op) {
    case ">=": return value >= rule.threshold;
    case "<=": return value <= rule.threshold;
    case ">": return value > rule.threshold;
    case "<": return value < rule.threshold;
  }
}

export interface CheckableValue {
  code: string | null | undefined;
  /** Canonical-unit numeric value. */
  value: number | null | undefined;
}

/**
 * Evaluate red-flag rules. At most one alert per indicator code: the most
 * severe matching rule wins (urgent before soon; rules are ordered so the
 * stricter threshold comes first within a level).
 */
export function checkCritical(values: CheckableValue[], ctx: { sex?: Sex | null } = {}): CriticalAlert[] {
  const byCode = new Map<string, CriticalAlert>();
  for (const v of values) {
    if (!v.code || v.value == null || !Number.isFinite(v.value)) continue;
    const def = getIndicator(v.code);
    for (const rule of CRITICAL_RULES) {
      if (rule.code !== v.code) continue;
      if (rule.sex && ctx.sex && rule.sex !== ctx.sex) continue;
      if (!hit(rule, v.value)) continue;
      const existing = byCode.get(v.code);
      if (existing && (existing.level === "urgent" || rule.level === "soon")) continue;
      byCode.set(v.code, {
        code: v.code,
        name: def?.zh ?? v.code,
        level: rule.level,
        value: v.value,
        unit: def?.unit ?? "",
        message: rule.message,
      });
    }
  }
  return [...byCode.values()].sort((a, b) => (a.level === b.level ? 0 : a.level === "urgent" ? -1 : 1));
}

export interface FindingAlert {
  findingKey: string;
  level: AlertLevel;
  message: string;
}

/**
 * Red flags for imaging findings: TI-RADS / BI-RADS ≥4, lung nodules ≥8mm or
 * ground-glass, gallbladder polyps ≥10mm.
 */
export function checkFindingRedFlags(finding: { findingKey?: string | null; severity?: string | null; rawText: string }): FindingAlert | null {
  const sev: ParsedSeverity = parseSeverity(`${finding.severity ?? ""} ${finding.rawText}`);
  const key = finding.findingKey ?? "";
  if (sev.birads != null && sev.birads >= 4) {
    return { findingKey: key || "breast_nodule", level: sev.birads >= 5 ? "urgent" : "soon", message: `乳腺 BI-RADS ${sev.birads} 类，建议尽快到乳腺外科就诊评估。` };
  }
  if (sev.tirads != null && sev.tirads >= 4) {
    return { findingKey: key || "thyroid_nodule", level: sev.tirads >= 5 ? "urgent" : "soon", message: `甲状腺结节 TI-RADS ${sev.tirads} 类，建议到甲状腺外科/内分泌科就诊评估。` };
  }
  if (key === "lung_nodule") {
    if (/磨玻璃|GGO|混杂/i.test(finding.rawText) || (sev.sizeMm != null && sev.sizeMm >= 8)) {
      return { findingKey: key, level: "soon", message: "肺结节需要专科随访（≥8mm 或含磨玻璃成分），建议到胸外科/呼吸科就诊。" };
    }
  }
  if (key === "gallbladder_polyp" && sev.sizeMm != null && sev.sizeMm >= 10) {
    return { findingKey: key, level: "soon", message: "胆囊息肉 ≥10mm，建议到肝胆外科就诊评估。" };
  }
  return null;
}
