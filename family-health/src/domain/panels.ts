/**
 * Goal panels: curated indicator sets a member can pin (减重/代谢, 血脂/心血管,
 * 肝功能/脂肪肝, 老人常规). Each panel lists indicator codes (some computed)
 * and finding keys to track over time.
 */
import { getIndicator } from "./indicators.js";
import type { IndicatorDef, Sex } from "./types.js";

export type PanelKey = "weight_metabolic" | "lipid_cardio" | "liver" | "senior";

export interface PanelItem {
  code: string;
  /** Only shown for this sex. */
  sex?: Sex;
}

export interface GoalPanel {
  key: PanelKey;
  zh: string;
  description: string;
  items: PanelItem[];
  findings: string[];
}

const items = (...codes: string[]): PanelItem[] => codes.map((code) => ({ code }));

export const GOAL_PANELS: GoalPanel[] = [
  {
    key: "weight_metabolic",
    zh: "减重/代谢",
    description: "体重、腰围、血糖、胰岛素抵抗、血脂、肝酶和尿酸，适合关注减重和代谢健康。",
    items: items(
      "WEIGHT", "BMI", "WAIST", "BODY_FAT", "SBP", "DBP", "GLU", "HBA1C", "INS", "HOMA_IR",
      "TG", "HDL_C", "LDL_C", "ALT", "GGT", "UA",
    ),
    findings: ["fatty_liver"],
  },
  {
    key: "lipid_cardio",
    zh: "血脂/心血管",
    description: "血脂全套、载脂蛋白、Lp(a)、炎症指标和血压，关注心脑血管风险。",
    items: items("TC", "TG", "HDL_C", "LDL_C", "NON_HDL_C", "APOA1", "APOB", "LPA", "HSCRP", "HCY", "SBP", "DBP"),
    findings: ["carotid_plaque", "carotid_imt"],
  },
  {
    key: "liver",
    zh: "肝功能/脂肪肝",
    description: "转氨酶、胆红素、蛋白，以及脂肪肝和胆囊的超声结论。",
    items: items("ALT", "AST", "GGT", "ALP", "TBIL", "DBIL", "ALB", "GLB", "AG_RATIO"),
    findings: ["fatty_liver", "gallbladder_polyp", "gallstone"],
  },
  {
    key: "senior",
    zh: "老人常规",
    description: "肾功能、骨密度、维生素D、常见肿瘤标志物和贫血、血糖，适合老人年度复查。",
    items: [
      ...items("CREA", "EGFR", "UREA", "UA", "CYSC", "U_PRO", "BMD_T", "CA", "VITD", "AFP", "CEA", "CA199"),
      { code: "TPSA", sex: "male" },
      { code: "CA125", sex: "female" },
      { code: "CA153", sex: "female" },
      ...items("HGB", "GLU"),
    ],
    findings: ["osteoporosis", "carotid_plaque"],
  },
];

export const PANEL_KEYS = GOAL_PANELS.map((p) => p.key);

export function getPanel(key: string): GoalPanel | undefined {
  return GOAL_PANELS.find((p) => p.key === key);
}

/** Panel indicators applicable to a member's sex (unknown sex keeps everything). */
export function panelIndicators(key: string, sex?: Sex | null): IndicatorDef[] {
  const panel = getPanel(key);
  if (!panel) return [];
  return panel.items
    .filter((it) => !it.sex || !sex || it.sex === sex)
    .map((it) => getIndicator(it.code))
    .filter((d): d is IndicatorDef => Boolean(d));
}

/** Keep only known panel keys (for validating member.goals input). */
export function sanitizeGoals(goals: unknown): PanelKey[] {
  if (!Array.isArray(goals)) return [];
  const out: PanelKey[] = [];
  for (const g of goals) if (typeof g === "string" && (PANEL_KEYS as string[]).includes(g) && !out.includes(g as PanelKey)) out.push(g as PanelKey);
  return out;
}
