/** Response shapes of the 家庭体检助手 API (mirrors src/api + src/lib read models). */

export type Flag = "H" | "L" | "normal" | "abnormal";
export type Trend = "better" | "worse" | "flat" | "changed";
export type ReportStatus = "uploaded" | "extracting" | "needs_review" | "confirmed" | "failed";

export interface Member {
  id: string;
  name: string;
  relation: string;
  sex: "male" | "female" | null;
  birthDate: string | null;
  age: number | null;
  heightCm: number | null;
  goals: string[];
  notes: string;
  isDemo: boolean;
}

export interface CriticalAlert {
  code: string;
  name: string;
  level: "urgent" | "soon";
  value: number;
  unit: string;
  message: string;
}

export interface FindingAlert {
  findingKey: string;
  level: "urgent" | "soon";
  message: string;
}

export interface Intervention {
  id: string;
  memberId: string;
  category: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string | null;
  createdVia: string;
}

export interface MemberOverview {
  latestExamDate: string | null;
  latestReportId: string | null;
  examCount: number;
  abnormalCount: number;
  abnormal: Array<{ code: string; name: string; value: number | null; valueText: string | null; unit: string; flag: Flag | null }>;
  topChanges: Array<{ code: string; name: string; unit: string; previous: number; latest: number; delta: number; pct: number; trend: Trend }>;
  alerts: CriticalAlert[];
  findingAlerts: FindingAlert[];
}

export interface MemberCard {
  member: Member;
  overview: MemberOverview;
  pendingReports: number;
  activeInterventions: Intervention[];
}

export interface Report {
  id: string;
  memberId: string;
  examDate: string | null;
  provider: string;
  status: ReportStatus;
  stale: boolean;
  error: string | null;
  pagesDone: number;
  pagesTotal: number;
  isDemo: boolean;
  files: Array<{ name: string; mime: string; size: number }>;
  pages: Array<{ page: number; url: string; width: number; height: number; sourceIndex: number; skipped?: boolean }>;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NumericRange {
  low?: number;
  high?: number;
  lowInclusive?: boolean;
  highInclusive?: boolean;
}

export interface SeriesPoint {
  date: string;
  value: number | null;
  valueText: string | null;
  unit: string;
  flag: Flag | null;
  source: "report" | "derived" | "measurement";
  reportId?: string;
  resultId?: string;
  measurementId?: string;
  page?: number | null;
  provider?: string;
  note?: string;
  provenance?: Provenance;
}

// ------------------------------------------------------------------ provenance

export type SourceLevel = "national_cn" | "international" | "cn_guideline" | "cn_consensus" | "intl_guideline" | "report" | "unverified";

export interface PopulationInfo {
  sex?: "male" | "female";
  age?: { min?: number; max?: number; maxInclusive?: boolean };
  pregnancy?: boolean;
  note?: string;
}

export interface SourceInfo {
  id: string;
  org: string;
  title: string;
  identifier: string;
  locator?: string;
  url?: string;
  scope: string[];
  population?: PopulationInfo;
  level: SourceLevel;
  retrieved: string;
  verifiedVia?: "primary" | "secondary";
  evidenceQuote?: string;
  levelZh?: string;
  usedBy?: number;
}

export interface ResolvedRange {
  id: string;
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  unit: string;
  level: SourceLevel;
  levelZh: string;
  source: SourceInfo | null;
  locator: string | null;
  population: PopulationInfo | null;
  conditions: string | null;
  text: string | null;
  textUnit?: string | null;
}

export interface ThresholdScaleItem {
  label_zh: string;
  low: number | null;
  high: number | null;
  inclusivity: string;
  bounds?: Record<string, { low?: number; high?: number; inclusivity?: string }>;
}

export interface ThresholdHit {
  thresholdId: string;
  name_zh: string;
  kind: "category" | "target";
  label_zh: string;
  severity: "normal" | "info" | "mild" | "moderate" | "severe";
  rank: number;
  note_zh: string | null;
  level: SourceLevel;
  levelZh: string;
  source: SourceInfo | null;
  locator: string | null;
  alternativeOf: string | null;
  decidedBy: string[];
  scale: ThresholdScaleItem[];
  unit: string;
}

export interface Provenance {
  flag: Flag | null;
  basis: "report" | "standard" | "legacy" | "none";
  reason_zh: string;
  usedRange: ResolvedRange | null;
  reportRange: ResolvedRange | null;
  standard: {
    primary: ResolvedRange | null;
    alternatives: ResolvedRange[];
    conflict: { note_zh: string; resolution: string; national: ResolvedRange; international: ResolvedRange } | null;
    legacy: ResolvedRange | null;
  } | null;
  marker: "H" | "L" | "abnormal" | null;
  labVerdict: "H" | "L" | "normal" | "abnormal" | null;
  standardVerdict: "H" | "L" | "normal" | null;
  disagreement: boolean;
  thresholds: { primary: ThresholdHit | null; alternatives: ThresholdHit[]; targets: ThresholdHit[] };
  loinc: { code: string; longName: string; zhName?: string; source: SourceInfo | null } | null;
  loincAttribution: string | null;
}

export interface RangeCandidateInfo {
  id: string;
  kind: "reference";
  level: SourceLevel;
  population: PopulationInfo;
  low?: number;
  high?: number;
  lowInclusive?: boolean;
  highInclusive?: boolean;
  unit: string;
  sourceId: string;
  locator?: string;
  conditions?: string;
}

export interface LibraryEntry {
  code: string;
  zh: string;
  en: string;
  aliases: string[];
  category: string;
  categoryZh: string;
  unit: string;
  valueType: string;
  direction: string;
  conversions: Array<{ unit: string; factor: number; offset?: number }>;
  side: "L" | "R" | null;
  sex: "male" | "female" | null;
  derived: boolean;
  explain: { text: string; source: SourceInfo | null };
  loinc: { code: string; longName: string; zhName?: string; sourceId: string; source: SourceInfo | null } | null;
  ranges: Array<{ candidate: RangeCandidateInfo; resolved: ResolvedRange | null; source: SourceInfo | null; levelZh: string }>;
  conflict: { note_zh: string; nationalRangeId?: string; internationalRangeId?: string; resolution: string } | null;
  legacy: { ranges: Array<{ sex: "male" | "female" | null; range: NumericRange }>; source: SourceInfo | null } | null;
  thresholds: Array<{ id: string; name_zh: string; kind: string; unit: string; population: PopulationInfo; categories: ThresholdScaleItem[]; level: SourceLevel; levelZh: string; locator?: string; alternativeOf?: string; source: SourceInfo | null }>;
  critical: Array<{ op: string; threshold: number; level: "urgent" | "soon"; message: string; sex: string | null; source: SourceInfo | null }>;
  verified: boolean;
  loincAttribution?: string | null;
}

export interface LibraryIndex {
  categories: Array<{ key: string; zh: string; order: number }>;
  levels: Record<SourceLevel, string>;
  loincAttribution: string | null;
  sources: SourceInfo[];
  indicators: LibraryEntry[];
}

export interface RemapOutcome {
  before: { mapped: number; unmapped: number };
  after: { mapped: number; unmapped: number };
  changed: Array<{ id: string; raw_name: string; from: string | null; to: string | null }>;
  preserved: number;
  mapperCalled: boolean;
}

export interface IndicatorSummary {
  code: string;
  name: string;
  unit: string;
  category: string;
  direction: string;
  derived: boolean;
  latest: SeriesPoint | null;
  previous: SeriesPoint | null;
  delta: number | null;
  trend: Trend | null;
  concerning: boolean;
  series: Array<{ date: string; value: number; source: SeriesPoint["source"]; flag: Flag | null }>;
  ref: NumericRange | null;
  refLevel: string | null;
}

export interface FindingTimeline {
  key: string | null;
  name: string;
  organ: string;
  entries: Array<{ findingId: string; reportId: string; examDate: string | null; severity: string | null; rawText: string; page: number | null }>;
  summary: string;
}

export interface PanelData {
  key: string;
  name: string;
  description: string;
  items: IndicatorSummary[];
  findings: FindingTimeline[];
}

export interface Insight {
  id: string;
  scope: string;
  scopeId: string;
  status: "pending" | "ready" | "failed";
  content: unknown;
  markdown: string | null;
  error: string | null;
  model: string | null;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsightItem {
  indicator: string;
  what: string;
  meaning: string;
  next_step: string;
  source?: "model" | "rule";
}

export interface ReportInsightContent {
  overview: string;
  groups: { urgent: InsightItem[]; recheck: InsightItem[]; lifestyle: InsightItem[]; watch: InsightItem[] };
  comparison: { improved: string[]; worsened: string[]; new_findings: string[] };
  lifestyle_advice: string[];
  disclaimer: string;
}

export interface TrendInsightContent {
  summary: string;
  observations: string[];
  intervention_timing: string;
  confounders: string[];
  data_note: string;
  suggestions: string[];
  disclaimer: string;
}

export interface IndicatorDetail {
  code: string;
  name: string;
  en: string;
  unit: string;
  category: string;
  direction: string;
  explain: string;
  derived: boolean;
  valueType: string;
  band: NumericRange | null;
  bandSource: "report" | "standard" | "default" | null;
  standard: Provenance["standard"];
  bandText: string | null;
  points: SeriesPoint[];
  interventions: Array<{ id: string; category: string; title: string; description: string; startDate: string; endDate: string | null }>;
  insight: Insight | null;
}

export interface ResultRow {
  id: string;
  indicatorCode: string | null;
  name: string | null;
  category: string | null;
  direction: string | null;
  rawName: string;
  rawValue: string;
  /** Printed value without its ↑/↓/H/L marker. */
  displayValue: string;
  edited: boolean;
  /** Value as first extracted, kept once a reviewer edits the row. */
  originalRawValue: string | null;
  valueNum: number | null;
  valueText: string | null;
  rawUnit: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: Flag | null;
  section: string | null;
  page: number | null;
  confidence: number | null;
  source: string;
  confirmed: boolean;
  printedMarker: string | null;
  verdict: Provenance | null;
}

export interface FindingRow {
  id: string;
  findingKey: string | null;
  name: string | null;
  organ: string;
  severity: string | null;
  rawText: string;
  page: number | null;
  examDate: string | null;
  confirmed: boolean;
}

export interface ReportDetail {
  report: Report;
  member: Member | null;
  results: ResultRow[];
  findings: FindingRow[];
  alerts: CriticalAlert[];
  findingAlerts: FindingAlert[];
  insight: Insight | null;
  disclaimer: string;
}

export interface Meta {
  categories: Array<{ key: string; zh: string; order: number }>;
  panels: Array<{ key: string; name: string; description: string }>;
  findings: Array<{ key: string; name: string; organ: string }>;
  relations: string[];
  interventionCategories: string[];
  disclaimer: string;
  maxUploadBytes: number;
}

export interface IndicatorOption {
  code: string;
  name: string;
  en: string;
  category: string;
  unit: string;
  aliases?: string[];
}

export interface Measurement {
  id: string;
  indicatorCode: string;
  name: string;
  value: number;
  unit: string;
  measuredAt: string;
  note: string;
  createdVia: string;
}
