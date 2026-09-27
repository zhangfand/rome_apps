/**
 * Schema for the reviewable indicator knowledge base under `src/data/`:
 *
 *   sources.ts     – every standard / guideline / code system we cite
 *   indicators.ts  – the indicator dictionary (names, aliases, units, LOINC,
 *                    candidate reference ranges with sources)
 *   thresholds.ts  – decision thresholds (BMI categories, BP grades, …), kept
 *                    separate from reference ranges
 *
 * Rules enforced by `validateKnowledgeBase` (run in tests):
 * - every range / threshold that carries a number cites a source whose level
 *   is not `unverified`;
 * - an `unverified` range or threshold carries no numbers (it only marks a gap);
 * - every sourceId exists;
 * - aliases do not collide across indicators except where explicitly allowed.
 *
 * The pre-research numeric fallback ranges live in `legacyRef` (see
 * indicators.ts) with the `legacy-unverified` source: they keep the app's
 * flags working until verified ranges arrive, and the UI labels them 未核实.
 */
import { z } from "@rome-os/app-runtime";

export const LEVELS = ["national_cn", "international", "cn_guideline", "cn_consensus", "intl_guideline", "report", "unverified"] as const;
export type SourceLevel = (typeof LEVELS)[number];

export const SCOPES = ["code", "name", "reference_range", "decision_threshold", "explanation"] as const;
export type SourceScope = (typeof SCOPES)[number];

const AgeSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    /** Inclusive upper age bound by default. */
    maxInclusive: z.boolean().optional(),
  })
  .strict();

export const PopulationSchema = z
  .object({
    sex: z.enum(["male", "female"]).optional(),
    age: AgeSchema.optional(),
    pregnancy: z.boolean().optional(),
    /**
     * A clinical condition the candidate is restricted to (e.g. 高血压患者,
     * 痛风患者). The app does not track diagnoses, so condition-specific
     * candidates never apply automatically; 指标库 still shows them.
     */
    condition: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export type Population = z.infer<typeof PopulationSchema>;

export const SourceSchema = z
  .object({
    id: z.string().min(1),
    org: z.string().min(1),
    /** Title in its original language. */
    title: z.string().min(1),
    /** Standard number + version/year, LOINC version, guideline year… */
    identifier: z.string().min(1),
    locator: z.string().optional(),
    url: z.string().url().optional(),
    scope: z.array(z.enum(SCOPES)).min(1),
    population: PopulationSchema.optional(),
    level: z.enum(LEVELS),
    /** Date the source was retrieved / checked (YYYY-MM-DD). */
    retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    verifiedVia: z.enum(["primary", "secondary"]).optional(),
    evidenceQuote: z.string().optional(),
    /** Current status of a standard / guideline, e.g. 现行 (实施 2013-08-01). */
    status: z.string().optional(),
    /** Research notes: how it was read (text layer / scanned image / mirror), caveats. */
    notes: z.string().optional(),
  })
  .strict();
export type Source = z.infer<typeof SourceSchema>;

export const RangeCandidateSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal("reference"),
    level: z.enum(LEVELS),
    population: PopulationSchema.default({}),
    low: z.number().optional(),
    high: z.number().optional(),
    lowInclusive: z.boolean().optional(),
    highInclusive: z.boolean().optional(),
    /** Unit the bounds are expressed in; must be convertible to the indicator's canonical unit. */
    unit: z.string(),
    sourceId: z.string().min(1),
    locator: z.string().optional(),
    /** e.g. 检测方法 / 试剂 / 标本类型 that the range depends on. */
    conditions: z.string().optional(),
    /** Verbatim text (or table cells) of the source that gives these numbers. */
    evidenceQuote: z.string().optional(),
  })
  .strict();
export type RangeCandidate = z.infer<typeof RangeCandidateSchema>;
export type RangeCandidateInput = z.input<typeof RangeCandidateSchema>;

export const ConflictSchema = z
  .object({
    note_zh: z.string().min(1),
    nationalRangeId: z.string().optional(),
    internationalRangeId: z.string().optional(),
    resolution: z.string().min(1),
  })
  .strict();
export type Conflict = z.infer<typeof ConflictSchema>;

const NumericRangeSchema = z
  .object({ low: z.number().optional(), high: z.number().optional(), lowInclusive: z.boolean().optional(), highInclusive: z.boolean().optional() })
  .strict();
const SexRangeSchema = z.union([NumericRangeSchema, z.object({ male: NumericRangeSchema, female: NumericRangeSchema }).strict()]);

export const CATEGORY_KEYS = [
  "general",
  "blood_routine",
  "urine",
  "liver",
  "kidney",
  "uric_acid",
  "lipid",
  "glucose",
  "thyroid",
  "tumor",
  "bone",
  "bone_qus",
  "coag",
  "electrolyte",
  "cardio",
  "vitamin",
  "infection",
  "digestive",
  "ecg",
  "echo",
  "arterial",
  "tcd",
  "eye",
] as const;

export const IndicatorEntrySchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    zh: z.string().min(1),
    en: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    category: z.enum(CATEGORY_KEYS),
    unit: z.string(),
    valueType: z.enum(["numeric", "qualitative"]),
    conversions: z.array(z.object({ unit: z.string(), factor: z.number(), offset: z.number().optional() }).strict()).optional(),
    direction: z.enum(["higher_worse", "lower_worse", "both", "qualitative", "info"]),
    decimals: z.number().int().optional(),
    sex: z.enum(["male", "female"]).optional(),
    derived: z.boolean().optional(),
    qualitativeNormal: z.array(z.string()).optional(),
    /** Left/right measurement (动脉硬化、经颅多普勒、视力…). */
    side: z.enum(["L", "R"]).optional(),
    explain: z.object({ text: z.string().min(1), sourceId: z.string().min(1) }).strict(),
    loinc: z.object({ code: z.string().regex(/^\d{1,7}-\d$/), longName: z.string().min(1), zhName: z.string().optional(), sourceId: z.string().min(1) }).strict().optional(),
    /** Candidate reference ranges, each with its own source. */
    ranges: z.array(RangeCandidateSchema).default([]),
    conflict: ConflictSchema.optional(),
    /**
     * Pre-research fallback range (numbers from the original dictionary, NOT
     * verified). Used only when neither the report nor a verified range gives
     * one; always shown as 未核实.
     */
    legacyRef: SexRangeSchema.optional(),
    legacyRefSourceId: z.string().optional(),
  })
  .strict();
export type IndicatorEntry = z.infer<typeof IndicatorEntrySchema>;
export type IndicatorEntryInput = z.input<typeof IndicatorEntrySchema>;

const Inclusivity = z.enum(["[)", "(]", "[]", "()"]);

const ThresholdBoundsSchema = z.object({ low: z.number().optional(), high: z.number().optional(), inclusivity: Inclusivity.optional() }).strict();

export const ThresholdCategorySchema = z
  .object({
    label_zh: z.string().min(1),
    /** Single-indicator bounds. `inclusivity` defaults to "[)" (low ≤ v < high). */
    low: z.number().optional(),
    high: z.number().optional(),
    inclusivity: Inclusivity.optional(),
    /** Multi-indicator thresholds (e.g. BP: SBP and DBP): per-code bounds; the higher-ranked category wins. */
    bounds: z.record(z.string(), ThresholdBoundsSchema).optional(),
    severity: z.enum(["normal", "info", "mild", "moderate", "severe"]),
    /** Ordering for "highest category wins"; defaults to the category's index. */
    rank: z.number().optional(),
    note_zh: z.string().optional(),
  })
  .strict();
export type ThresholdCategory = z.infer<typeof ThresholdCategorySchema>;

export const ThresholdSchema = z
  .object({
    id: z.string().min(1),
    indicatorCodes: z.array(z.string().min(1)).min(1),
    name_zh: z.string().min(1),
    /** `category`: classifies a value; `target`: informational treatment target (e.g. LDL-C 目标值). */
    kind: z.enum(["category", "target"]).default("category"),
    unit: z.string(),
    population: PopulationSchema.default({}),
    categories: z.array(ThresholdCategorySchema).min(1),
    sourceId: z.string().min(1),
    locator: z.string().optional(),
    level: z.enum(LEVELS),
    /** This threshold is the international alternative of another one (shown secondary). */
    alternativeOf: z.string().optional(),
    /** Verbatim text (or table cells) of the source that gives these cut-points. */
    evidenceQuote: z.string().optional(),
  })
  .strict();
export type Threshold = z.infer<typeof ThresholdSchema>;
export type ThresholdInput = z.input<typeof ThresholdSchema>;

// ------------------------------------------------------------------ validation

export interface KnowledgeBase {
  sources: Source[];
  indicators: IndicatorEntryInput[];
  thresholds: ThresholdInput[];
  /** Optional sourceIds referenced by critical-value rules. */
  criticalSourceIds?: string[];
}

/** Alias keys that may legitimately belong to several indicators, disambiguated by section/unit/value type. */
export interface AllowedSharedAlias {
  key: string;
  codes: string[];
  why: string;
}

const hasNumbers = (x: { low?: number; high?: number }) => x.low != null || x.high != null;
const categoryHasNumbers = (c: ThresholdCategory) => c.low != null || c.high != null || Object.values(c.bounds ?? {}).some(hasNumbers);

/**
 * Validate the knowledge base. Returns human-readable problems (empty = valid).
 * `normalizeKey` is injected so this module stays free of domain imports.
 */
export function validateKnowledgeBase(
  kb: KnowledgeBase,
  opts: { normalizeKey: (s: string) => string; allowedShared: AllowedSharedAlias[]; unitCompatible?: (unit: string, entry: IndicatorEntry) => boolean },
): string[] {
  const problems: string[] = [];
  const sources = new Map<string, Source>();
  for (const s of kb.sources) {
    const parsed = SourceSchema.safeParse(s);
    if (!parsed.success) problems.push(`source ${s.id}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    if (sources.has(s.id)) problems.push(`duplicate source id ${s.id}`);
    sources.set(s.id, s);
  }
  const levelOf = (id: string) => sources.get(id)?.level;
  const needSource = (where: string, id: string | undefined) => {
    if (id && !sources.has(id)) problems.push(`${where}: unknown sourceId ${id}`);
  };

  const codes = new Set<string>();
  const entries: IndicatorEntry[] = [];
  for (const raw of kb.indicators) {
    const parsed = IndicatorEntrySchema.safeParse(raw);
    if (!parsed.success) {
      problems.push(`indicator ${raw.code}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    const e = parsed.data;
    entries.push(e);
    if (codes.has(e.code)) problems.push(`duplicate indicator code ${e.code}`);
    codes.add(e.code);
    needSource(`${e.code}.explain`, e.explain.sourceId);
    if (e.loinc) {
      needSource(`${e.code}.loinc`, e.loinc.sourceId);
      if (levelOf(e.loinc.sourceId) === "unverified") problems.push(`${e.code}.loinc cites an unverified source`);
    }
    if (e.legacyRef) {
      if (!e.legacyRefSourceId) problems.push(`${e.code}.legacyRef needs legacyRefSourceId`);
      needSource(`${e.code}.legacyRef`, e.legacyRefSourceId);
    }
    const rangeIds = new Set<string>();
    for (const r of e.ranges) {
      const where = `${e.code}.ranges.${r.id}`;
      if (rangeIds.has(r.id)) problems.push(`${where}: duplicate range id`);
      rangeIds.add(r.id);
      needSource(where, r.sourceId);
      const srcLevel = levelOf(r.sourceId);
      if (hasNumbers(r)) {
        if (r.level === "unverified" || srcLevel === "unverified") problems.push(`${where}: numeric range must cite a verified source (level ≠ unverified)`);
        if (r.level === "report") problems.push(`${where}: report-level ranges come from reports, not the dictionary`);
        if (srcLevel && srcLevel !== r.level) problems.push(`${where}: level ${r.level} ≠ source level ${srcLevel}`);
        if (opts.unitCompatible && !opts.unitCompatible(r.unit, e)) problems.push(`${where}: unit ${r.unit} not convertible to ${e.unit || "(unitless)"}`);
      } else if (r.level !== "unverified") {
        problems.push(`${where}: a range without numbers must be level unverified`);
      }
    }
    if (e.conflict) {
      for (const id of [e.conflict.nationalRangeId, e.conflict.internationalRangeId]) {
        if (id && !rangeIds.has(id)) problems.push(`${e.code}.conflict references unknown range ${id}`);
      }
    }
  }

  // Alias collisions across indicators (normalized), except allow-listed ones.
  const owners = new Map<string, Set<string>>();
  for (const e of entries) {
    for (const a of [e.code, e.zh, e.en, ...e.aliases]) {
      const k = opts.normalizeKey(a);
      if (!k) continue;
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k)!.add(e.code);
    }
  }
  const allowed = new Map(opts.allowedShared.map((a) => [a.key, new Set(a.codes)]));
  for (const [k, set] of owners) {
    if (set.size < 2) continue;
    const ok = allowed.get(k);
    const extra = [...set].filter((c) => !ok?.has(c));
    if (!ok || extra.length) problems.push(`alias "${k}" shared by ${[...set].join(", ")} (not allow-listed)`);
  }

  const thresholdIds = new Set<string>();
  for (const raw of kb.thresholds) {
    const parsed = ThresholdSchema.safeParse(raw);
    if (!parsed.success) {
      problems.push(`threshold ${raw.id}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    const t = parsed.data;
    const where = `threshold ${t.id}`;
    if (thresholdIds.has(t.id)) problems.push(`${where}: duplicate id`);
    thresholdIds.add(t.id);
    needSource(where, t.sourceId);
    for (const c of t.indicatorCodes) if (!codes.has(c)) problems.push(`${where}: unknown indicator ${c}`);
    const numeric = t.categories.some(categoryHasNumbers);
    const srcLevel = levelOf(t.sourceId);
    if (numeric && (t.level === "unverified" || srcLevel === "unverified")) problems.push(`${where}: numeric threshold must cite a verified source`);
    if (!numeric && t.level !== "unverified") problems.push(`${where}: a threshold without numbers must be level unverified`);
    if (srcLevel && srcLevel !== t.level) problems.push(`${where}: level ${t.level} ≠ source level ${srcLevel}`);
  }
  for (const raw of kb.thresholds) {
    if (raw.alternativeOf && !thresholdIds.has(raw.alternativeOf)) problems.push(`threshold ${raw.id}: alternativeOf unknown ${raw.alternativeOf}`);
  }
  for (const id of kb.criticalSourceIds ?? []) needSource("critical rule", id);
  return problems;
}
