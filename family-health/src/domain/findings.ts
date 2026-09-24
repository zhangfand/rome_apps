/**
 * Normalized keys for text findings from 超声 / 影像 / 心电图 / 总检 conclusions,
 * plus deterministic helpers to detect them in free text and parse severity
 * (轻度/中度/重度, TI-RADS, BI-RADS, size in mm). The LLM extractor proposes a
 * key; `detectFindings` is the deterministic fallback and cross-check.
 */
import { normalizeWidth } from "./text.js";

export interface FindingDef {
  key: string;
  zh: string;
  organ: string;
  /** Regexes matched against width-normalized text. */
  patterns: RegExp[];
  explain: string;
}

export const FINDINGS: FindingDef[] = [
  { key: "fatty_liver", zh: "脂肪肝", organ: "肝脏", patterns: [/脂肪肝/, /肝脏?脂肪(浸润|变性|沉积)/, /脂肪性肝病/], explain: "肝细胞内脂肪堆积，多与超重、饮酒、代谢异常有关，减重和运动可以改善。" },
  { key: "liver_cyst", zh: "肝囊肿", organ: "肝脏", patterns: [/肝(内|脏)?囊肿/], explain: "多为良性，小的单纯囊肿一般定期复查即可。" },
  { key: "liver_hemangioma", zh: "肝血管瘤", organ: "肝脏", patterns: [/肝(内|脏)?血管瘤/], explain: "常见的肝脏良性肿瘤，多数只需定期随访。" },
  { key: "gallbladder_polyp", zh: "胆囊息肉", organ: "胆囊", patterns: [/胆囊(多发)?息肉/, /胆囊.*息肉样(病变)?/], explain: "多为胆固醇性息肉。≥10mm 或快速增大需外科评估。" },
  { key: "gallstone", zh: "胆囊结石", organ: "胆囊", patterns: [/胆囊(多发)?结石/, /胆结石/], explain: "无症状时可观察，反复腹痛需就医。" },
  { key: "renal_cyst", zh: "肾囊肿", organ: "肾脏", patterns: [/(左|右|双)?肾(脏)?(多发)?囊肿/], explain: "单纯肾囊肿多为良性，定期复查大小即可。" },
  { key: "kidney_stone", zh: "肾结石", organ: "肾脏", patterns: [/(左|右|双)?肾(脏)?(多发)?结石/, /肾(内)?(强回声|钙化灶)/], explain: "多喝水，出现腰痛、血尿需就医。" },
  { key: "thyroid_nodule", zh: "甲状腺结节", organ: "甲状腺", patterns: [/甲状腺.*结节/, /TI-?RADS/i], explain: "非常常见，绝大多数为良性。TI-RADS 4 类及以上建议专科评估。" },
  { key: "breast_nodule", zh: "乳腺结节", organ: "乳腺", patterns: [/乳腺.*结节/, /乳腺.*(低回声|肿块)/, /BI-?RADS/i], explain: "BI-RADS 3 类多建议 6 个月复查，4 类及以上需专科评估。" },
  { key: "breast_hyperplasia", zh: "乳腺增生", organ: "乳腺", patterns: [/乳腺(小叶)?增生/], explain: "常见的良性变化，与激素周期有关。" },
  { key: "lung_nodule", zh: "肺结节", organ: "肺", patterns: [/肺.*结节/, /(磨玻璃|GGO)/i], explain: "多数为良性。≥8mm、实性成分增加或磨玻璃结节需按医嘱随访。" },
  { key: "carotid_plaque", zh: "颈动脉斑块", organ: "颈动脉", patterns: [/颈(总)?动脉.*斑块/, /颈动脉.*粥样硬化/], explain: "动脉粥样硬化的表现，需要积极控制血脂、血压、血糖并戒烟。" },
  { key: "carotid_imt", zh: "颈动脉内中膜增厚", organ: "颈动脉", patterns: [/(内中膜|IMT).*增厚/i], explain: "动脉硬化的早期表现。" },
  { key: "prostate_hyperplasia", zh: "前列腺增生", organ: "前列腺", patterns: [/前列腺(增生|肥大|增大)/], explain: "中老年男性常见，有排尿困难时需泌尿科就诊。" },
  { key: "prostate_calcification", zh: "前列腺钙化", organ: "前列腺", patterns: [/前列腺.*(钙化|结石)/], explain: "多为良性，一般无需处理。" },
  { key: "uterine_fibroid", zh: "子宫肌瘤", organ: "子宫", patterns: [/子宫(多发)?肌瘤/], explain: "常见良性肿瘤，较大或有症状时需妇科评估。" },
  { key: "ovarian_cyst", zh: "卵巢囊肿", organ: "卵巢", patterns: [/(附件区?|卵巢).*囊(肿|性)/], explain: "多为生理性，需按医嘱复查。" },
  { key: "sinus_bradycardia", zh: "窦性心动过缓", organ: "心脏", patterns: [/窦性心动过缓/], explain: "心率偏慢，运动员常见；伴头晕乏力需就医。" },
  { key: "sinus_tachycardia", zh: "窦性心动过速", organ: "心脏", patterns: [/窦性心动过速/], explain: "心率偏快，可与紧张、饮咖啡等有关。" },
  { key: "ecg_st_t", zh: "ST-T 改变", organ: "心脏", patterns: [/ST-?T.*(改变|异常)/i, /ST段.*(压低|改变)/, /T波.*(低平|倒置|改变)/], explain: "非特异性改变常见，伴胸闷胸痛需心内科评估。" },
  { key: "arrhythmia", zh: "心律失常", organ: "心脏", patterns: [/早搏/, /房颤|心房颤动/, /传导阻滞/, /心律不齐/], explain: "需结合症状，房颤、频发早搏等建议心内科就诊。" },
  { key: "left_ventricular_hypertrophy", zh: "左心室肥厚", organ: "心脏", patterns: [/左(心)?室(肥厚|高电压)/], explain: "常与长期高血压有关。" },
  { key: "fundus_arteriosclerosis", zh: "眼底动脉硬化", organ: "眼", patterns: [/眼底.*动脉硬化/, /视网膜动脉硬化/], explain: "反映全身小动脉硬化，常与高血压相关。" },
  { key: "cataract", zh: "白内障", organ: "眼", patterns: [/白内障|晶状体混浊/], explain: "老年常见，影响视力时可手术。" },
  { key: "cervical_spondylosis", zh: "颈椎病/颈椎退变", organ: "颈椎", patterns: [/颈椎(病|退行性|骨质增生|生理曲度)/], explain: "与长期低头有关，注意姿势和锻炼。" },
  { key: "osteoporosis", zh: "骨质疏松", organ: "骨骼", patterns: [/骨质疏松/], explain: "骨量明显减少，骨折风险增加，需补钙、维生素D并就医评估。" },
  { key: "osteopenia", zh: "骨量减少", organ: "骨骼", patterns: [/骨量(减少|低下)/], explain: "骨质疏松的前期，注意运动和营养。" },
];

const BY_KEY = new Map(FINDINGS.map((f) => [f.key, f]));

export function getFinding(key: string | null | undefined): FindingDef | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

export interface ParsedSeverity {
  /** 1 = 轻度, 2 = 中度, 3 = 重度. */
  grade?: 1 | 2 | 3;
  gradeText?: string;
  tirads?: number;
  birads?: number;
  /** Largest size mentioned, in mm. */
  sizeMm?: number;
  multiple?: boolean;
}

const GRADE_WORDS: Array<[RegExp, 1 | 2 | 3, string]> = [
  [/(中[-~至到]?重度)/, 3, "中重度"],
  [/(轻[-~至到]?中度)/, 2, "轻中度"],
  [/重度/, 3, "重度"],
  [/中度/, 2, "中度"],
  [/轻度|轻微/, 1, "轻度"],
];

/** Extract severity information from a finding's text. */
export function parseSeverity(raw: string): ParsedSeverity {
  const t = normalizeWidth(raw);
  const out: ParsedSeverity = {};
  for (const [re, grade, text] of GRADE_WORDS) {
    if (re.test(t)) {
      out.grade = grade;
      out.gradeText = text;
      break;
    }
  }
  const ti = t.match(/TI-?RADS\s*[:：]?\s*(\d)\s*[a-cA-C]?\s*类?/i) ?? t.match(/TI-?RADS[^\d]{0,6}(\d)/i);
  if (ti) out.tirads = Number(ti[1]);
  const bi = t.match(/BI-?RADS\s*[:：]?\s*(\d)\s*[a-cA-C]?\s*类?/i) ?? t.match(/BI-?RADS[^\d]{0,6}(\d)/i);
  if (bi) out.birads = Number(bi[1]);

  // Sizes: `12×8mm`, `1.2x0.8cm`, `约5mm`, `直径 0.6 cm`.
  let maxMm: number | undefined;
  const sizeRe = /(\d+(?:\.\d+)?)(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?\s*(mm|cm|毫米|厘米)/gi;
  for (const m of t.matchAll(sizeRe)) {
    const factor = /cm|厘米/i.test(m[4]) ? 10 : 1;
    for (const g of [m[1], m[2], m[3]]) {
      if (g == null) continue;
      const mm = Number(g) * factor;
      if (Number.isFinite(mm)) maxMm = Math.max(maxMm ?? 0, mm);
    }
  }
  if (maxMm != null) out.sizeMm = Math.round(maxMm * 10) / 10;
  if (/多发|多个|数个|散在/.test(t)) out.multiple = true;
  return out;
}

export interface DetectedFinding {
  key: string;
  zh: string;
  organ: string;
  severity: ParsedSeverity;
}

/**
 * Detect normalized findings in a conclusion sentence. Negated statements
 * (`未见脂肪肝`, `无结节`) are skipped. One sentence can yield several keys.
 */
export function detectFindings(raw: string): DetectedFinding[] {
  const t = normalizeWidth(raw);
  const out: DetectedFinding[] = [];
  // Work sentence by sentence so a negation only applies locally.
  const sentences = t.split(/[。；;\n]|(?<=\S)\s{2,}/).filter((s) => s.trim());
  for (const sentence of sentences) {
    for (const def of FINDINGS) {
      const hit = def.patterns.map((re) => sentence.match(re)).find((m) => m);
      if (!hit) continue;
      const before = sentence.slice(Math.max(0, (hit.index ?? 0) - 6), hit.index ?? 0);
      if (/(未见|未发现|无明显|无|未探及|排除)[^，,]*$/.test(before)) continue;
      if (out.some((f) => f.key === def.key)) continue;
      out.push({ key: def.key, zh: def.zh, organ: def.organ, severity: parseSeverity(sentence) });
    }
  }
  return out;
}

/** Short display label for a severity, e.g. `中度`, `TI-RADS 3类`, `8mm`. */
export function severityLabel(s: ParsedSeverity): string {
  const parts: string[] = [];
  if (s.gradeText) parts.push(s.gradeText);
  if (s.tirads != null) parts.push(`TI-RADS ${s.tirads}类`);
  if (s.birads != null) parts.push(`BI-RADS ${s.birads}类`);
  if (s.sizeMm != null) parts.push(`${s.sizeMm}mm`);
  return parts.join(" · ");
}
