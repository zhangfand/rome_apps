/**
 * Read-model computations over confirmed data: per-exam snapshots (with
 * derived metrics computed on the fly), indicator series, member overview
 * cards, goal-panel data, indicator detail and findings timelines.
 *
 * Pure functions: callers pass rows loaded from the store. Only confirmed
 * reports should be passed in; unconfirmed extractions never feed trends.
 */
import { checkCritical, checkFindingRedFlags, type CriticalAlert, type FindingAlert } from "../domain/critical.js";
import { ageAt, computeDerived } from "../domain/derived.js";
import { getFinding, parseSeverity, severityLabel } from "../domain/findings.js";
import { computeFlag, isConcerning } from "../domain/flags.js";
import { CATEGORIES, defaultRange, getIndicator } from "../domain/indicators.js";
import { getPanel, panelIndicators } from "../domain/panels.js";
import type { Flag, IndicatorDef, NumericRange, Sex } from "../domain/types.js";
import type { DatedResult, FindingRow, InterventionRow, MeasurementRow, MemberRow } from "../db/repositories/store.js";

export interface MemberCtx {
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
}

export function memberCtx(m: MemberRow): MemberCtx {
  return { sex: m.sex === "male" || m.sex === "female" ? m.sex : null, birthDate: m.birthDate, heightCm: m.heightCm };
}

export interface SnapshotValue {
  code: string;
  value: number | null;
  valueText: string | null;
  unit: string;
  flag: Flag | null;
  source: "report" | "derived";
  resultId?: string;
  page?: number | null;
  rawValue?: string;
  rawUnit?: string;
  refLow?: number | null;
  refHigh?: number | null;
  refText?: string | null;
}

export interface ExamSnapshot {
  reportId: string;
  examDate: string;
  provider: string;
  values: Map<string, SnapshotValue>;
}

/** Group confirmed results into one snapshot per exam, adding derived metrics. */
export function buildSnapshots(results: DatedResult[], member: MemberCtx): ExamSnapshot[] {
  const byReport = new Map<string, ExamSnapshot>();
  for (const r of results) {
    if (!r.examDate || !r.indicatorCode) continue;
    let snap = byReport.get(r.reportId);
    if (!snap) {
      snap = { reportId: r.reportId, examDate: r.examDate, provider: r.provider, values: new Map() };
      byReport.set(r.reportId, snap);
    }
    const existing = snap.values.get(r.indicatorCode);
    // Keep the first row per code, but prefer a numeric row over a text-only duplicate.
    if (existing && (existing.value != null || r.valueNum == null)) continue;
    snap.values.set(r.indicatorCode, {
      code: r.indicatorCode,
      value: r.valueNum,
      valueText: r.valueText,
      unit: r.unit,
      flag: (r.flag as Flag | null) ?? null,
      source: "report",
      resultId: r.id,
      page: r.page,
      rawValue: r.rawValue,
      rawUnit: r.rawUnit,
      refLow: r.refLow,
      refHigh: r.refHigh,
      refText: r.refText,
    });
  }
  const snaps = [...byReport.values()].sort((a, b) => a.examDate.localeCompare(b.examDate));
  for (const snap of snaps) {
    const nums: Record<string, number> = {};
    for (const [code, v] of snap.values) if (v.value != null) nums[code] = v.value;
    const derived = computeDerived(nums, { sex: member.sex, age: ageAt(member.birthDate, snap.examDate), heightCm: member.heightCm });
    for (const d of derived) {
      const def = getIndicator(d.code);
      snap.values.set(d.code, {
        code: d.code,
        value: d.value,
        valueText: null,
        unit: def?.unit ?? "",
        flag: computeFlag({ value: { num: d.value, censor: null, qualitative: null, grade: null, marker: null, text: String(d.value) }, def, sex: member.sex }),
        source: "derived",
      });
    }
  }
  return snaps;
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
}

export function indicatorSeries(code: string, snaps: ExamSnapshot[], measurements: MeasurementRow[], member: MemberCtx): SeriesPoint[] {
  const def = getIndicator(code);
  const points: SeriesPoint[] = [];
  for (const s of snaps) {
    const v = s.values.get(code);
    if (!v) continue;
    points.push({
      date: s.examDate,
      value: v.value,
      valueText: v.valueText,
      unit: v.unit,
      flag: v.flag,
      source: v.source,
      reportId: s.reportId,
      resultId: v.resultId,
      page: v.page ?? null,
      provider: s.provider,
    });
  }
  for (const m of measurements) {
    if (m.indicatorCode !== code) continue;
    points.push({
      date: m.measuredAt.slice(0, 10),
      value: m.value,
      valueText: null,
      unit: m.unit,
      flag: computeFlag({ value: { num: m.value, censor: null, qualitative: null, grade: null, marker: null, text: String(m.value) }, def, sex: member.sex }),
      source: "measurement",
      measurementId: m.id,
      note: m.note || undefined,
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date) || (a.source === "measurement" ? 1 : -1));
}

export type Trend = "better" | "worse" | "flat" | "changed";

/** Whether a change from `prev` to `latest` is better, worse or flat given the indicator's direction and range. */
export function trendOf(def: IndicatorDef | undefined, prev: number, latest: number, range?: NumericRange): Trend {
  const pct = prev === 0 ? (latest === 0 ? 0 : 1) : (latest - prev) / Math.abs(prev);
  if (Math.abs(pct) < 0.03) return "flat";
  const up = latest > prev;
  switch (def?.direction) {
    case "higher_worse":
      return up ? "worse" : "better";
    case "lower_worse":
      return up ? "better" : "worse";
    case "both": {
      if (!range) return "changed";
      const mid = range.low != null && range.high != null ? (range.low + range.high) / 2 : range.low ?? range.high!;
      return Math.abs(latest - mid) < Math.abs(prev - mid) ? "better" : "worse";
    }
    default:
      return "changed";
  }
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
}

export function summarize(code: string, snaps: ExamSnapshot[], measurements: MeasurementRow[], member: MemberCtx): IndicatorSummary | null {
  const def = getIndicator(code);
  if (!def) return null;
  const points = indicatorSeries(code, snaps, measurements, member);
  const reportPoints = points.filter((p) => p.source !== "measurement");
  const latest = points.at(-1) ?? null;
  const latestExam = reportPoints.at(-1) ?? null;
  const prevExam = reportPoints.at(-2) ?? null;
  const range = defaultRange(def, member.sex) ?? healthyWeightRange(def.code, member) ?? null;
  let delta: number | null = null;
  let trend: Trend | null = null;
  if (latestExam?.value != null && prevExam?.value != null) {
    delta = round(latestExam.value - prevExam.value, (def.decimals ?? 2) + 1);
    // Weight has no fixed direction; judge it against the member's healthy BMI range.
    const trendDef = def.code === "WEIGHT" && range ? { ...def, direction: "both" as const } : def;
    trend = trendOf(trendDef, prevExam.value, latestExam.value, range ?? undefined);
  }
  return {
    code,
    name: def.zh,
    unit: def.unit,
    category: def.category,
    direction: def.direction,
    derived: !!def.derived,
    latest,
    previous: prevExam,
    delta,
    trend,
    concerning: isConcerning(latestExam?.flag, def),
    series: points.filter((p): p is SeriesPoint & { value: number } => p.value != null).map((p) => ({ date: p.date, value: p.value, source: p.source, flag: p.flag })),
    ref: range,
  };
}

/** Healthy weight band (BMI 18.5–23.9) for a member with a known height. */
export function healthyWeightRange(code: string, member: MemberCtx): NumericRange | undefined {
  if (code !== "WEIGHT" || !member.heightCm) return undefined;
  const m2 = (member.heightCm / 100) ** 2;
  return { low: round(18.5 * m2, 1), high: round(23.9 * m2, 1) };
}

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

// ------------------------------------------------------------------ findings

export interface FindingTimeline {
  key: string | null;
  name: string;
  organ: string;
  entries: Array<{ findingId: string; reportId: string; examDate: string | null; severity: string | null; rawText: string; page: number | null }>;
  /** e.g. `2023 中度 → 2024 中度 → 2026 轻度` */
  summary: string;
}

export function findingsTimeline(findings: FindingRow[], keys?: string[]): FindingTimeline[] {
  const groups = new Map<string, FindingTimeline>();
  for (const f of findings) {
    if (keys && (!f.findingKey || !keys.includes(f.findingKey))) continue;
    const def = getFinding(f.findingKey);
    const gk = f.findingKey ?? `other:${f.organ || "其他"}`;
    let g = groups.get(gk);
    if (!g) {
      g = { key: f.findingKey, name: def?.zh ?? (f.organ ? `${f.organ}其他所见` : "其他所见"), organ: def?.organ ?? f.organ, entries: [], summary: "" };
      groups.set(gk, g);
    }
    g.entries.push({
      findingId: f.id,
      reportId: f.reportId,
      examDate: f.examDate,
      severity: f.severity || severityLabel(parseSeverity(f.rawText)) || null,
      rawText: f.rawText,
      page: f.page,
    });
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.entries.sort((a, b) => (a.examDate ?? "").localeCompare(b.examDate ?? ""));
    g.summary = g.entries.map((e) => `${e.examDate?.slice(0, 4) ?? "?"} ${e.severity || "有"}`).join(" → ");
  }
  return out.sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || a.name.localeCompare(b.name, "zh"));
}

// ------------------------------------------------------------------ overview

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

export function memberOverview(member: MemberCtx & { goals: string[] }, snaps: ExamSnapshot[], findings: FindingRow[]): MemberOverview {
  const latest = snaps.at(-1);
  const prev = snaps.at(-2);
  if (!latest) {
    return { latestExamDate: null, latestReportId: null, examCount: 0, abnormalCount: 0, abnormal: [], topChanges: [], alerts: [], findingAlerts: [] };
  }
  const abnormal: MemberOverview["abnormal"] = [];
  for (const v of latest.values.values()) {
    const def = getIndicator(v.code);
    if (isConcerning(v.flag, def)) abnormal.push({ code: v.code, name: def?.zh ?? v.code, value: v.value, valueText: v.valueText, unit: v.unit, flag: v.flag });
  }
  const panelCodes = new Set(member.goals.flatMap((g) => panelIndicators(g, member.sex).map((d) => d.code)));
  const changes: MemberOverview["topChanges"] = [];
  if (prev) {
    for (const v of latest.values.values()) {
      const p = prev.values.get(v.code);
      const def = getIndicator(v.code);
      if (!def || v.value == null || p?.value == null || def.direction === "info") continue;
      const pct = p.value === 0 ? 0 : (v.value - p.value) / Math.abs(p.value);
      if (Math.abs(pct) < 0.05) continue;
      changes.push({
        code: v.code,
        name: def.zh,
        unit: def.unit,
        previous: p.value,
        latest: v.value,
        delta: round(v.value - p.value, (def.decimals ?? 2) + 1),
        pct: round(pct * 100, 1),
        trend: trendOf(def, p.value, v.value, defaultRange(def, member.sex)),
      });
    }
  }
  // Goal-panel indicators first, then biggest relative change.
  changes.sort((a, b) => Number(panelCodes.has(b.code)) - Number(panelCodes.has(a.code)) || Math.abs(b.pct) - Math.abs(a.pct));
  const alerts = checkCritical([...latest.values.values()].map((v) => ({ code: v.code, value: v.value })), { sex: member.sex });
  const findingAlerts = findings
    .filter((f) => f.reportId === latest.reportId)
    .map((f) => checkFindingRedFlags({ findingKey: f.findingKey, severity: f.severity, rawText: f.rawText }))
    .filter((a): a is FindingAlert => a !== null);
  return {
    latestExamDate: latest.examDate,
    latestReportId: latest.reportId,
    examCount: snaps.length,
    abnormalCount: abnormal.length,
    abnormal,
    topChanges: changes.slice(0, 3),
    alerts,
    findingAlerts,
  };
}

// ------------------------------------------------------------------ panels

export function panelData(panelKey: string, member: MemberCtx, snaps: ExamSnapshot[], measurements: MeasurementRow[], findings: FindingRow[]) {
  const panel = getPanel(panelKey);
  if (!panel) return null;
  const items = panelIndicators(panelKey, member.sex)
    .map((d) => summarize(d.code, snaps, measurements, member))
    .filter((x): x is IndicatorSummary => x !== null);
  return { key: panel.key, name: panel.zh, description: panel.description, items, findings: findingsTimeline(findings, panel.findings) };
}

/** Every indicator with data, grouped by category in dictionary order. */
export function allIndicators(member: MemberCtx, snaps: ExamSnapshot[], measurements: MeasurementRow[]) {
  const codes = new Set<string>();
  for (const s of snaps) for (const c of s.values.keys()) codes.add(c);
  for (const m of measurements) codes.add(m.indicatorCode);
  return CATEGORIES.map((c) => ({
    key: c.key,
    name: c.zh,
    items: [...codes]
      .map((code) => getIndicator(code))
      .filter((d): d is IndicatorDef => !!d && d.category === c.key)
      .map((d) => summarize(d.code, snaps, measurements, member))
      .filter((x): x is IndicatorSummary => x !== null),
  })).filter((g) => g.items.length > 0);
}

// ------------------------------------------------------------------ detail

export function indicatorDetail(code: string, member: MemberCtx, snaps: ExamSnapshot[], measurements: MeasurementRow[], interventions: InterventionRow[], today: string) {
  const def = getIndicator(code);
  if (!def) return null;
  const points = indicatorSeries(code, snaps, measurements, member);
  // Reference band: most recent printed range from a report, else the dictionary default.
  const printed = [...snaps].reverse().map((s) => s.values.get(code)).find((v) => v && v.source === "report" && (v.refLow != null || v.refHigh != null));
  const band: NumericRange | null = printed
    ? { low: printed.refLow ?? undefined, high: printed.refHigh ?? undefined }
    : defaultRange(def, member.sex) ?? null;
  const first = points[0]?.date;
  const last = points.at(-1)?.date ?? today;
  const overlapping = first
    ? interventions.filter((iv) => iv.startDate <= (last > today ? last : today) && (iv.endDate == null || iv.endDate >= first))
    : interventions;
  return {
    code: def.code,
    name: def.zh,
    en: def.en,
    unit: def.unit,
    category: def.category,
    direction: def.direction,
    explain: def.explain,
    derived: !!def.derived,
    valueType: def.valueType,
    band,
    bandSource: printed ? "report" : band ? "default" : null,
    /** The range exactly as printed on the most recent report (e.g. `<1.7`). */
    bandText: printed?.refText ?? null,
    points,
    interventions: overlapping.map((iv) => ({
      id: iv.id,
      category: iv.category,
      title: iv.title,
      description: iv.description,
      startDate: iv.startDate,
      endDate: iv.endDate,
    })),
  };
}
