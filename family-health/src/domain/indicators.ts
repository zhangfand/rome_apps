/**
 * Canonical dictionary of common Chinese health-checkup indicators.
 *
 * Every lab value extracted from a report is mapped onto one of these codes so
 * values from different providers (美年 / 爱康 / 医院) line up on one trend
 * line. Reference ranges are typical adult ranges used by Chinese labs
 * (WS/T 404 etc.) and serve only as a fallback when a report does not print its
 * own range — a range printed on the report always wins.
 *
 * This list is the single source of truth: it is synced into the
 * `indicator_defs` table at startup (see db/repositories).
 */
import type { CategoryInfo, CategoryKey, IndicatorDef, NumericRange, SexRange } from "./types.js";

export const CATEGORIES: CategoryInfo[] = [
  { key: "general", zh: "一般检查", order: 1 },
  { key: "blood_routine", zh: "血常规", order: 2 },
  { key: "urine", zh: "尿常规", order: 3 },
  { key: "liver", zh: "肝功能", order: 4 },
  { key: "kidney", zh: "肾功能", order: 5 },
  { key: "uric_acid", zh: "尿酸", order: 6 },
  { key: "lipid", zh: "血脂", order: 7 },
  { key: "glucose", zh: "血糖", order: 8 },
  { key: "thyroid", zh: "甲状腺功能", order: 9 },
  { key: "tumor", zh: "肿瘤标志物", order: 10 },
  { key: "bone", zh: "骨密度/骨代谢", order: 11 },
  { key: "coag", zh: "凝血功能", order: 12 },
  { key: "electrolyte", zh: "电解质", order: 13 },
  { key: "cardio", zh: "心血管/炎症", order: 14 },
  { key: "vitamin", zh: "维生素/营养", order: 15 },
  { key: "infection", zh: "感染/免疫", order: 16 },
];

export const CATEGORY_ZH: Record<CategoryKey, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.zh]),
) as Record<CategoryKey, string>;

// ---- range helpers --------------------------------------------------------
const r = (low?: number, high?: number): NumericRange => ({ low, high });
/** `<x`: strictly below x is normal (x itself is flagged). */
const lt = (high: number): NumericRange => ({ high, highInclusive: false });
/** `>x`: strictly above x is normal. */
const gt = (low: number): NumericRange => ({ low, lowInclusive: false });
const mf = (male: NumericRange, female: NumericRange): SexRange => ({ male, female });

const MG_DL_CHOL = [{ unit: "mg/dL", factor: 0.02586 }];

type Def = IndicatorDef;

export const INDICATORS: Def[] = [
  // ======================= 一般检查 / 体成分 =======================
  {
    code: "HEIGHT", zh: "身高", en: "Height", category: "general", unit: "cm", valueType: "numeric",
    aliases: ["身高", "height", "身长"], conversions: [{ unit: "m", factor: 100 }],
    direction: "info", decimals: 1, explain: "身高本身不评价好坏，用于计算体重指数（BMI）。",
  },
  {
    code: "WEIGHT", zh: "体重", en: "Body weight", category: "general", unit: "kg", valueType: "numeric",
    aliases: ["体重", "weight", "bw"],
    conversions: [{ unit: "斤", factor: 0.5 }, { unit: "lb", factor: 0.4536 }, { unit: "g", factor: 0.001 }],
    direction: "info", decimals: 1, explain: "体重需要结合身高看，趋势比单次数值更有意义。",
  },
  {
    code: "BMI", zh: "体重指数", en: "Body mass index", category: "general", unit: "kg/m²", valueType: "numeric",
    aliases: ["体重指数", "体质指数", "身体质量指数", "bmi"], ref: r(18.5, 23.9), direction: "both", decimals: 1,
    explain: "体重(kg)÷身高(m)²。中国成人 18.5–23.9 为正常，24–27.9 为超重，≥28 为肥胖。",
  },
  {
    code: "WAIST", zh: "腰围", en: "Waist circumference", category: "general", unit: "cm", valueType: "numeric",
    aliases: ["腰围", "waist", "wc"], ref: mf(lt(90), lt(85)), direction: "higher_worse", decimals: 1,
    explain: "反映腹部（内脏）脂肪。男性 ≥90cm、女性 ≥85cm 属于中心性肥胖，代谢风险更高。",
  },
  {
    code: "HIP", zh: "臀围", en: "Hip circumference", category: "general", unit: "cm", valueType: "numeric",
    aliases: ["臀围", "hip"], direction: "info", decimals: 1, explain: "与腰围一起计算腰臀比。",
  },
  {
    code: "WHR", zh: "腰臀比", en: "Waist-to-hip ratio", category: "general", unit: "", valueType: "numeric",
    aliases: ["腰臀比", "腰臀围比", "whr"], ref: mf(lt(0.9), lt(0.85)), direction: "higher_worse", decimals: 2,
    explain: "腰围÷臀围。男性 ≥0.90、女性 ≥0.85 提示腹型肥胖。",
  },
  {
    code: "BODY_FAT", zh: "体脂率", en: "Body fat percentage", category: "general", unit: "%", valueType: "numeric",
    aliases: ["体脂率", "体脂百分比", "体脂肪率", "体脂", "pbf", "bf%"], ref: mf(r(10, 20), r(20, 30)),
    direction: "both", decimals: 1, explain: "脂肪占体重的比例。男性约 10–20%、女性约 20–30% 较理想。",
  },
  {
    code: "VISCERAL_FAT", zh: "内脏脂肪等级", en: "Visceral fat level", category: "general", unit: "", valueType: "numeric",
    aliases: ["内脏脂肪等级", "内脏脂肪指数", "内脏脂肪"], ref: r(1, 9), direction: "higher_worse", decimals: 0,
    explain: "体脂秤估算的内脏脂肪水平，≥10 提示内脏脂肪偏多。",
  },
  {
    code: "SBP", zh: "收缩压", en: "Systolic blood pressure", category: "general", unit: "mmHg", valueType: "numeric",
    aliases: ["收缩压", "高压", "sbp", "血压收缩压"], ref: r(90, 139), direction: "higher_worse", decimals: 0,
    explain: "心脏收缩时的血压。≥140 mmHg 属于高血压范围，130–139 为正常高值。",
  },
  {
    code: "DBP", zh: "舒张压", en: "Diastolic blood pressure", category: "general", unit: "mmHg", valueType: "numeric",
    aliases: ["舒张压", "低压", "dbp", "血压舒张压"], ref: r(60, 89), direction: "higher_worse", decimals: 0,
    explain: "心脏舒张时的血压。≥90 mmHg 属于高血压范围。",
  },
  {
    code: "HR", zh: "心率", en: "Heart rate", category: "general", unit: "次/分", valueType: "numeric",
    aliases: ["心率", "脉搏", "脉率", "hr", "pulse"], ref: r(60, 100), direction: "both", decimals: 0,
    explain: "静息心率一般 60–100 次/分；经常运动的人可以更低。",
  },

  // ======================= 血常规 =======================
  {
    code: "WBC", zh: "白细胞计数", en: "White blood cell count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["白细胞计数", "白细胞", "白细胞数", "wbc"], ref: r(3.5, 9.5), direction: "both", decimals: 2,
    explain: "免疫细胞总数。升高常见于感染、炎症；降低可能与病毒感染、药物或骨髓问题有关。",
  },
  {
    code: "NEUT_PCT", zh: "中性粒细胞百分比", en: "Neutrophil %", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["中性粒细胞百分比", "中性粒细胞比率", "中性粒细胞%", "中性细胞百分比", "neut%", "ne%", "gran%", "中性粒细胞"],
    ref: r(40, 75), direction: "both", decimals: 1, explain: "中性粒细胞占白细胞的比例，细菌感染时常升高。",
  },
  {
    code: "LYMPH_PCT", zh: "淋巴细胞百分比", en: "Lymphocyte %", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["淋巴细胞百分比", "淋巴细胞比率", "淋巴细胞%", "lymph%", "ly%", "lym%", "淋巴细胞"],
    ref: r(20, 50), direction: "both", decimals: 1, explain: "淋巴细胞占白细胞的比例，病毒感染时常升高。",
  },
  {
    code: "MONO_PCT", zh: "单核细胞百分比", en: "Monocyte %", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["单核细胞百分比", "单核细胞比率", "单核细胞%", "mono%", "mo%", "单核细胞"],
    ref: r(3, 10), direction: "both", decimals: 1, explain: "单核细胞占白细胞的比例。",
  },
  {
    code: "EO_PCT", zh: "嗜酸性粒细胞百分比", en: "Eosinophil %", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["嗜酸性粒细胞百分比", "嗜酸细胞百分比", "嗜酸性粒细胞%", "eo%", "eos%", "嗜酸性粒细胞"],
    ref: r(0.4, 8), direction: "higher_worse", decimals: 1, explain: "升高常见于过敏、寄生虫感染。",
  },
  {
    code: "BASO_PCT", zh: "嗜碱性粒细胞百分比", en: "Basophil %", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["嗜碱性粒细胞百分比", "嗜碱细胞百分比", "嗜碱性粒细胞%", "baso%", "ba%", "嗜碱性粒细胞"],
    ref: r(0, 1), direction: "higher_worse", decimals: 1, explain: "嗜碱性粒细胞占白细胞的比例，一般很低。",
  },
  {
    code: "NEUT", zh: "中性粒细胞绝对值", en: "Neutrophil count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["中性粒细胞绝对值", "中性粒细胞计数", "中性粒细胞数", "neut#", "ne#", "gran#", "中性粒细胞"],
    ref: r(1.8, 6.3), direction: "both", decimals: 2, explain: "中性粒细胞的实际数量，过低时抵抗细菌感染能力下降。",
  },
  {
    code: "LYMPH", zh: "淋巴细胞绝对值", en: "Lymphocyte count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["淋巴细胞绝对值", "淋巴细胞计数", "淋巴细胞数", "lymph#", "ly#", "lym#", "淋巴细胞"],
    ref: r(1.1, 3.2), direction: "both", decimals: 2, explain: "淋巴细胞的实际数量。",
  },
  {
    code: "MONO", zh: "单核细胞绝对值", en: "Monocyte count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["单核细胞绝对值", "单核细胞计数", "单核细胞数", "mono#", "mo#", "单核细胞"],
    ref: r(0.1, 0.6), direction: "both", decimals: 2, explain: "单核细胞的实际数量。",
  },
  {
    code: "EO", zh: "嗜酸性粒细胞绝对值", en: "Eosinophil count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["嗜酸性粒细胞绝对值", "嗜酸性粒细胞计数", "eo#", "eos#", "嗜酸性粒细胞"],
    ref: r(0.02, 0.52), direction: "higher_worse", decimals: 2, explain: "嗜酸性粒细胞的实际数量，过敏时可升高。",
  },
  {
    code: "BASO", zh: "嗜碱性粒细胞绝对值", en: "Basophil count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["嗜碱性粒细胞绝对值", "嗜碱性粒细胞计数", "baso#", "ba#", "嗜碱性粒细胞"],
    ref: r(0, 0.06), direction: "higher_worse", decimals: 2, explain: "嗜碱性粒细胞的实际数量。",
  },
  {
    code: "RBC", zh: "红细胞计数", en: "Red blood cell count", category: "blood_routine", unit: "10^12/L", valueType: "numeric",
    aliases: ["红细胞计数", "红细胞", "红细胞数", "rbc"], ref: mf(r(4.3, 5.8), r(3.8, 5.1)), direction: "both", decimals: 2,
    explain: "负责运输氧气的细胞数量，偏低常与贫血有关。",
  },
  {
    code: "HGB", zh: "血红蛋白", en: "Hemoglobin", category: "blood_routine", unit: "g/L", valueType: "numeric",
    aliases: ["血红蛋白", "血红蛋白浓度", "血色素", "hgb", "hb"], conversions: [{ unit: "g/dL", factor: 10 }],
    ref: mf(r(130, 175), r(115, 150)), direction: "both", decimals: 0,
    explain: "判断贫血最主要的指标。男性 <130、女性 <115 g/L 提示贫血。",
  },
  {
    code: "HCT", zh: "红细胞压积", en: "Hematocrit", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["红细胞压积", "红细胞比容", "血细胞比容", "hct", "pcv"], ref: mf(r(40, 50), r(35, 45)), direction: "both", decimals: 1,
    explain: "红细胞占血液体积的比例。",
  },
  {
    code: "MCV", zh: "平均红细胞体积", en: "Mean corpuscular volume", category: "blood_routine", unit: "fL", valueType: "numeric",
    aliases: ["平均红细胞体积", "mcv"], ref: r(82, 100), direction: "both", decimals: 1,
    explain: "红细胞的平均大小，可帮助区分缺铁性贫血（偏小）和维生素B12/叶酸缺乏（偏大）。",
  },
  {
    code: "MCH", zh: "平均红细胞血红蛋白量", en: "Mean corpuscular hemoglobin", category: "blood_routine", unit: "pg", valueType: "numeric",
    aliases: ["平均红细胞血红蛋白量", "平均红细胞血红蛋白含量", "mch"], ref: r(27, 34), direction: "both", decimals: 1,
    explain: "每个红细胞平均含有的血红蛋白量。",
  },
  {
    code: "MCHC", zh: "平均红细胞血红蛋白浓度", en: "Mean corpuscular hemoglobin concentration", category: "blood_routine", unit: "g/L", valueType: "numeric",
    aliases: ["平均红细胞血红蛋白浓度", "mchc"], conversions: [{ unit: "g/dL", factor: 10 }], ref: r(316, 354), direction: "both", decimals: 0,
    explain: "红细胞内血红蛋白的平均浓度。",
  },
  {
    code: "RDW_CV", zh: "红细胞分布宽度-CV", en: "RDW-CV", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["红细胞分布宽度cv", "红细胞体积分布宽度cv", "rdw-cv", "rdwcv", "rdw", "红细胞分布宽度", "红细胞体积分布宽度"],
    ref: r(11.5, 14.5), direction: "higher_worse", decimals: 1, explain: "红细胞大小的差异程度，升高常见于缺铁早期。",
  },
  {
    code: "RDW_SD", zh: "红细胞分布宽度-SD", en: "RDW-SD", category: "blood_routine", unit: "fL", valueType: "numeric",
    aliases: ["红细胞分布宽度sd", "红细胞体积分布宽度sd", "rdw-sd", "rdwsd", "红细胞分布宽度", "红细胞体积分布宽度"],
    ref: r(37, 54), direction: "higher_worse", decimals: 1, explain: "以体积表示的红细胞大小差异程度。",
  },
  {
    code: "PLT", zh: "血小板计数", en: "Platelet count", category: "blood_routine", unit: "10^9/L", valueType: "numeric",
    aliases: ["血小板计数", "血小板", "血小板数", "plt"], ref: r(125, 350), direction: "both", decimals: 0,
    explain: "参与止血的细胞。过低容易出血，过高需排查炎症或骨髓疾病。",
  },
  {
    code: "MPV", zh: "平均血小板体积", en: "Mean platelet volume", category: "blood_routine", unit: "fL", valueType: "numeric",
    aliases: ["平均血小板体积", "mpv"], ref: r(7.4, 12.5), direction: "both", decimals: 1, explain: "血小板的平均大小。",
  },
  {
    code: "PDW", zh: "血小板分布宽度", en: "Platelet distribution width", category: "blood_routine", unit: "fL", valueType: "numeric",
    aliases: ["血小板分布宽度", "血小板体积分布宽度", "pdw"], direction: "info", decimals: 1,
    explain: "血小板大小的差异程度，单独异常意义不大。",
  },
  {
    code: "PCT_PLT", zh: "血小板压积", en: "Plateletcrit", category: "blood_routine", unit: "%", valueType: "numeric",
    aliases: ["血小板压积", "血小板比容", "pct"], ref: r(0.108, 0.282), direction: "both", decimals: 3,
    explain: "血小板占血液体积的比例。",
  },
  {
    code: "ESR", zh: "红细胞沉降率", en: "Erythrocyte sedimentation rate", category: "blood_routine", unit: "mm/h", valueType: "numeric",
    aliases: ["红细胞沉降率", "血沉", "esr"], ref: mf(r(0, 15), r(0, 20)), direction: "higher_worse", decimals: 0,
    explain: "非特异性炎症指标，升高需结合症状判断。",
  },

  // ======================= 尿常规 =======================
  {
    code: "U_PRO", zh: "尿蛋白", en: "Urine protein", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿蛋白", "尿蛋白定性", "蛋白质尿", "蛋白质", "蛋白", "pro"], direction: "qualitative",
    explain: "正常为阴性。持续阳性可能提示肾脏损伤，需复查确认。",
  },
  {
    code: "U_GLU", zh: "尿糖", en: "Urine glucose", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿糖", "尿葡萄糖", "葡萄糖尿", "glu", "葡萄糖"], direction: "qualitative",
    explain: "正常为阴性。阳性多见于血糖明显升高，需查血糖。",
  },
  {
    code: "U_BLD", zh: "尿隐血", en: "Urine occult blood", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿隐血", "尿潜血", "隐血", "潜血", "bld", "ery"], direction: "qualitative",
    explain: "正常为阴性。阳性可见于泌尿系结石、炎症，女性经期也可出现。",
  },
  {
    code: "U_WBC", zh: "尿白细胞", en: "Urine leukocytes", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿白细胞", "白细胞酯酶", "白细胞尿", "leu", "wbc", "白细胞"], direction: "qualitative",
    explain: "正常为阴性。阳性常提示泌尿系感染。",
  },
  {
    code: "U_KET", zh: "尿酮体", en: "Urine ketones", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿酮体", "酮体", "ket"], direction: "qualitative", explain: "正常为阴性。空腹过久、节食或糖尿病控制差时可阳性。",
  },
  {
    code: "U_NIT", zh: "亚硝酸盐", en: "Urine nitrite", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["亚硝酸盐", "尿亚硝酸盐", "nit"], direction: "qualitative", explain: "正常为阴性。阳性提示可能有细菌性尿路感染。",
  },
  {
    code: "U_BIL", zh: "尿胆红素", en: "Urine bilirubin", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿胆红素", "胆红素尿", "bil"], direction: "qualitative", explain: "正常为阴性。阳性需排查肝胆疾病。",
  },
  {
    code: "U_URO", zh: "尿胆原", en: "Urobilinogen", category: "urine", unit: "", valueType: "qualitative",
    aliases: ["尿胆原", "uro", "ubg"], qualitativeNormal: ["阴性", "正常", "弱阳性"], direction: "qualitative",
    explain: "少量存在属正常（阴性/正常/弱阳性）。",
  },
  {
    code: "U_SG", zh: "尿比重", en: "Urine specific gravity", category: "urine", unit: "", valueType: "numeric",
    aliases: ["尿比重", "比重", "sg"], ref: r(1.003, 1.03), direction: "both", decimals: 3,
    explain: "反映尿液浓缩程度，喝水多少会影响。",
  },
  {
    code: "U_PH", zh: "尿酸碱度", en: "Urine pH", category: "urine", unit: "", valueType: "numeric",
    aliases: ["尿酸碱度", "酸碱度", "尿ph", "ph"], ref: r(4.5, 8), direction: "both", decimals: 1,
    explain: "尿液酸碱度，受饮食影响较大。",
  },
  {
    code: "U_RBC_MICRO", zh: "尿红细胞（镜检）", en: "Urine RBC (microscopy)", category: "urine", unit: "/μL", valueType: "numeric",
    aliases: ["尿红细胞", "镜检红细胞", "尿沉渣红细胞", "红细胞镜检", "rbc", "红细胞"], ref: r(0, 25), direction: "higher_worse", decimals: 0,
    explain: "显微镜下尿中的红细胞数量，升高需排查泌尿系统出血原因。",
  },
  {
    code: "U_WBC_MICRO", zh: "尿白细胞（镜检）", en: "Urine WBC (microscopy)", category: "urine", unit: "/μL", valueType: "numeric",
    aliases: ["尿白细胞", "镜检白细胞", "尿沉渣白细胞", "白细胞镜检", "wbc", "白细胞"], ref: r(0, 25), direction: "higher_worse", decimals: 0,
    explain: "显微镜下尿中的白细胞数量，升高常见于尿路感染。",
  },

  // ======================= 肝功能 =======================
  {
    code: "ALT", zh: "谷丙转氨酶", en: "Alanine aminotransferase", category: "liver", unit: "U/L", valueType: "numeric",
    aliases: ["谷丙转氨酶", "丙氨酸氨基转移酶", "丙氨酸转氨酶", "alt", "gpt", "sgpt"], ref: mf(r(9, 50), r(7, 40)), direction: "higher_worse", decimals: 0,
    explain: "最常用的肝细胞损伤指标。脂肪肝、饮酒、药物、肝炎都可能使其升高。",
  },
  {
    code: "AST", zh: "谷草转氨酶", en: "Aspartate aminotransferase", category: "liver", unit: "U/L", valueType: "numeric",
    aliases: ["谷草转氨酶", "天门冬氨酸氨基转移酶", "天冬氨酸氨基转移酶", "天门冬氨酸转氨酶", "ast", "got", "sgot"],
    ref: mf(r(15, 40), r(13, 35)), direction: "higher_worse", decimals: 0,
    explain: "存在于肝脏和肌肉中，剧烈运动后也可短暂升高。",
  },
  {
    code: "AST_ALT", zh: "谷草/谷丙比值", en: "AST/ALT ratio", category: "liver", unit: "", valueType: "numeric",
    aliases: ["谷草谷丙比值", "谷草/谷丙", "ast/alt", "astalt比值"], direction: "info", decimals: 2,
    explain: "AST 与 ALT 的比值，需结合两者数值一起看。",
  },
  {
    code: "GGT", zh: "γ-谷氨酰转移酶", en: "Gamma-glutamyl transferase", category: "liver", unit: "U/L", valueType: "numeric",
    aliases: ["γ-谷氨酰转移酶", "γ-谷氨酰转肽酶", "谷氨酰转肽酶", "谷氨酰转移酶", "转肽酶", "ggt", "γ-gt", "r-gt", "ggtp"],
    ref: mf(r(10, 60), r(7, 45)), direction: "higher_worse", decimals: 0,
    explain: "对饮酒、脂肪肝和胆道问题较敏感。",
  },
  {
    code: "ALP", zh: "碱性磷酸酶", en: "Alkaline phosphatase", category: "liver", unit: "U/L", valueType: "numeric",
    aliases: ["碱性磷酸酶", "alp", "akp"], ref: r(45, 125), direction: "higher_worse", decimals: 0,
    explain: "来自肝胆和骨骼，升高可见于胆道梗阻或骨代谢活跃。",
  },
  {
    code: "TBIL", zh: "总胆红素", en: "Total bilirubin", category: "liver", unit: "μmol/L", valueType: "numeric",
    aliases: ["总胆红素", "血清总胆红素", "tbil", "t-bil"], conversions: [{ unit: "mg/dL", factor: 17.1 }],
    ref: r(3.4, 20.5), direction: "higher_worse", decimals: 1,
    explain: "红细胞代谢产物，由肝脏处理。轻度升高常见于 Gilbert 综合征等良性情况。",
  },
  {
    code: "DBIL", zh: "直接胆红素", en: "Direct bilirubin", category: "liver", unit: "μmol/L", valueType: "numeric",
    aliases: ["直接胆红素", "结合胆红素", "dbil", "d-bil"], conversions: [{ unit: "mg/dL", factor: 17.1 }],
    ref: r(0, 6.8), direction: "higher_worse", decimals: 1, explain: "经肝脏处理后的胆红素，升高提示肝胆排泄问题。",
  },
  {
    code: "IBIL", zh: "间接胆红素", en: "Indirect bilirubin", category: "liver", unit: "μmol/L", valueType: "numeric",
    aliases: ["间接胆红素", "非结合胆红素", "ibil", "i-bil"], conversions: [{ unit: "mg/dL", factor: 17.1 }],
    ref: r(1.7, 13.7), direction: "higher_worse", decimals: 1, explain: "未经肝脏处理的胆红素，单独轻度升高多为良性。",
  },
  {
    code: "TP", zh: "总蛋白", en: "Total protein", category: "liver", unit: "g/L", valueType: "numeric",
    aliases: ["总蛋白", "血清总蛋白", "tp"], conversions: [{ unit: "g/dL", factor: 10 }], ref: r(65, 85), direction: "both", decimals: 1,
    explain: "白蛋白与球蛋白之和，反映营养和肝脏合成功能。",
  },
  {
    code: "ALB", zh: "白蛋白", en: "Albumin", category: "liver", unit: "g/L", valueType: "numeric",
    aliases: ["白蛋白", "血清白蛋白", "清蛋白", "alb"], conversions: [{ unit: "g/dL", factor: 10 }], ref: r(40, 55), direction: "lower_worse", decimals: 1,
    explain: "由肝脏合成，偏低提示营养不良或肝肾疾病。",
  },
  {
    code: "GLB", zh: "球蛋白", en: "Globulin", category: "liver", unit: "g/L", valueType: "numeric",
    aliases: ["球蛋白", "血清球蛋白", "glb", "glo"], conversions: [{ unit: "g/dL", factor: 10 }], ref: r(20, 40), direction: "both", decimals: 1,
    explain: "与免疫相关的蛋白，升高可见于慢性炎症。",
  },
  {
    code: "AG_RATIO", zh: "白球比", en: "Albumin/globulin ratio", category: "liver", unit: "", valueType: "numeric",
    aliases: ["白球比", "白球比值", "白蛋白/球蛋白", "白/球比值", "a/g", "a/g比值"], ref: r(1.2, 2.4), direction: "lower_worse", decimals: 2,
    explain: "白蛋白与球蛋白的比值，偏低需结合两者数值判断。",
  },
  {
    code: "TBA", zh: "总胆汁酸", en: "Total bile acid", category: "liver", unit: "μmol/L", valueType: "numeric",
    aliases: ["总胆汁酸", "tba"], ref: r(0, 10), direction: "higher_worse", decimals: 1, explain: "反映肝脏对胆汁酸的处理能力，餐后可轻度升高。",
  },
  {
    code: "PA", zh: "前白蛋白", en: "Prealbumin", category: "liver", unit: "mg/L", valueType: "numeric",
    aliases: ["前白蛋白", "血清前白蛋白", "pa", "pab"], conversions: [{ unit: "g/L", factor: 1000 }], ref: r(200, 400), direction: "lower_worse", decimals: 0,
    explain: "敏感的营养状态指标，偏低提示近期营养不足。",
  },
  {
    code: "CHE", zh: "胆碱酯酶", en: "Cholinesterase", category: "liver", unit: "U/L", valueType: "numeric",
    aliases: ["胆碱酯酶", "che"], ref: r(5000, 12000), direction: "lower_worse", decimals: 0, explain: "反映肝脏合成功能，脂肪肝时可偏高。",
  },
  {
    code: "ADA", zh: "腺苷脱氨酶", en: "Adenosine deaminase", category: "liver", unit: "U/L", valueType: "numeric",
    aliases: ["腺苷脱氨酶", "ada"], ref: r(4, 24), direction: "higher_worse", decimals: 0, explain: "肝脏及免疫相关酶，单独轻度升高意义有限。",
  },

  // ======================= 肾功能 =======================
  {
    code: "CREA", zh: "肌酐", en: "Creatinine", category: "kidney", unit: "μmol/L", valueType: "numeric",
    aliases: ["肌酐", "血肌酐", "血清肌酐", "crea", "cr", "scr", "cre"], conversions: [{ unit: "mg/dL", factor: 88.4 }],
    ref: mf(r(57, 111), r(41, 81)), direction: "higher_worse", decimals: 0,
    explain: "肌肉代谢产物，由肾脏排出。升高提示肾脏过滤能力可能下降，肌肉量大者可偏高。",
  },
  {
    code: "UREA", zh: "尿素", en: "Urea", category: "kidney", unit: "mmol/L", valueType: "numeric",
    aliases: ["尿素", "尿素氮", "血尿素氮", "bun", "urea"], conversions: [{ unit: "mg/dL", factor: 0.357 }],
    ref: mf(r(3.1, 8), r(2.6, 7.5)), direction: "both", decimals: 2,
    explain: "蛋白质代谢产物，受饮食蛋白量和饮水影响较大。",
  },
  {
    code: "UA", zh: "尿酸", en: "Uric acid", category: "uric_acid", unit: "μmol/L", valueType: "numeric",
    aliases: ["尿酸", "血尿酸", "血清尿酸", "ua", "uric"], conversions: [{ unit: "mg/dL", factor: 59.48 }],
    ref: mf(r(208, 428), r(155, 357)), direction: "higher_worse", decimals: 0,
    explain: "嘌呤代谢产物。长期偏高可能引起痛风、肾结石，与饮酒、高嘌呤饮食、肥胖有关。",
  },
  {
    code: "CYSC", zh: "胱抑素C", en: "Cystatin C", category: "kidney", unit: "mg/L", valueType: "numeric",
    aliases: ["胱抑素c", "胱抑素-c", "血清胱抑素c", "cys-c", "cysc"], ref: r(0.51, 1.09), direction: "higher_worse", decimals: 2,
    explain: "比肌酐更早反映肾功能变化，受肌肉量影响小，适合老年人。",
  },
  {
    code: "EGFR", zh: "估算肾小球滤过率", en: "eGFR", category: "kidney", unit: "mL/min/1.73m²", valueType: "numeric",
    aliases: ["估算肾小球滤过率", "估算的肾小球滤过率", "肾小球滤过率", "egfr", "gfr"], ref: { low: 90 }, direction: "lower_worse", decimals: 0,
    derived: true, explain: "根据肌酐、年龄、性别估算的肾脏过滤能力。≥90 正常，60–89 轻度下降，<60 需要关注。",
  },
  {
    code: "B2MG", zh: "β2-微球蛋白", en: "Beta-2 microglobulin", category: "kidney", unit: "mg/L", valueType: "numeric",
    aliases: ["β2-微球蛋白", "β2微球蛋白", "β2-mg", "b2-mg", "bmg"], ref: r(1, 3), direction: "higher_worse", decimals: 2,
    explain: "反映肾小球滤过功能，也与某些血液病有关。",
  },
  {
    code: "U_ACR", zh: "尿微量白蛋白/肌酐比", en: "Urine albumin-to-creatinine ratio", category: "kidney", unit: "mg/g", valueType: "numeric",
    aliases: ["尿微量白蛋白/肌酐", "尿白蛋白/肌酐比值", "尿微量白蛋白肌酐比", "尿微量白蛋白/肌酐比", "acr", "uacr", "malb/cr"],
    conversions: [{ unit: "mg/mmol", factor: 8.84 }], ref: lt(30), direction: "higher_worse", decimals: 1,
    explain: "早期发现糖尿病、高血压相关肾损伤的敏感指标，≥30 mg/g 提示白蛋白尿。",
  },
  {
    code: "U_MALB", zh: "尿微量白蛋白", en: "Urine microalbumin", category: "kidney", unit: "mg/L", valueType: "numeric",
    aliases: ["尿微量白蛋白", "微量白蛋白", "malb", "u-malb"], ref: lt(30), direction: "higher_worse", decimals: 1,
    explain: "尿中少量白蛋白，升高提示早期肾损伤，受饮水量影响。",
  },

  // ======================= 血脂 =======================
  {
    code: "TC", zh: "总胆固醇", en: "Total cholesterol", category: "lipid", unit: "mmol/L", valueType: "numeric",
    aliases: ["总胆固醇", "胆固醇", "血清总胆固醇", "tc", "chol", "t-cho", "tcho", "cholesterol"], conversions: MG_DL_CHOL,
    ref: lt(5.2), direction: "higher_worse", decimals: 2, explain: "血液中胆固醇的总量。<5.2 为合适水平，≥6.2 为升高。",
  },
  {
    code: "TG", zh: "甘油三酯", en: "Triglycerides", category: "lipid", unit: "mmol/L", valueType: "numeric",
    aliases: ["甘油三酯", "三酰甘油", "甘油三脂", "tg", "trig", "triglyceride", "triglycerides"],
    conversions: [{ unit: "mg/dL", factor: 0.01129 }], ref: lt(1.7), direction: "higher_worse", decimals: 2,
    explain: "血液中的脂肪，受饮食、饮酒和体重影响明显。≥5.6 时胰腺炎风险增加。",
  },
  {
    code: "HDL_C", zh: "高密度脂蛋白胆固醇", en: "HDL cholesterol", category: "lipid", unit: "mmol/L", valueType: "numeric",
    aliases: ["高密度脂蛋白胆固醇", "高密度脂蛋白", "高密度脂蛋白-胆固醇", "hdl-c", "hdl", "hdl-ch"], conversions: MG_DL_CHOL,
    ref: { low: 1.04 }, direction: "lower_worse", decimals: 2, explain: "“好胆固醇”，能把胆固醇运回肝脏，偏低不利于心血管。",
  },
  {
    code: "LDL_C", zh: "低密度脂蛋白胆固醇", en: "LDL cholesterol", category: "lipid", unit: "mmol/L", valueType: "numeric",
    aliases: ["低密度脂蛋白胆固醇", "低密度脂蛋白", "低密度脂蛋白-胆固醇", "ldl-c", "ldl", "ldl-ch"], conversions: MG_DL_CHOL,
    ref: lt(3.4), direction: "higher_worse", decimals: 2,
    explain: "“坏胆固醇”，是动脉粥样硬化的主要危险因素。有糖尿病或心血管病者目标值更低。",
  },
  {
    code: "NON_HDL_C", zh: "非高密度脂蛋白胆固醇", en: "Non-HDL cholesterol", category: "lipid", unit: "mmol/L", valueType: "numeric",
    aliases: ["非高密度脂蛋白胆固醇", "non-hdl-c", "nonhdl", "non-hdl"], conversions: MG_DL_CHOL, ref: lt(4.1),
    direction: "higher_worse", decimals: 2, derived: true, explain: "总胆固醇减去高密度脂蛋白胆固醇，代表所有“致动脉硬化”的胆固醇。",
  },
  {
    code: "APOA1", zh: "载脂蛋白A1", en: "Apolipoprotein A1", category: "lipid", unit: "g/L", valueType: "numeric",
    aliases: ["载脂蛋白a1", "载脂蛋白ai", "apoa1", "apo-a1", "apoai", "apoa-i"], ref: r(1, 1.6), direction: "lower_worse", decimals: 2,
    explain: "高密度脂蛋白的主要蛋白成分，偏低不利于心血管。",
  },
  {
    code: "APOB", zh: "载脂蛋白B", en: "Apolipoprotein B", category: "lipid", unit: "g/L", valueType: "numeric",
    aliases: ["载脂蛋白b", "apob", "apo-b", "apob100"], ref: r(0.6, 1.1), direction: "higher_worse", decimals: 2,
    explain: "致动脉硬化脂蛋白的颗粒数量指标，升高提示心血管风险增加。",
  },
  {
    code: "LPA", zh: "脂蛋白(a)", en: "Lipoprotein(a)", category: "lipid", unit: "mg/L", valueType: "numeric",
    aliases: ["脂蛋白(a)", "脂蛋白a", "脂蛋白小a", "lp(a)", "lpa"], conversions: [{ unit: "mg/dL", factor: 10 }],
    ref: lt(300), direction: "higher_worse", decimals: 0, explain: "主要由遗传决定，升高是独立的心血管危险因素，一生查一次即可大致了解。",
  },

  // ======================= 血糖 / 糖代谢 =======================
  {
    code: "GLU", zh: "空腹血糖", en: "Fasting plasma glucose", category: "glucose", unit: "mmol/L", valueType: "numeric",
    aliases: ["空腹血糖", "空腹血葡萄糖", "血糖", "血清葡萄糖", "葡萄糖空腹", "glu", "fpg", "fbg", "glucose", "葡萄糖"],
    conversions: [{ unit: "mg/dL", factor: 0.0555 }], ref: r(3.9, 6.1), direction: "higher_worse", decimals: 2,
    explain: "空腹 8 小时以上的血糖。6.1–6.9 为空腹血糖受损，≥7.0 需考虑糖尿病。",
  },
  {
    code: "GLU_2H", zh: "餐后2小时血糖", en: "2-hour postprandial glucose", category: "glucose", unit: "mmol/L", valueType: "numeric",
    aliases: ["餐后2小时血糖", "餐后两小时血糖", "餐后2h血糖", "2h血糖", "2hpg", "ogtt2h"], conversions: [{ unit: "mg/dL", factor: 0.0555 }],
    ref: lt(7.8), direction: "higher_worse", decimals: 2, explain: "7.8–11.0 为糖耐量异常，≥11.1 需考虑糖尿病。",
  },
  {
    code: "HBA1C", zh: "糖化血红蛋白", en: "HbA1c", category: "glucose", unit: "%", valueType: "numeric",
    aliases: ["糖化血红蛋白", "糖化血红蛋白a1c", "糖基化血红蛋白", "hba1c", "ghb"],
    conversions: [{ unit: "mmol/mol", factor: 0.09148, offset: 2.152 }], ref: r(4, 6), direction: "higher_worse", decimals: 1,
    explain: "反映近 2–3 个月的平均血糖水平。≥6.5% 可作为糖尿病诊断依据之一。",
  },
  {
    code: "GA", zh: "糖化白蛋白", en: "Glycated albumin", category: "glucose", unit: "%", valueType: "numeric",
    aliases: ["糖化白蛋白", "ga"], ref: r(11, 16), direction: "higher_worse", decimals: 1, explain: "反映近 2–3 周的平均血糖水平。",
  },
  {
    code: "INS", zh: "空腹胰岛素", en: "Fasting insulin", category: "glucose", unit: "μU/mL", valueType: "numeric",
    aliases: ["空腹胰岛素", "胰岛素", "ins", "fins", "insulin"], conversions: [{ unit: "pmol/L", factor: 1 / 6 }],
    ref: r(2.6, 24.9), direction: "higher_worse", decimals: 1, explain: "空腹胰岛素偏高常提示胰岛素抵抗，与腹型肥胖、脂肪肝相关。",
  },
  {
    code: "CPEP", zh: "C肽", en: "C-peptide", category: "glucose", unit: "ng/mL", valueType: "numeric",
    aliases: ["c肽", "c-肽", "空腹c肽", "c-p"], conversions: [{ unit: "nmol/L", factor: 3.02 }, { unit: "pmol/L", factor: 0.00302 }],
    ref: r(1.1, 4.4), direction: "both", decimals: 2, explain: "反映胰岛自身分泌胰岛素的能力。",
  },
  {
    code: "HOMA_IR", zh: "HOMA-IR 胰岛素抵抗指数", en: "HOMA-IR", category: "glucose", unit: "", valueType: "numeric",
    aliases: ["homa-ir", "胰岛素抵抗指数", "稳态模型胰岛素抵抗指数"], ref: lt(2.69), direction: "higher_worse", decimals: 2, derived: true,
    explain: "空腹血糖×空腹胰岛素÷22.5。数值越高胰岛素抵抗越明显，中国人群常用 2.69 作为分界。",
  },

  // ======================= 甲状腺 =======================
  {
    code: "TSH", zh: "促甲状腺激素", en: "Thyroid-stimulating hormone", category: "thyroid", unit: "mIU/L", valueType: "numeric",
    aliases: ["促甲状腺激素", "促甲状腺素", "超敏促甲状腺激素", "tsh", "stsh", "htsh", "s-tsh", "tsh3ul"], ref: r(0.27, 4.2),
    direction: "both", decimals: 2, explain: "调控甲状腺的激素。偏高常提示甲状腺功能减退，偏低提示甲亢倾向。",
  },
  {
    code: "FT3", zh: "游离三碘甲状腺原氨酸", en: "Free T3", category: "thyroid", unit: "pmol/L", valueType: "numeric",
    aliases: ["游离三碘甲状腺原氨酸", "游离t3", "ft3"], conversions: [{ unit: "pg/mL", factor: 1.536 }], ref: r(3.1, 6.8),
    direction: "both", decimals: 2, explain: "有活性的甲状腺激素之一。",
  },
  {
    code: "FT4", zh: "游离甲状腺素", en: "Free T4", category: "thyroid", unit: "pmol/L", valueType: "numeric",
    aliases: ["游离甲状腺素", "游离t4", "ft4"], conversions: [{ unit: "ng/dL", factor: 12.87 }], ref: r(12, 22),
    direction: "both", decimals: 2, explain: "有活性的甲状腺激素之一，与 TSH 一起判断甲状腺功能。",
  },
  {
    code: "T3", zh: "总三碘甲状腺原氨酸", en: "Total T3", category: "thyroid", unit: "nmol/L", valueType: "numeric",
    aliases: ["总三碘甲状腺原氨酸", "三碘甲状腺原氨酸", "总t3", "t3", "tt3"],
    conversions: [{ unit: "ng/mL", factor: 1.536 }, { unit: "ng/dL", factor: 0.01536 }], ref: r(1.3, 3.1), direction: "both", decimals: 2,
    explain: "甲状腺激素总量（含结合型）。",
  },
  {
    code: "T4", zh: "总甲状腺素", en: "Total T4", category: "thyroid", unit: "nmol/L", valueType: "numeric",
    aliases: ["总甲状腺素", "甲状腺素", "总t4", "t4", "tt4"], conversions: [{ unit: "μg/dL", factor: 12.87 }], ref: r(66, 181),
    direction: "both", decimals: 1, explain: "甲状腺素总量（含结合型）。",
  },
  {
    code: "TPOAB", zh: "甲状腺过氧化物酶抗体", en: "Anti-TPO antibody", category: "thyroid", unit: "IU/mL", valueType: "numeric",
    aliases: ["甲状腺过氧化物酶抗体", "抗甲状腺过氧化物酶抗体", "tpoab", "tpo-ab", "a-tpo", "anti-tpo"], ref: lt(34), direction: "higher_worse", decimals: 1,
    explain: "升高提示自身免疫性甲状腺炎（桥本），需定期查甲功。",
  },
  {
    code: "TGAB", zh: "甲状腺球蛋白抗体", en: "Anti-thyroglobulin antibody", category: "thyroid", unit: "IU/mL", valueType: "numeric",
    aliases: ["甲状腺球蛋白抗体", "抗甲状腺球蛋白抗体", "tgab", "tg-ab", "a-tg", "anti-tg", "atg"], ref: lt(115), direction: "higher_worse", decimals: 1,
    explain: "升高提示自身免疫性甲状腺疾病。",
  },
  {
    code: "THYROGLOBULIN", zh: "甲状腺球蛋白", en: "Thyroglobulin", category: "thyroid", unit: "ng/mL", valueType: "numeric",
    aliases: ["甲状腺球蛋白", "thyroglobulin", "htg"], ref: r(3.5, 77), direction: "higher_worse", decimals: 1,
    explain: "甲状腺分泌的蛋白，主要用于甲状腺癌术后随访。",
  },
  {
    code: "CALCITONIN", zh: "降钙素", en: "Calcitonin", category: "thyroid", unit: "pg/mL", valueType: "numeric",
    aliases: ["降钙素", "calcitonin", "hct降钙素", "ct降钙素"], ref: mf(lt(9.52), lt(6.4)), direction: "higher_worse", decimals: 2,
    explain: "甲状腺 C 细胞分泌，明显升高需排查甲状腺髓样癌。",
  },

  // ======================= 肿瘤标志物 =======================
  {
    code: "AFP", zh: "甲胎蛋白", en: "Alpha-fetoprotein", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["甲胎蛋白", "甲种胎儿球蛋白", "afp"], conversions: [{ unit: "IU/mL", factor: 1.21 }], ref: lt(7), direction: "higher_worse", decimals: 2,
    explain: "肝癌筛查常用指标，轻度升高也可见于肝炎活动期；明显升高需尽快就医。",
  },
  {
    code: "CEA", zh: "癌胚抗原", en: "Carcinoembryonic antigen", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["癌胚抗原", "cea"], ref: lt(5), direction: "higher_worse", decimals: 2,
    explain: "消化道、肺部肿瘤相关标志物。吸烟者可轻度升高，单次轻度升高多需复查而非确诊。",
  },
  {
    code: "CA199", zh: "糖类抗原19-9", en: "CA19-9", category: "tumor", unit: "U/mL", valueType: "numeric",
    aliases: ["糖类抗原19-9", "糖类抗原199", "糖链抗原19-9", "糖链抗原199", "ca19-9", "ca199"], ref: lt(37), direction: "higher_worse", decimals: 2,
    explain: "胰腺、胆道肿瘤相关标志物；胆道炎症、糖尿病也可使其轻度升高。",
  },
  {
    code: "CA125", zh: "糖类抗原125", en: "CA125", category: "tumor", unit: "U/mL", valueType: "numeric",
    aliases: ["糖类抗原125", "糖链抗原125", "ca125", "ca12-5"], ref: lt(35), direction: "higher_worse", decimals: 2, sex: "female",
    explain: "卵巢肿瘤相关标志物；月经期、子宫内膜异位症也可升高。",
  },
  {
    code: "CA153", zh: "糖类抗原15-3", en: "CA15-3", category: "tumor", unit: "U/mL", valueType: "numeric",
    aliases: ["糖类抗原15-3", "糖类抗原153", "糖链抗原153", "糖链抗原15-3", "ca15-3", "ca153"], ref: lt(25), direction: "higher_worse", decimals: 2, sex: "female",
    explain: "乳腺肿瘤相关标志物，主要用于随访。",
  },
  {
    code: "CA724", zh: "糖类抗原72-4", en: "CA72-4", category: "tumor", unit: "U/mL", valueType: "numeric",
    aliases: ["糖类抗原72-4", "糖类抗原724", "糖链抗原724", "糖链抗原72-4", "ca72-4", "ca724"], ref: lt(6.9), direction: "higher_worse", decimals: 2,
    explain: "胃肠道肿瘤相关标志物，痛风、胃炎等也可使其升高。",
  },
  {
    code: "CA242", zh: "糖类抗原242", en: "CA242", category: "tumor", unit: "U/mL", valueType: "numeric",
    aliases: ["糖类抗原242", "糖链抗原242", "ca242"], ref: lt(20), direction: "higher_worse", decimals: 2, explain: "胰腺及消化道肿瘤相关标志物。",
  },
  {
    code: "CA50", zh: "糖类抗原50", en: "CA50", category: "tumor", unit: "U/mL", valueType: "numeric",
    aliases: ["糖类抗原50", "糖链抗原50", "ca50"], ref: lt(25), direction: "higher_worse", decimals: 2, explain: "消化道肿瘤相关标志物。",
  },
  {
    code: "TPSA", zh: "总前列腺特异性抗原", en: "Total PSA", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["总前列腺特异性抗原", "前列腺特异性抗原", "tpsa", "t-psa", "psa"], ref: lt(4), direction: "higher_worse", decimals: 2, sex: "male",
    explain: "前列腺癌筛查指标。4–10 为灰区，需结合游离PSA比值；前列腺增生、骑车等也会升高。",
  },
  {
    code: "FPSA", zh: "游离前列腺特异性抗原", en: "Free PSA", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["游离前列腺特异性抗原", "游离psa", "fpsa", "f-psa"], direction: "info", decimals: 2, sex: "male",
    explain: "与总 PSA 一起计算比值，帮助判断灰区升高的性质。",
  },
  {
    code: "FPSA_RATIO", zh: "游离PSA/总PSA比值", en: "fPSA/tPSA ratio", category: "tumor", unit: "", valueType: "numeric",
    aliases: ["游离psa/总psa", "fpsa/tpsa", "f/t比值", "f-psa/t-psa", "fpsa/tpsa比值"], direction: "info", decimals: 2, sex: "male", derived: true,
    explain: "总 PSA 在 4–10 灰区时参考：比值 <0.16 时前列腺癌风险相对较高。",
  },
  {
    code: "CYFRA211", zh: "细胞角蛋白19片段", en: "CYFRA 21-1", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["细胞角蛋白19片段", "细胞角质蛋白19片段", "细胞角蛋白19片段抗原21-1", "cyfra21-1", "cyfra211", "ck19"], ref: lt(3.3),
    direction: "higher_worse", decimals: 2, explain: "肺部（尤其鳞癌）肿瘤相关标志物。",
  },
  {
    code: "NSE", zh: "神经元特异性烯醇化酶", en: "Neuron-specific enolase", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["神经元特异性烯醇化酶", "nse"], ref: lt(16.3), direction: "higher_worse", decimals: 2,
    explain: "小细胞肺癌等相关标志物；标本溶血会导致假性升高。",
  },
  {
    code: "SCC", zh: "鳞状上皮细胞癌抗原", en: "SCC antigen", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["鳞状上皮细胞癌抗原", "鳞状细胞癌相关抗原", "鳞癌抗原", "scc", "scca", "scc-ag"], ref: lt(1.5), direction: "higher_worse", decimals: 2,
    explain: "鳞状细胞癌相关标志物；皮肤病、唾液污染可致假性升高。",
  },
  {
    code: "PROGRP", zh: "胃泌素释放肽前体", en: "ProGRP", category: "tumor", unit: "pg/mL", valueType: "numeric",
    aliases: ["胃泌素释放肽前体", "前胃泌素释放肽", "progrp"], ref: lt(65), direction: "higher_worse", decimals: 1,
    explain: "小细胞肺癌相关标志物；肾功能不全时可升高。",
  },
  {
    code: "PGI", zh: "胃蛋白酶原I", en: "Pepsinogen I", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["胃蛋白酶原i", "胃蛋白酶原1", "pgi", "pg-i", "pg1"], ref: gt(70), direction: "lower_worse", decimals: 1,
    explain: "胃癌风险筛查指标之一，PGI ≤70 且 PGI/PGII ≤3 提示萎缩性胃炎风险。",
  },
  {
    code: "PGII", zh: "胃蛋白酶原II", en: "Pepsinogen II", category: "tumor", unit: "ng/mL", valueType: "numeric",
    aliases: ["胃蛋白酶原ii", "胃蛋白酶原2", "pgii", "pg-ii", "pg2"], direction: "info", decimals: 1, explain: "与 PGI 一起计算比值。",
  },
  {
    code: "PGR", zh: "胃蛋白酶原比值", en: "PGI/PGII ratio", category: "tumor", unit: "", valueType: "numeric",
    aliases: ["胃蛋白酶原比值", "pgi/pgii", "pgr", "pg1/pg2"], ref: gt(3), direction: "lower_worse", decimals: 2,
    explain: "PGI/PGII 比值，偏低提示胃黏膜萎缩风险。",
  },

  // ======================= 骨密度 / 骨代谢 =======================
  {
    code: "BMD_T", zh: "骨密度T值", en: "BMD T-score", category: "bone", unit: "", valueType: "numeric",
    aliases: ["骨密度t值", "t值", "t-score", "t评分"], ref: { low: -1 }, direction: "lower_worse", decimals: 1,
    explain: "与年轻人峰值骨量比较。≥-1.0 正常，-1.0 至 -2.5 为骨量减少，≤-2.5 为骨质疏松。",
  },
  {
    code: "BMD_Z", zh: "骨密度Z值", en: "BMD Z-score", category: "bone", unit: "", valueType: "numeric",
    aliases: ["骨密度z值", "z值", "z-score", "z评分"], ref: { low: -2 }, direction: "lower_worse", decimals: 1,
    explain: "与同龄人比较，≤-2.0 提示骨量低于同龄人，需排查继发原因。",
  },
  {
    code: "BMD", zh: "骨密度", en: "Bone mineral density", category: "bone", unit: "g/cm²", valueType: "numeric",
    aliases: ["骨密度", "骨矿物质密度", "bmd"], direction: "info", decimals: 3, explain: "骨骼中矿物质含量，一般看 T 值判断。",
  },
  {
    code: "PTH", zh: "甲状旁腺激素", en: "Parathyroid hormone", category: "bone", unit: "pg/mL", valueType: "numeric",
    aliases: ["甲状旁腺激素", "甲状旁腺素", "全段甲状旁腺激素", "pth", "ipth"], ref: r(15, 65), direction: "both", decimals: 1,
    explain: "调节血钙的激素，维生素 D 不足时常代偿性升高。",
  },

  // ======================= 凝血功能 =======================
  {
    code: "PT", zh: "凝血酶原时间", en: "Prothrombin time", category: "coag", unit: "s", valueType: "numeric",
    aliases: ["凝血酶原时间", "血浆凝血酶原时间", "pt"], ref: r(10, 14), direction: "both", decimals: 1,
    explain: "反映外源性凝血功能，服用华法林时会延长。",
  },
  {
    code: "INR", zh: "国际标准化比值", en: "INR", category: "coag", unit: "", valueType: "numeric",
    aliases: ["国际标准化比值", "inr", "pt-inr"], ref: r(0.8, 1.2), direction: "both", decimals: 2, explain: "标准化后的凝血酶原时间。",
  },
  {
    code: "APTT", zh: "活化部分凝血活酶时间", en: "APTT", category: "coag", unit: "s", valueType: "numeric",
    aliases: ["活化部分凝血活酶时间", "部分凝血活酶时间", "aptt"], ref: r(25, 37), direction: "both", decimals: 1, explain: "反映内源性凝血功能。",
  },
  {
    code: "TT", zh: "凝血酶时间", en: "Thrombin time", category: "coag", unit: "s", valueType: "numeric",
    aliases: ["凝血酶时间", "tt"], ref: r(14, 21), direction: "both", decimals: 1, explain: "反映纤维蛋白原转化为纤维蛋白的过程。",
  },
  {
    code: "FIB", zh: "纤维蛋白原", en: "Fibrinogen", category: "coag", unit: "g/L", valueType: "numeric",
    aliases: ["纤维蛋白原", "纤维蛋白原含量", "fib"], conversions: [{ unit: "mg/dL", factor: 0.01 }], ref: r(2, 4), direction: "both", decimals: 2,
    explain: "凝血因子之一，炎症时也会升高。",
  },
  {
    code: "DD", zh: "D-二聚体", en: "D-dimer", category: "coag", unit: "mg/L", valueType: "numeric",
    aliases: ["d-二聚体", "d二聚体", "d-dimer", "dd", "d-d"], conversions: [{ unit: "ng/mL", factor: 0.001 }], ref: lt(0.5),
    direction: "higher_worse", decimals: 2, explain: "血栓形成与溶解的标志，升高需结合症状排查血栓。",
  },

  // ======================= 电解质 =======================
  {
    code: "K", zh: "钾", en: "Potassium", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["钾", "血钾", "血清钾", "k", "k+"], ref: r(3.5, 5.3), direction: "both", decimals: 2,
    explain: "维持心脏和肌肉正常功能。过高或过低都可能引起心律失常。",
  },
  {
    code: "NA", zh: "钠", en: "Sodium", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["钠", "血钠", "血清钠", "na", "na+"], ref: r(137, 147), direction: "both", decimals: 1, explain: "维持体液平衡的主要电解质。",
  },
  {
    code: "CL", zh: "氯", en: "Chloride", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["氯", "血氯", "血清氯", "cl", "cl-"], ref: r(99, 110), direction: "both", decimals: 1, explain: "与钠一起维持体液和酸碱平衡。",
  },
  {
    code: "CA", zh: "钙", en: "Calcium", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["钙", "血钙", "总钙", "血清钙", "ca", "ca2+"], conversions: [{ unit: "mg/dL", factor: 0.2495 }], ref: r(2.11, 2.52),
    direction: "both", decimals: 2, explain: "与骨骼健康、神经肌肉功能有关，需结合白蛋白判断。",
  },
  {
    code: "P", zh: "磷", en: "Phosphorus", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["磷", "无机磷", "血磷", "血清磷", "phos", "ip"], conversions: [{ unit: "mg/dL", factor: 0.3229 }], ref: r(0.85, 1.51),
    direction: "both", decimals: 2, explain: "与钙一起参与骨代谢，肾功能下降时可升高。",
  },
  {
    code: "MG", zh: "镁", en: "Magnesium", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["镁", "血镁", "血清镁", "mg", "mg2+"], conversions: [{ unit: "mg/dL", factor: 0.4114 }], ref: r(0.75, 1.02),
    direction: "both", decimals: 2, explain: "参与神经肌肉和心脏功能。",
  },
  {
    code: "CO2", zh: "二氧化碳结合力", en: "Total CO2 (bicarbonate)", category: "electrolyte", unit: "mmol/L", valueType: "numeric",
    aliases: ["二氧化碳结合力", "二氧化碳", "总二氧化碳", "碳酸氢根", "co2", "co2cp", "tco2", "hco3-", "hco3"], ref: r(22, 29),
    direction: "both", decimals: 1, explain: "反映血液酸碱平衡。",
  },

  // ======================= 心血管 / 炎症 =======================
  {
    code: "HCY", zh: "同型半胱氨酸", en: "Homocysteine", category: "cardio", unit: "μmol/L", valueType: "numeric",
    aliases: ["同型半胱氨酸", "血同型半胱氨酸", "hcy"], ref: lt(15), direction: "higher_worse", decimals: 1,
    explain: "升高与心脑血管病风险相关，常与叶酸、维生素B12 不足有关；≥10 合并高血压称 H 型高血压。",
  },
  {
    code: "HSCRP", zh: "超敏C反应蛋白", en: "hs-CRP", category: "cardio", unit: "mg/L", valueType: "numeric",
    aliases: ["超敏c反应蛋白", "超敏crp", "高敏c反应蛋白", "hs-crp", "hscrp"], conversions: [{ unit: "mg/dL", factor: 10 }], ref: lt(3),
    direction: "higher_worse", decimals: 2, explain: "低度炎症指标，<1 心血管风险低，1–3 中等，>3 较高；感冒时会暂时升高。",
  },
  {
    code: "CRP", zh: "C反应蛋白", en: "C-reactive protein", category: "cardio", unit: "mg/L", valueType: "numeric",
    aliases: ["c反应蛋白", "c-反应蛋白", "crp"], conversions: [{ unit: "mg/dL", factor: 10 }], ref: lt(10), direction: "higher_worse", decimals: 1,
    explain: "急性炎症指标，感染时明显升高。",
  },
  {
    code: "CK", zh: "肌酸激酶", en: "Creatine kinase", category: "cardio", unit: "U/L", valueType: "numeric",
    aliases: ["肌酸激酶", "肌酸磷酸激酶", "ck", "cpk"], ref: mf(r(50, 310), r(40, 200)), direction: "higher_worse", decimals: 0,
    explain: "主要来自肌肉，剧烈运动或服用他汀后可能升高。",
  },
  {
    code: "CKMB", zh: "肌酸激酶同工酶", en: "CK-MB", category: "cardio", unit: "U/L", valueType: "numeric",
    aliases: ["肌酸激酶同工酶", "肌酸激酶mb同工酶", "ck-mb", "ckmb"], ref: r(0, 24), direction: "higher_worse", decimals: 1,
    explain: "心肌相关酶，明显升高需排查心肌损伤。",
  },
  {
    code: "LDH", zh: "乳酸脱氢酶", en: "Lactate dehydrogenase", category: "cardio", unit: "U/L", valueType: "numeric",
    aliases: ["乳酸脱氢酶", "ldh", "ld"], ref: r(120, 250), direction: "higher_worse", decimals: 0, explain: "广泛存在于各组织，特异性较低。",
  },
  {
    code: "HBDH", zh: "α-羟丁酸脱氢酶", en: "Alpha-hydroxybutyrate dehydrogenase", category: "cardio", unit: "U/L", valueType: "numeric",
    aliases: ["α-羟丁酸脱氢酶", "羟丁酸脱氢酶", "hbdh", "α-hbdh"], ref: r(72, 182), direction: "higher_worse", decimals: 0, explain: "心肌酶谱的一部分。",
  },
  {
    code: "NT_PROBNP", zh: "N末端B型利钠肽原", en: "NT-proBNP", category: "cardio", unit: "pg/mL", valueType: "numeric",
    aliases: ["n末端b型利钠肽原", "n末端脑钠肽前体", "脑钠肽前体", "nt-probnp", "ntprobnp"], ref: lt(125), direction: "higher_worse", decimals: 0,
    explain: "心脏负荷指标，升高需排查心功能不全；年龄越大参考值越高。",
  },
  {
    code: "CTNI", zh: "肌钙蛋白I", en: "Cardiac troponin I", category: "cardio", unit: "ng/mL", valueType: "numeric",
    aliases: ["肌钙蛋白i", "心肌肌钙蛋白i", "超敏肌钙蛋白i", "ctni", "tni", "hs-ctni"], ref: lt(0.04), direction: "higher_worse", decimals: 3,
    explain: "心肌损伤的特异指标，升高需立即就医评估。",
  },

  // ======================= 维生素 / 营养 =======================
  {
    code: "VITD", zh: "25-羟维生素D", en: "25-hydroxyvitamin D", category: "vitamin", unit: "ng/mL", valueType: "numeric",
    aliases: ["25-羟维生素d", "25羟维生素d", "25-羟基维生素d", "维生素d", "总维生素d", "25-oh-d", "25(oh)d", "25-oh-vd", "vitd"],
    conversions: [{ unit: "nmol/L", factor: 0.4006 }], ref: r(30, 100), direction: "lower_worse", decimals: 1,
    explain: "反映体内维生素D储备。<20 为缺乏，20–30 为不足，与骨骼健康、肌力有关。",
  },
  {
    code: "VITB12", zh: "维生素B12", en: "Vitamin B12", category: "vitamin", unit: "pg/mL", valueType: "numeric",
    aliases: ["维生素b12", "钴胺素", "vitb12", "b12"], conversions: [{ unit: "pmol/L", factor: 1.355 }], ref: r(197, 771), direction: "lower_worse", decimals: 0,
    explain: "缺乏可引起贫血和神经症状，素食者和老年人较常见。",
  },
  {
    code: "FOLATE", zh: "叶酸", en: "Folate", category: "vitamin", unit: "ng/mL", valueType: "numeric",
    aliases: ["叶酸", "血清叶酸", "fa", "fol", "folate"], conversions: [{ unit: "nmol/L", factor: 0.441 }], ref: r(3.1, 20),
    direction: "lower_worse", decimals: 1, explain: "缺乏可导致贫血和同型半胱氨酸升高。",
  },
  {
    code: "FE", zh: "血清铁", en: "Serum iron", category: "vitamin", unit: "μmol/L", valueType: "numeric",
    aliases: ["血清铁", "铁", "fe", "si"], conversions: [{ unit: "μg/dL", factor: 0.179 }], ref: mf(r(10.6, 36.7), r(7.8, 32.2)),
    direction: "both", decimals: 1, explain: "血液中的铁含量，波动较大，需结合铁蛋白判断。",
  },
  {
    code: "FERRITIN", zh: "铁蛋白", en: "Ferritin", category: "vitamin", unit: "ng/mL", valueType: "numeric",
    aliases: ["铁蛋白", "血清铁蛋白", "ferritin", "fer", "sf"], ref: mf(r(30, 400), r(13, 150)), direction: "both", decimals: 1,
    explain: "反映体内铁储备。偏低提示缺铁；明显偏高可见于炎症、脂肪肝或铁过载。",
  },
  {
    code: "TRF", zh: "转铁蛋白", en: "Transferrin", category: "vitamin", unit: "g/L", valueType: "numeric",
    aliases: ["转铁蛋白", "trf", "tf"], ref: r(2, 3.6), direction: "both", decimals: 2, explain: "运输铁的蛋白，缺铁时升高。",
  },

  // ======================= 感染 / 免疫 =======================
  {
    code: "HP_C13", zh: "¹³C尿素呼气试验", en: "13C urea breath test", category: "infection", unit: "‰", valueType: "numeric",
    aliases: ["13c尿素呼气试验", "c13呼气试验", "碳13呼气试验", "13c-ubt", "c13", "dob值", "幽门螺杆菌c13", "13c呼气试验"],
    ref: lt(4), direction: "higher_worse", decimals: 1, explain: "检测幽门螺杆菌感染，DOB ≥4.0 为阳性，阳性者建议消化科评估是否根除治疗。",
  },
  {
    code: "HP_C14", zh: "¹⁴C尿素呼气试验", en: "14C urea breath test", category: "infection", unit: "dpm/mmol", valueType: "numeric",
    aliases: ["14c尿素呼气试验", "c14呼气试验", "碳14呼气试验", "14c-ubt", "c14", "幽门螺杆菌c14", "14c呼气试验"],
    ref: lt(100), direction: "higher_worse", decimals: 0, explain: "检测幽门螺杆菌感染，≥100 dpm/mmol 通常判为阳性。",
  },
  {
    code: "HP_AB", zh: "幽门螺杆菌抗体", en: "H. pylori antibody", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["幽门螺杆菌抗体", "幽门螺旋杆菌抗体", "抗幽门螺杆菌抗体", "hp-ab", "hp抗体"], direction: "qualitative",
    explain: "阳性说明曾经或正在感染，不能区分现症感染，需呼气试验确认。",
  },
  {
    code: "HBSAG", zh: "乙肝表面抗原", en: "HBsAg", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["乙肝表面抗原", "乙型肝炎表面抗原", "hbsag"], direction: "qualitative", explain: "阳性提示乙肝病毒感染，需肝病科随访。",
  },
  {
    code: "HBSAB", zh: "乙肝表面抗体", en: "Anti-HBs", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["乙肝表面抗体", "乙型肝炎表面抗体", "hbsab", "抗-hbs", "anti-hbs"], qualitativeNormal: ["阳性", "阴性"], direction: "info",
    explain: "阳性说明对乙肝有免疫力（接种疫苗或既往感染后）；阴性可考虑接种疫苗。",
  },
  {
    code: "HBEAG", zh: "乙肝e抗原", en: "HBeAg", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["乙肝e抗原", "乙型肝炎e抗原", "hbeag"], direction: "qualitative", explain: "阳性提示病毒复制较活跃。",
  },
  {
    code: "HBEAB", zh: "乙肝e抗体", en: "Anti-HBe", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["乙肝e抗体", "乙型肝炎e抗体", "hbeab", "抗-hbe"], qualitativeNormal: ["阳性", "阴性"], direction: "info",
    explain: "需与其他乙肝指标一起解读。",
  },
  {
    code: "HBCAB", zh: "乙肝核心抗体", en: "Anti-HBc", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["乙肝核心抗体", "乙型肝炎核心抗体", "hbcab", "抗-hbc"], qualitativeNormal: ["阳性", "阴性"], direction: "info",
    explain: "阳性提示曾经感染过乙肝病毒，需结合表面抗原判断。",
  },
  {
    code: "HCV_AB", zh: "丙肝抗体", en: "Anti-HCV", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["丙肝抗体", "丙型肝炎抗体", "抗-hcv", "hcv-ab", "anti-hcv"], direction: "qualitative", explain: "阳性需进一步查 HCV-RNA 确认。",
  },
  {
    code: "TP_AB", zh: "梅毒螺旋体抗体", en: "Treponema pallidum antibody", category: "infection", unit: "", valueType: "qualitative",
    aliases: ["梅毒螺旋体抗体", "梅毒抗体", "梅毒特异性抗体", "抗tp", "tp-ab", "tppa"], direction: "qualitative", explain: "阳性需进一步检查确认。",
  },
  {
    code: "RF", zh: "类风湿因子", en: "Rheumatoid factor", category: "infection", unit: "IU/mL", valueType: "numeric",
    aliases: ["类风湿因子", "rf"], ref: lt(20), direction: "higher_worse", decimals: 1, explain: "类风湿关节炎相关指标，健康老人也可轻度升高。",
  },
  {
    code: "ASO", zh: "抗链球菌溶血素O", en: "Antistreptolysin O", category: "infection", unit: "IU/mL", valueType: "numeric",
    aliases: ["抗链球菌溶血素o", "抗o", "aso"], ref: lt(200), direction: "higher_worse", decimals: 0, explain: "提示近期链球菌感染。",
  },
];

const BY_CODE = new Map(INDICATORS.map((d) => [d.code, d]));

export function getIndicator(code: string | null | undefined): IndicatorDef | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

export function indicatorsByCategory(category: CategoryKey): IndicatorDef[] {
  return INDICATORS.filter((d) => d.category === category);
}

/**
 * Resolve an indicator's default reference range for a member's sex. When sex
 * is unknown and the range is sex-specific, returns the union of both ranges
 * so nothing is flagged that would be normal for either sex.
 */
export function defaultRange(def: IndicatorDef, sex?: "male" | "female" | null): NumericRange | undefined {
  const ref = def.ref;
  if (!ref) return undefined;
  if ("male" in ref && "female" in ref) {
    if (sex === "male") return ref.male;
    if (sex === "female") return ref.female;
    const lows = [ref.male.low, ref.female.low].filter((v): v is number => v != null);
    const highs = [ref.male.high, ref.female.high].filter((v): v is number => v != null);
    return {
      low: lows.length === 2 ? Math.min(...lows) : undefined,
      high: highs.length === 2 ? Math.max(...highs) : undefined,
    };
  }
  return ref as NumericRange;
}
