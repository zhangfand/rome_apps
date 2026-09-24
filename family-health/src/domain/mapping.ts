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
import { nameCandidates, normalizeKey } from "./text.js";
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
  [/尿(常规|液|沉渣|分析)|尿检|urine/i, "urine"],
  [/血常规|血细胞|全血细胞|cbc/i, "blood_routine"],
  [/肝功|肝脏|liver/i, "liver"],
  [/肾功|肾脏|kidney|renal/i, "kidney"],
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
 * Map a raw indicator name to a dictionary code, or `null` when unknown.
 * `kind` is `ambiguous` when several indicators remained plausible after
 * applying the hints (the first is returned; the reviewer can correct it).
 */
export function mapIndicator(rawName: string, hints: MappingHints = {}): MappingResult | null {
  if (!rawName || !rawName.trim()) return null;
  const candidates = nameCandidates(rawName);
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const codes = INDEX.get(normalizeKey(cand));
    if (!codes || codes.length === 0) continue;
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
