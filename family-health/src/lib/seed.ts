/**
 * Demo data: four family members with several years of confirmed checkups,
 * findings, interventions and chat-style home measurements. Everything is
 * flagged `is_demo` (members + reports) and uses stable `demo-*` ids, so
 * re-seeding replaces the previous demo data and clearing never touches real
 * rows. Values are plausible but synthetic; none trips a critical threshold.
 */
import { computeFlag } from "../domain/flags.js";
import { CATEGORY_ZH, defaultRange, getIndicator } from "../domain/indicators.js";
import { formatRange } from "../domain/refRange.js";
import type { Sex } from "../domain/types.js";
import { parseResultValue } from "../domain/values.js";
import type { FamilyHealthStore, ResultInsert } from "../db/repositories/store.js";
import { deleteReportFiles } from "./service.js";

export const DEMO_PROVIDER = "演示体检中心";

type Val = number | string | null;

interface DemoFinding {
  key: string;
  organ: string;
  severity: string | null;
  text: string;
}

interface DemoMember {
  id: string;
  name: string;
  relation: string;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  goals: string[];
  exams: string[];
  values: Record<string, Val[]>;
  findings: Record<number, DemoFinding[]>;
  interventions: Array<{ category: string; title: string; description: string; startDate: string; endDate: string | null }>;
  measurements: Array<{ code: string; value: number; unit: string; date: string; note?: string }>;
}

const NEG4 = ["阴性", "阴性", "阴性", "阴性"];
const bp = (date: string, s: number, d: number, note = "家庭血压计") => [
  { code: "SBP", value: s, unit: "mmHg", date, note },
  { code: "DBP", value: d, unit: "mmHg", date, note },
];

export const DEMO_MEMBERS: DemoMember[] = [
  {
    id: "demo-self",
    name: "张伟",
    relation: "本人",
    sex: "male",
    birthDate: "1985-08-20",
    heightCm: 175,
    goals: ["weight_metabolic", "lipid_cardio", "liver"],
    exams: ["2022-05-12", "2023-05-18", "2024-05-20", "2025-06-10", "2026-06-15"],
    values: {
      HEIGHT: [175, 175, 175, 175, 175],
      WEIGHT: [82.0, 85.3, 89.1, 84.6, 79.8],
      BMI: [26.8, 27.9, 29.1, 27.6, 26.1],
      WAIST: [92, 95, 99, 95, 90],
      BODY_FAT: [25.8, 27.4, 29.3, 27.0, 24.6],
      SBP: [128, 133, 138, 131, 124],
      DBP: [82, 86, 89, 84, 79],
      HR: [74, 76, 78, 72, 68],
      WBC: [6.1, 6.4, 6.8, 6.2, 5.9],
      NEUT_PCT: [58.2, 60.1, 61.4, 59.0, 57.3],
      LYMPH_PCT: [32.1, 31.0, 29.8, 32.2, 33.5],
      RBC: [5.1, 5.2, 5.2, 5.1, 5.0],
      HGB: [152, 154, 156, 153, 150],
      HCT: [45.1, 45.8, 46.2, 45.3, 44.6],
      MCV: [88.2, 88.4, 88.9, 88.1, 88.0],
      PLT: [236, 242, 250, 238, 229],
      U_PRO: ["阴性", "阴性", "阴性", "阴性", "阴性"],
      U_GLU: ["阴性", "阴性", "阴性", "阴性", "阴性"],
      U_BLD: ["阴性", "阴性", "阴性", "阴性", "阴性"],
      U_SG: [1.02, 1.022, 1.025, 1.018, 1.016],
      ALT: [42, 56, 72, 48, 35],
      AST: [30, 36, 45, 33, 27],
      GGT: [48, 62, 85, 58, 40],
      ALP: [78, 80, 85, 79, 76],
      TBIL: [14.2, 15.1, 13.8, 14.6, 13.9],
      DBIL: [4.1, 4.3, 4.0, 4.2, 3.9],
      TP: [74.0, 75.2, 76.1, 74.3, 73.5],
      ALB: [46.1, 47.0, 47.2, 46.4, 46.0],
      CREA: [82, 85, 84, 83, 81],
      UREA: [5.1, 5.4, 5.8, 5.2, 4.9],
      UA: [420, 455, 498, 452, 410],
      TC: [5.1, 5.42, 5.81, 5.3, 4.92],
      TG: [1.92, 2.41, 3.12, 2.18, 1.58],
      HDL_C: [1.05, 0.98, 0.92, 1.01, 1.12],
      LDL_C: [3.21, 3.52, 3.83, 3.4, 3.02],
      APOA1: [1.2, 1.15, 1.1, 1.18, 1.25],
      APOB: [0.98, 1.05, 1.15, 1.02, 0.92],
      LPA: [120, null, 118, null, null],
      HSCRP: [1.8, 2.4, 3.6, 2.1, 1.2],
      HCY: [11.2, 12.0, 12.8, 11.5, 10.6],
      GLU: [5.6, 5.9, 6.3, 5.8, 5.4],
      HBA1C: [5.6, 5.8, 6.1, 5.8, 5.6],
      INS: [12.0, 14.5, 17.8, 13.2, 10.1],
      TSH: [2.1, 2.3, 1.9, 2.2, 2.0],
      AFP: [2.8, 3.1, 2.9, 3.0, 2.7],
      CEA: [2.1, 2.4, 2.2, 2.3, 2.0],
      CA199: [8.5, 9.1, 10.2, 9.4, 8.8],
      TPSA: [0.8, 0.9, 0.9, 1.0, 1.0],
      HP_C13: [null, 1.2, null, null, 1.5],
    },
    findings: {
      0: [{ key: "fatty_liver", organ: "肝脏", severity: "轻度", text: "脂肪肝（轻度）" }],
      1: [{ key: "fatty_liver", organ: "肝脏", severity: "中度", text: "脂肪肝（中度），肝脏回声增强" }],
      2: [
        { key: "fatty_liver", organ: "肝脏", severity: "中度", text: "脂肪肝（中度），肝脏回声增强，远场衰减" },
        { key: "gallbladder_polyp", organ: "胆囊", severity: "4mm", text: "胆囊息肉，大小约 4mm" },
      ],
      3: [
        { key: "fatty_liver", organ: "肝脏", severity: "中度", text: "脂肪肝（中度）" },
        { key: "gallbladder_polyp", organ: "胆囊", severity: "4mm", text: "胆囊息肉，大小约 4mm" },
      ],
      4: [
        { key: "fatty_liver", organ: "肝脏", severity: "轻度", text: "脂肪肝（轻度）" },
        { key: "gallbladder_polyp", organ: "胆囊", severity: "4mm", text: "胆囊息肉，大小约 4mm，较前无明显变化" },
      ],
    },
    interventions: [
      { category: "运动", title: "健身房力量训练", description: "每周2次，坚持约3个月后中断", startDate: "2023-09-01", endDate: "2023-11-30" },
      { category: "饮食", title: "控制晚餐碳水", description: "晚餐主食减半，少吃精米白面，多吃蔬菜和杂粮", startDate: "2025-03-01", endDate: null },
      { category: "运动", title: "每周3次快走", description: "每次约40分钟", startDate: "2025-03-10", endDate: null },
    ],
    measurements: [
      { code: "WEIGHT", value: 88.6, unit: "kg", date: "2025-03-05" },
      { code: "WEIGHT", value: 87.4, unit: "kg", date: "2025-04-06" },
      { code: "WEIGHT", value: 86.1, unit: "kg", date: "2025-05-08" },
      { code: "WEIGHT", value: 84.3, unit: "kg", date: "2025-07-12" },
      { code: "WEIGHT", value: 83.2, unit: "kg", date: "2025-09-14" },
      { code: "WEIGHT", value: 82.0, unit: "kg", date: "2025-11-16" },
      { code: "WEIGHT", value: 81.3, unit: "kg", date: "2026-01-18" },
      { code: "WEIGHT", value: 80.6, unit: "kg", date: "2026-03-22" },
      { code: "WEIGHT", value: 79.4, unit: "kg", date: "2026-08-30" },
      ...bp("2025-04-06", 134, 86),
      ...bp("2025-10-12", 128, 82),
      ...bp("2026-04-19", 124, 80),
      ...bp("2026-09-06", 122, 78),
    ],
  },
  {
    id: "demo-spouse",
    name: "李娜",
    relation: "配偶",
    sex: "female",
    birthDate: "1987-03-02",
    heightCm: 162,
    goals: [],
    exams: ["2023-05-18", "2024-05-20", "2025-06-10", "2026-06-15"],
    values: {
      WEIGHT: [56.5, 57.2, 57.0, 56.4],
      BMI: [21.5, 21.8, 21.7, 21.5],
      WAIST: [72, 73, 73, 72],
      SBP: [112, 115, 114, 110],
      DBP: [72, 74, 73, 70],
      WBC: [5.4, 5.8, 5.6, 5.2],
      RBC: [4.3, 4.1, 4.3, 4.4],
      HGB: [122, 112, 121, 126],
      MCV: [86.1, 80.4, 84.2, 86.0],
      PLT: [210, 225, 218, 205],
      FERRITIN: [null, 11.5, 28.0, 42.3],
      U_PRO: NEG4,
      U_BLD: NEG4,
      ALT: [16, 18, 17, 15],
      AST: [18, 19, 18, 17],
      GGT: [14, 15, 14, 13],
      CREA: [58, 60, 59, 57],
      UA: [280, 295, 288, 276],
      TC: [4.6, 4.72, 4.81, 4.7],
      TG: [0.9, 1.02, 0.95, 0.88],
      HDL_C: [1.55, 1.52, 1.58, 1.6],
      LDL_C: [2.5, 2.61, 2.7, 2.6],
      GLU: [4.9, 5.0, 5.1, 4.9],
      HBA1C: [5.2, 5.3, 5.3, 5.2],
      TSH: [1.8, 2.6, 2.4, 2.2],
      FT4: [15.2, 14.8, 15.0, 15.4],
      TPOAB: [12, 14, 15, 13],
      AFP: [2.1, 2.3, 2.0, 2.2],
      CEA: [1.2, 1.3, 1.1, 1.2],
      CA125: [15.2, 18.6, 14.8, 16.1],
      CA153: [8.2, 8.8, 8.5, 8.1],
      HP_C13: [null, 6.8, 1.6, null],
    },
    findings: {
      0: [{ key: "breast_hyperplasia", organ: "乳腺", severity: null, text: "双侧乳腺增生" }],
      1: [{ key: "breast_hyperplasia", organ: "乳腺", severity: null, text: "双侧乳腺增生" }],
      2: [{ key: "breast_hyperplasia", organ: "乳腺", severity: null, text: "双侧乳腺增生" }],
      3: [{ key: "breast_hyperplasia", organ: "乳腺", severity: null, text: "双侧乳腺增生" }],
    },
    interventions: [
      { category: "药物", title: "幽门螺杆菌根除治疗", description: "消化科开具的四联疗法，14天", startDate: "2024-07-01", endDate: "2024-07-14" },
      { category: "饮食", title: "多吃红肉和绿叶菜补铁", description: "每周3–4次红肉", startDate: "2024-06-01", endDate: null },
    ],
    measurements: [
      { code: "WEIGHT", value: 57.0, unit: "kg", date: "2025-01-12" },
      { code: "WEIGHT", value: 56.6, unit: "kg", date: "2025-09-20" },
    ],
  },
  {
    id: "demo-father",
    name: "张建国",
    relation: "父亲",
    sex: "male",
    birthDate: "1956-11-08",
    heightCm: 170,
    goals: ["senior", "lipid_cardio"],
    exams: ["2023-04-12", "2024-04-16", "2025-04-15", "2026-04-14"],
    values: {
      WEIGHT: [72.0, 73.0, 72.5, 71.8],
      BMI: [24.9, 25.3, 25.1, 24.8],
      WAIST: [91, 92, 91, 90],
      SBP: [146, 142, 136, 132],
      DBP: [88, 86, 82, 80],
      HR: [70, 72, 71, 69],
      WBC: [6.8, 7.0, 6.6, 6.9],
      RBC: [4.8, 4.7, 4.6, 4.6],
      HGB: [146, 144, 141, 139],
      PLT: [198, 205, 192, 188],
      U_PRO: NEG4,
      U_ACR: [18, 24, 32, 36],
      ALT: [22, 24, 26, 23],
      AST: [24, 25, 27, 24],
      GGT: [30, 32, 34, 31],
      TP: [72, 71, 71, 70],
      ALB: [43, 42, 42, 41],
      TBIL: [13.1, 14.0, 12.8, 12.2],
      CREA: [98, 104, 108, 112],
      UREA: [6.2, 6.6, 7.0, 7.3],
      CYSC: [1.02, 1.08, 1.15, 1.21],
      UA: [430, 445, 452, 468],
      TC: [5.82, 6.05, 5.21, 4.95],
      TG: [1.68, 1.75, 1.52, 1.46],
      HDL_C: [1.12, 1.08, 1.15, 1.18],
      LDL_C: [3.92, 4.12, 3.15, 2.86],
      APOA1: [1.18, 1.12, 1.2, 1.22],
      APOB: [1.08, 1.15, 0.92, 0.85],
      LPA: [260, null, 255, null],
      HSCRP: [1.5, 1.9, 1.4, 1.2],
      HCY: [14.2, 15.8, 16.3, 15.1],
      GLU: [5.9, 6.0, 6.2, 6.1],
      HBA1C: [5.9, 6.0, 6.2, 6.1],
      BMD_T: [-1.1, -1.2, -1.3, -1.4],
      CA: [2.28, 2.25, 2.3, 2.26],
      VITD: [22.5, 24.1, 21.8, 26.4],
      AFP: [3.2, 3.5, 3.4, 3.6],
      CEA: [3.1, 3.4, 3.6, 3.8],
      CA199: [12.5, 14.1, 13.2, 15.0],
      TPSA: [3.2, 3.8, 4.4, 4.9],
      FPSA: [0.72, 0.8, 0.92, 1.02],
    },
    findings: {
      0: [
        { key: "carotid_imt", organ: "颈动脉", severity: null, text: "双侧颈动脉内中膜增厚" },
        { key: "prostate_hyperplasia", organ: "前列腺", severity: null, text: "前列腺增生" },
      ],
      1: [
        { key: "carotid_plaque", organ: "颈动脉", severity: "6mm", text: "右侧颈动脉分叉处斑块形成，大小约 6×2mm" },
        { key: "prostate_hyperplasia", organ: "前列腺", severity: null, text: "前列腺增生" },
      ],
      2: [
        { key: "carotid_plaque", organ: "颈动脉", severity: "8mm", text: "右侧颈动脉分叉处斑块形成，大小约 8×2mm" },
        { key: "prostate_hyperplasia", organ: "前列腺", severity: null, text: "前列腺增生" },
        { key: "fundus_arteriosclerosis", organ: "眼", severity: "I级", text: "双眼眼底动脉硬化 I 级" },
      ],
      3: [
        { key: "carotid_plaque", organ: "颈动脉", severity: "8mm", text: "右侧颈动脉分叉处斑块形成，大小约 8×2mm，较前相仿" },
        { key: "prostate_hyperplasia", organ: "前列腺", severity: null, text: "前列腺增生" },
      ],
    },
    interventions: [
      { category: "药物", title: "阿托伐他汀", description: "心内科开具，每晚一次", startDate: "2024-06-01", endDate: null },
      { category: "饮食", title: "低盐饮食", description: "每日食盐控制在5克以内", startDate: "2024-09-01", endDate: null },
    ],
    measurements: [...bp("2025-01-10", 140, 85), ...bp("2025-06-15", 134, 82), ...bp("2025-12-20", 132, 80), ...bp("2026-07-18", 130, 78)],
  },
  {
    id: "demo-mother",
    name: "王秀英",
    relation: "母亲",
    sex: "female",
    birthDate: "1959-02-14",
    heightCm: 156,
    goals: ["senior"],
    exams: ["2023-04-12", "2024-04-16", "2025-04-15", "2026-04-14"],
    values: {
      WEIGHT: [55.0, 55.5, 54.8, 54.5],
      BMI: [22.6, 22.8, 22.5, 22.4],
      SBP: [128, 132, 130, 127],
      DBP: [78, 80, 79, 77],
      WBC: [5.6, 5.4, 5.8, 5.5],
      HGB: [125, 122, 124, 126],
      PLT: [220, 215, 225, 218],
      U_PRO: NEG4,
      ALT: [18, 19, 17, 18],
      AST: [21, 22, 20, 21],
      ALB: [42, 42, 41, 42],
      CREA: [62, 64, 63, 65],
      UREA: [5.2, 5.5, 5.4, 5.6],
      CYSC: [0.95, 0.98, 1.0, 1.02],
      UA: [320, 335, 328, 340],
      TC: [5.62, 5.78, 5.7, 5.55],
      TG: [1.42, 1.55, 1.48, 1.38],
      HDL_C: [1.42, 1.38, 1.4, 1.45],
      LDL_C: [3.35, 3.48, 3.42, 3.3],
      GLU: [5.3, 5.4, 5.5, 5.4],
      HBA1C: [5.7, 5.8, 5.8, 5.7],
      TSH: [3.1, 3.4, 3.6, 3.3],
      FT4: [14.1, 13.8, 13.5, 13.9],
      BMD_T: [-1.6, -1.9, -2.1, -2.2],
      CA: [2.22, 2.2, 2.24, 2.26],
      VITD: [18.2, 21.4, 26.3, 28.7],
      AFP: [2.5, 2.7, 2.6, 2.8],
      CEA: [2.0, 2.2, 2.1, 2.3],
      CA199: [9.8, 10.5, 11.2, 10.8],
      CA125: [10.2, 11.5, 10.8, 12.1],
      CA153: [9.1, 9.8, 10.2, 9.6],
    },
    findings: {
      0: [
        { key: "thyroid_nodule", organ: "甲状腺", severity: "TI-RADS 3类", text: "甲状腺右叶结节，TI-RADS 3类，大小约 6×5mm" },
        { key: "osteopenia", organ: "骨骼", severity: null, text: "骨量减少（腰椎）" },
      ],
      1: [
        { key: "thyroid_nodule", organ: "甲状腺", severity: "TI-RADS 3类", text: "甲状腺右叶结节，TI-RADS 3类，大小约 6×5mm" },
        { key: "osteopenia", organ: "骨骼", severity: null, text: "骨量减少（腰椎）" },
        { key: "renal_cyst", organ: "肾脏", severity: "12mm", text: "左肾囊肿，大小约 12mm" },
      ],
      2: [
        { key: "thyroid_nodule", organ: "甲状腺", severity: "TI-RADS 3类", text: "甲状腺右叶结节，TI-RADS 3类，大小约 7×5mm" },
        { key: "osteopenia", organ: "骨骼", severity: null, text: "骨量减少（腰椎及股骨颈）" },
        { key: "renal_cyst", organ: "肾脏", severity: "12mm", text: "左肾囊肿，大小约 12mm" },
      ],
      3: [
        { key: "thyroid_nodule", organ: "甲状腺", severity: "TI-RADS 3类", text: "甲状腺右叶结节，TI-RADS 3类，大小约 7×6mm" },
        { key: "osteopenia", organ: "骨骼", severity: null, text: "骨量减少（腰椎及股骨颈）" },
        { key: "renal_cyst", organ: "肾脏", severity: "13mm", text: "左肾囊肿，大小约 13mm" },
      ],
    },
    interventions: [
      { category: "药物", title: "钙片 + 维生素D3", description: "每日一次", startDate: "2024-05-01", endDate: null },
      { category: "运动", title: "每天散步30分钟、打太极", description: "", startDate: "2024-05-01", endDate: null },
    ],
    measurements: [],
  },
];

export interface SeedSummary {
  members: number;
  reports: number;
  results: number;
  findings: number;
  interventions: number;
  measurements: number;
}

/** Remove all demo rows and their files. Real data is never touched. */
export function clearDemoData(store: FamilyHealthStore): { members: number; reports: number } {
  const { members, reportIds } = store.clearDemo();
  for (const id of reportIds) deleteReportFiles(id);
  return { members, reports: reportIds.length };
}

/** Replace demo data with a fresh copy. Idempotent. */
export function seedDemoData(store: FamilyHealthStore): SeedSummary {
  clearDemoData(store);
  const summary: SeedSummary = { members: 0, reports: 0, results: 0, findings: 0, interventions: 0, measurements: 0 };
  for (const dm of DEMO_MEMBERS) {
    store.createMember({
      id: dm.id,
      name: dm.name,
      relation: dm.relation,
      sex: dm.sex,
      birthDate: dm.birthDate,
      heightCm: dm.heightCm,
      goals: dm.goals,
      notes: "演示数据",
      isDemo: true,
    });
    summary.members++;
    dm.exams.forEach((date, i) => {
      const reportId = `${dm.id}-${date.slice(0, 4)}`;
      store.createReport({ id: reportId, memberId: dm.id, examDate: date, provider: DEMO_PROVIDER, status: "confirmed", isDemo: true, confirmedAt: new Date(`${date}T12:00:00Z`) });
      summary.reports++;
      const rows: ResultInsert[] = [];
      for (const [code, series] of Object.entries(dm.values)) {
        const raw = series[i];
        if (raw == null) continue;
        const def = getIndicator(code);
        if (!def) continue;
        const parsed = parseResultValue(raw);
        const range = defaultRange(def, dm.sex);
        rows.push({
          reportId,
          memberId: dm.id,
          indicatorCode: code,
          rawName: def.zh,
          rawValue: String(raw),
          valueNum: parsed.num,
          valueText: parsed.qualitative,
          rawUnit: def.unit,
          unit: def.unit,
          refLow: range?.low ?? null,
          refHigh: range?.high ?? null,
          refText: def.valueType === "qualitative" ? "阴性" : formatRange(range) || null,
          flag: computeFlag({ value: parsed, def, sex: dm.sex }),
          section: CATEGORY_ZH[def.category],
          page: null,
          confidence: 1,
          source: "demo",
          confirmed: true,
          sortOrder: rows.length,
        });
      }
      store.insertResults(rows);
      summary.results += rows.length;
      const fs = (dm.findings[i] ?? []).map((f) => ({
        reportId,
        memberId: dm.id,
        examDate: date,
        organ: f.organ,
        findingKey: f.key,
        severity: f.severity,
        rawText: f.text,
        page: null,
        confirmed: true,
      }));
      store.insertFindings(fs);
      summary.findings += fs.length;
    });
    for (const iv of dm.interventions) {
      store.createIntervention({ memberId: dm.id, ...iv, createdVia: "demo" });
      summary.interventions++;
    }
    for (const m of dm.measurements) {
      store.createMeasurement({ memberId: dm.id, indicatorCode: m.code, value: m.value, unit: m.unit, rawValue: String(m.value), rawUnit: m.unit, measuredAt: m.date, note: m.note ?? "", createdVia: "demo" });
      summary.measurements++;
    }
  }
  return summary;
}
