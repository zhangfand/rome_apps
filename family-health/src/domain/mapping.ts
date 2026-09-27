/**
 * Deterministic mapping of a raw report row name onto a dictionary code.
 *
 * Strategy: generate lookup candidates from the raw name (full text, outside /
 * inside of brackets, bilingual halves, specimen prefixes stripped), normalize
 * each with `normalizeKey`, and look them up in an alias index. Some aliases
 * are shared by several indicators (`GLU` is both blood and urine glucose,
 * `中性粒细胞` is both the % and the absolute count); those are disambiguated
 * using the report section, the printed unit and whether the value is
 * qualitative. Anything still unknown is left for the LLM fallback.
 */
import { INDICATORS, getIndicator } from "./indicators.js";
import { nameCandidates, normalizeKey, normalizeWidth } from "./text.js";
import type { CategoryKey, IndicatorDef } from "./types.js";
import { isCompatibleUnit, normalizeUnit } from "./units.js";
import { isQualitativeText } from "./values.js";

const INDEX = new Map<string, string[]>();

function addKey(key: string, code: string) {
  if (!key) return;
  const list = INDEX.get(key);
  if (!list) INDEX.set(key, [code]);
  else if (!list.includes(code)) list.push(code);
}

for (const def of INDICATORS) {
  addKey(normalizeKey(def.code), def.code);
  addKey(normalizeKey(def.zh), def.code);
  addKey(normalizeKey(def.en), def.code);
  for (const a of def.aliases) addKey(normalizeKey(a), def.code);
}

/**
 * Alias keys that intentionally belong to several indicators. Anything else
 * shared is a bug (checked in tests and by the knowledge-base validator).
 */
export const ALLOWED_SHARED_ALIASES: Array<{ key: string; codes: string[]; why: string }> = [
  { key: "glu", codes: ["U_GLU", "GLU"], why: "血糖/尿糖：按分组（尿常规）和数值类型区分" },
  { key: "葡萄糖", codes: ["U_GLU", "GLU"], why: "血糖/尿糖：按分组和数值类型区分" },
  { key: "wbc", codes: ["WBC", "U_WBC", "U_WBC_MICRO"], why: "血白细胞/尿白细胞（试纸、镜检）：按分组、单位和数值类型区分" },
  { key: "白细胞", codes: ["WBC", "U_WBC", "U_WBC_MICRO"], why: "血白细胞/尿白细胞（试纸、镜检）：按分组、单位和数值类型区分" },
  { key: "尿白细胞", codes: ["U_WBC", "U_WBC_MICRO"], why: "尿白细胞试纸/镜检：按单位和数值类型区分" },
  { key: "rbc", codes: ["RBC", "U_RBC_MICRO"], why: "血/尿红细胞：按分组区分" },
  { key: "红细胞", codes: ["RBC", "U_RBC_MICRO"], why: "血/尿红细胞：按分组区分" },
  { key: "中性粒细胞", codes: ["NEUT_PCT", "NEUT"], why: "百分比/绝对值：按单位区分" },
  { key: "淋巴细胞", codes: ["LYMPH_PCT", "LYMPH"], why: "百分比/绝对值：按单位区分" },
  { key: "单核细胞", codes: ["MONO_PCT", "MONO"], why: "百分比/绝对值：按单位区分" },
  { key: "嗜酸性粒细胞", codes: ["EO_PCT", "EO"], why: "百分比/绝对值：按单位区分" },
  { key: "嗜碱性粒细胞", codes: ["BASO_PCT", "BASO"], why: "百分比/绝对值：按单位区分" },
  { key: "红细胞分布宽度", codes: ["RDW_CV", "RDW_SD"], why: "CV/SD：按单位区分" },
  { key: "红细胞体积分布宽度", codes: ["RDW_CV", "RDW_SD"], why: "CV/SD：按单位区分" },
  { key: "胆红素", codes: ["TBIL", "U_BIL"], why: "血清总胆红素/尿胆红素：按分组（尿常规）区分，无分组时按血清" },
  { key: "t值", codes: ["BMD_T", "QUS_T"], why: "双能X线骨密度/超声骨密度：按分组（超声骨密度）区分" },
  { key: "z值", codes: ["BMD_Z", "QUS_Z"], why: "双能X线骨密度/超声骨密度：按分组区分" },
  { key: "tscore", codes: ["BMD_T", "QUS_T"], why: "双能X线骨密度/超声骨密度：按分组区分" },
  { key: "zscore", codes: ["BMD_Z", "QUS_Z"], why: "双能X线骨密度/超声骨密度：按分组区分" },
];

/** Alias keys that intentionally point at more than one indicator. */
export function ambiguousAliasKeys(): Array<{ key: string; codes: string[] }> {
  return [...INDEX.entries()].filter(([, codes]) => codes.length > 1).map(([key, codes]) => ({ key, codes }));
}

export interface MappingHints {
  /** Report section heading the row appeared under, e.g. `尿常规`, `肝功能`. */
  section?: string | null;
  /** Unit printed on the report row. */
  unit?: string | null;
  /** Raw printed value (used to tell qualitative from numeric rows). */
  value?: string | null;
}

export type MatchKind = "exact" | "candidate" | "ambiguous";

export interface MappingResult {
  code: string;
  kind: MatchKind;
  /** Which candidate string produced the hit. */
  matched: string;
  /** Other codes the alias could have meant (only for `ambiguous`). */
  alternatives?: string[];
}

const SECTION_PATTERNS: Array<[RegExp, CategoryKey]> = [
  // Instrument sections first: their names contain words (骨密度, 血管…) that lab patterns would also catch.
  [/心电图|心电|ecg|ekg/i, "ecg"],
  [/心脏彩超|超声心动|心脏超声|心动图|echo/i, "echo"],
  [/动脉硬化|血管硬化|脉搏波|踝臂|pwv|abi/i, "arterial"],
  [/经颅多普勒|经颅|tcd/i, "tcd"],
  [/超声骨密度|骨超声|定量超声|跟骨|qus/i, "bone_qus"],
  [/眼科|视力/i, "eye"],
  [/尿(常规|液|沉渣|分析)|尿检|urine/i, "urine"],
  [/血常规|血细胞|全血细胞|cbc/i, "blood_routine"],
  [/肝功|肝脏|liver/i, "liver"],
  [/肾功|肾脏|kidney|renal/i, "kidney"],
  [/^尿酸$|痛风|uric/i, "uric_acid"],
  [/血脂|脂类|lipid/i, "lipid"],
  [/血糖|糖代谢|糖尿病|glucose/i, "glucose"],
  [/甲功|甲状腺|thyroid/i, "thyroid"],
  [/肿瘤|tumou?r/i, "tumor"],
  [/凝血|coag/i, "coag"],
  [/电解质|electrolyte/i, "electrolyte"],
  [/骨密度|骨代谢/i, "bone"],
  [/一般检查|体格|体成分|人体成分/i, "general"],
];

export function sectionCategory(section: string | null | undefined): CategoryKey | undefined {
  if (!section) return undefined;
  for (const [re, cat] of SECTION_PATTERNS) if (re.test(section)) return cat;
  return undefined;
}

function disambiguate(codes: string[], hints: MappingHints): { code: string; resolved: boolean } {
  let pool: IndicatorDef[] = codes.map((c) => getIndicator(c)).filter((d): d is IndicatorDef => Boolean(d));
  const narrowed = (next: IndicatorDef[]) => {
    if (next.length > 0) pool = next;
  };

  const cat = sectionCategory(hints.section);
  if (cat) narrowed(pool.filter((d) => d.category === cat));

  const unit = normalizeUnit(hints.unit);
  if (unit) {
    narrowed(pool.filter((d) => d.valueType === "numeric" && isCompatibleUnit(unit, d)));
  }

  const value = hints.value?.trim();
  if (value) {
    const qualitative = isQualitativeText(value);
    narrowed(pool.filter((d) => (qualitative ? d.valueType === "qualitative" : d.valueType === "numeric")));
  }

  if (pool.length > 1 && !cat) {
    // Without a section hint prefer serum/blood tests over urine tests.
    narrowed(pool.filter((d) => d.category !== "urine"));
  }
  return { code: pool[0].code, resolved: pool.length === 1 };
}

/**
 * Instrument-based categories (心电图、心脏彩超…). Their parameter names reuse
 * short letters that are also lab codes (P, T, LA, PI…), so matches into and
 * out of these categories are fenced — see `allowedByContext`.
 */
export const INSTRUMENT_CATEGORIES: ReadonlySet<CategoryKey> = new Set(["ecg", "echo", "arterial", "tcd", "bone_qus", "eye"]);

/** Other categories a code may come from when the row sits in an instrument section. */
const SECTION_EXTRA: Partial<Record<CategoryKey, CategoryKey[]>> = {
  ecg: ["general"], // 心率
  arterial: ["general"], // 脉搏
  echo: ["general"],
};

/**
 * Words that mark a name as an instrument parameter (ECG intervals/axes, echo
 * dimensions, Doppler velocities, QUS…). A name containing one of them may
 * only map into an instrument category — never to a lab analyte such as 血磷 P.
 */
export const INSTRUMENT_CONTEXT_RE = /电轴|axis|[a-z\u4e00-\u9fff]?波|间期|时限|间隔|interval|duration|振幅|电压|内径|厚度|射血|缩短率|流速|搏动指数|阻力指数|深度|声速|衰减|视力/i;

/** Latin-led tokens of ≤3 characters (P, K, CA, NA, TT, PT, HR, T3, RV5…): matched only as whole, corroborated tokens. */
export function isShortToken(key: string): boolean {
  return /^[a-z][a-z0-9%#+]{0,2}$/.test(key);
}

/** Words ignored when checking what is left of a name after removing a short token. */
const NOISE_RE = /血清|血浆|全血|测定|检测|定量|浓度|含量|水平|结果|值|左侧|右侧|[左右]/g;

/** Generic laboratory section headings that do not name a specific category (生化, 免疫, 检验…). */
const LAB_SECTION_RE = /生化|检验|化验|免疫|血清|血液|体液|实验室|lab/i;

function allowedByContext(def: IndicatorDef, rawName: string, sectionCat: CategoryKey | undefined, section?: string | null): boolean {
  const instrument = INSTRUMENT_CATEGORIES.has(def.category);
  const labSection = sectionCat ? !INSTRUMENT_CATEGORIES.has(sectionCat) : !!section && LAB_SECTION_RE.test(section);
  if (sectionCat && INSTRUMENT_CATEGORIES.has(sectionCat)) {
    // Inside an instrument section only that section's own codes (plus e.g. 心率) are allowed.
    if (def.category !== sectionCat && !(SECTION_EXTRA[sectionCat] ?? []).includes(def.category)) return false;
  } else if (labSection && instrument) {
    // A lab/general section never yields an instrument parameter.
    return false;
  }
  if (!instrument && INSTRUMENT_CONTEXT_RE.test(normalizeWidth(rawName))) return false;
  return true;
}

/** Whether a code may be used for a row with this name and section (same fences as `mapIndicator`). */
export function contextAllows(def: IndicatorDef, rawName: string, section: string | null | undefined): boolean {
  return allowedByContext(def, rawName, sectionCategory(section), section);
}

function lookup(rawName: string, hints: MappingHints, opts: { allowShortDerived: boolean }): MappingResult | null {
  if (!rawName || !rawName.trim()) return null;
  const sectionCat = sectionCategory(hints.section);
  const candidates = nameCandidates(rawName);
  const fullKey = normalizeKey(rawName);
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const key = normalizeKey(cand);
    const found = INDEX.get(key);
    if (!found || found.length === 0) continue;
    const codes = found.filter((c) => {
      const def = getIndicator(c);
      return !!def && allowedByContext(def, rawName, sectionCat, hints.section);
    });
    if (codes.length === 0) continue;
    // A short token split out of a longer name (the "P" in "P电轴") must be corroborated
    // by the rest of the name, or it is ignored.
    if (i > 0 && key !== fullKey && isShortToken(key)) {
      if (!opts.allowShortDerived) continue;
      const rest = fullKey.replace(key, "").replace(NOISE_RE, "");
      if (rest) {
        const other = lookup(rest, hints, { allowShortDerived: false });
        if (!other || !codes.includes(other.code)) continue;
        return { code: other.code, kind: "candidate", matched: cand };
      }
    }
    if (codes.length === 1) {
      return { code: codes[0], kind: i === 0 ? "exact" : "candidate", matched: cand };
    }
    const { code, resolved } = disambiguate(codes, hints);
    return resolved
      ? { code, kind: i === 0 ? "exact" : "candidate", matched: cand }
      : { code, kind: "ambiguous", matched: cand, alternatives: codes.filter((c) => c !== code) };
  }
  return null;
}

/**
 * Map a raw indicator name to a dictionary code, or `null` when unknown.
 * `kind` is `ambiguous` when several indicators remained plausible after
 * applying the hints (the first is returned; the reviewer can correct it).
 *
 * Collision guards (P电轴 must never become 血磷 P):
 * - short Latin tokens split out of a longer name need the rest of the name to
 *   point at the same indicator;
 * - names with instrument words (电轴/间期/内径/流速…) only map into
 *   instrument categories;
 * - rows in an instrument section (心电图/心脏彩超/…) only map to that
 *   section's codes, and lab sections never map to instrument codes.
 */
export function mapIndicator(rawName: string, hints: MappingHints = {}): MappingResult | null {
  return lookup(rawName, hints, { allowShortDerived: true });
}

/**
 * Search the dictionary for the reviewer's mapping dropdown: substring match
 * on code, Chinese / English name and aliases, best matches first.
 */
export function searchIndicators(query: string, limit = 20): IndicatorDef[] {
  const q = normalizeKey(query);
  if (!q) return INDICATORS.slice(0, limit);
  const scored: Array<{ def: IndicatorDef; score: number }> = [];
  for (const def of INDICATORS) {
    const keys = [def.code, def.zh, def.en, ...def.aliases].map(normalizeKey);
    let score = 0;
    for (const k of keys) {
      if (k === q) score = Math.max(score, 3);
      else if (k.startsWith(q)) score = Math.max(score, 2);
      else if (k.includes(q)) score = Math.max(score, 1);
    }
    if (score > 0) scored.push({ def, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.def);
}
