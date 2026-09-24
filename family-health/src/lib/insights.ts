/**
 * AI interpretations (report + indicator trend) via the app's interpreter
 * agents, with the safety rails enforced in code:
 *
 * - PII minimization: payloads carry only age, sex, height, goals, results,
 *   findings and interventions — never names, notes or ids.
 * - Deterministic critical alerts are merged into 需尽快就医 regardless of
 *   what the model returned.
 * - Trend texts must describe interventions as 时间上同时发生, never as
 *   causes: causal phrasing triggers one regeneration, then sentence removal.
 * - The fixed disclaimer is appended in code.
 */
import { createHash } from "node:crypto";
import { checkCritical, checkFindingRedFlags, type CriticalAlert, type FindingAlert } from "../domain/critical.js";
import { ageAt } from "../domain/derived.js";
import { getFinding } from "../domain/findings.js";
import { getIndicator } from "../domain/indicators.js";
import { getPanel } from "../domain/panels.js";
import { formatRange } from "../domain/refRange.js";
import type { FamilyHealthStore, InsightRow, MemberRow } from "../db/repositories/store.js";
import type { AgentCaller } from "./agent.js";
import { buildSnapshots, indicatorDetail, memberCtx } from "./analytics.js";
import { todayIso } from "./dates.js";

export const DISCLAIMER = "仅供参考，不能替代医生诊断";
export const REPORT_AGENT = "family-health:interpreter";
export const TREND_AGENT = "family-health:trend-interpreter";
export const REPORT_PROMPT_VERSION = "report-v1";
export const TREND_PROMPT_VERSION = "trend-v1";

// ------------------------------------------------------------------ payloads

export interface MemberProfile {
  age: number | null;
  sex: "男" | "女" | null;
  height_cm: number | null;
  goals: string[];
}

/** The only member facts ever sent to a model. */
export function memberProfile(m: MemberRow, at: string): MemberProfile {
  return {
    age: ageAt(m.birthDate, at),
    sex: m.sex === "male" ? "男" : m.sex === "female" ? "女" : null,
    height_cm: m.heightCm,
    goals: (m.goals ?? []).map((g) => getPanel(g)?.zh ?? g),
  };
}

function valueOf(v: { value: number | null; valueText: string | null }) {
  return v.value ?? v.valueText;
}

export interface ReportPayload {
  member: MemberProfile;
  exam_date: string | null;
  results: Array<{ name: string; value: number | string | null; unit: string; ref: string; flag: string | null }>;
  findings: Array<{ name: string; severity: string | null; text: string }>;
  changes_vs_previous: Array<{ name: string; previous: number | string | null; previous_date: string; current: number | string | null; unit: string }>;
  previous_findings: Array<{ name: string; date: string | null; severity: string | null }>;
  interventions: Array<{ category: string; title: string; start: string; end: string | null }>;
  deterministic_alerts: Array<{ name: string; level: string; message: string }>;
}

export function buildReportPayload(store: FamilyHealthStore, reportId: string): { payload: ReportPayload; alerts: CriticalAlert[]; findingAlerts: FindingAlert[] } | null {
  const report = store.getReport(reportId);
  if (!report) return null;
  const member = store.getMember(report.memberId);
  if (!member) return null;
  const at = report.examDate ?? todayIso();
  const ctx = memberCtx(member);
  const rows = store.listReportResults(reportId);
  const findings = store.listReportFindings(reportId);

  const results = rows.map((r) => {
    const def = getIndicator(r.indicatorCode);
    return {
      name: def?.zh ?? r.rawName,
      value: r.valueNum ?? r.valueText ?? r.rawValue,
      unit: r.unit || r.rawUnit,
      ref: r.refText ?? formatRange({ low: r.refLow ?? undefined, high: r.refHigh ?? undefined }),
      flag: r.flag,
    };
  });

  // Previous confirmed exams (strictly before this one).
  const history = buildSnapshots(store.listMemberResults(member.id), ctx).filter((s) => s.reportId !== reportId && (!report.examDate || s.examDate < report.examDate));
  const prev = history.at(-1);
  const changes: ReportPayload["changes_vs_previous"] = [];
  if (prev) {
    for (const r of rows) {
      if (!r.indicatorCode) continue;
      const p = prev.values.get(r.indicatorCode);
      if (!p) continue;
      changes.push({ name: getIndicator(r.indicatorCode)?.zh ?? r.rawName, previous: valueOf(p), previous_date: prev.examDate, current: r.valueNum ?? r.valueText, unit: r.unit });
    }
  }
  const previousFindings = store
    .listMemberFindings(member.id)
    .filter((f) => f.reportId !== reportId)
    .map((f) => ({ name: getFinding(f.findingKey)?.zh ?? f.rawText.slice(0, 20), date: f.examDate, severity: f.severity }));

  const alerts = checkCritical(rows.map((r) => ({ code: r.indicatorCode, value: r.valueNum })), { sex: ctx.sex });
  const findingAlerts = findings
    .map((f) => checkFindingRedFlags({ findingKey: f.findingKey, severity: f.severity, rawText: f.rawText }))
    .filter((a): a is FindingAlert => a !== null);

  const payload: ReportPayload = {
    member: memberProfile(member, at),
    exam_date: report.examDate,
    results,
    findings: findings.map((f) => ({ name: getFinding(f.findingKey)?.zh ?? f.organ ?? "所见", severity: f.severity, text: f.rawText })),
    changes_vs_previous: changes,
    previous_findings: previousFindings,
    interventions: store.listInterventions(member.id).map((iv) => ({ category: iv.category, title: iv.title, start: iv.startDate, end: iv.endDate })),
    deterministic_alerts: [
      ...alerts.map((a) => ({ name: a.name, level: a.level, message: a.message })),
      ...findingAlerts.map((a) => ({ name: getFinding(a.findingKey)?.zh ?? a.findingKey, level: a.level, message: a.message })),
    ],
  };
  return { payload, alerts, findingAlerts };
}

export interface TrendPayload {
  member: MemberProfile;
  indicator: { name: string; unit: string; reference: string; direction: string; explain: string };
  series: Array<{ date: string; value: number | string | null; flag: string | null; source: string }>;
  data_points: number;
  interventions: Array<{ category: string; title: string; start: string; end: string | null }>;
}

const DIRECTION_ZH: Record<string, string> = {
  higher_worse: "偏高需关注",
  lower_worse: "偏低需关注",
  both: "过高过低都需关注",
  qualitative: "定性结果",
  info: "仅供参考",
};

export function buildTrendPayload(store: FamilyHealthStore, memberId: string, code: string): TrendPayload | null {
  const member = store.getMember(memberId);
  if (!member) return null;
  const ctx = memberCtx(member);
  const snaps = buildSnapshots(store.listMemberResults(memberId), ctx);
  const detail = indicatorDetail(code, ctx, snaps, store.listMeasurements(memberId), store.listInterventions(memberId), todayIso());
  if (!detail) return null;
  const series = detail.points.map((p) => ({
    date: p.date,
    value: p.value ?? p.valueText,
    flag: p.flag,
    source: p.source === "measurement" ? "家庭自测" : p.source === "derived" ? "计算值" : "体检报告",
  }));
  return {
    member: memberProfile(member, series.at(-1)?.date ?? todayIso()),
    indicator: { name: detail.name, unit: detail.unit, reference: formatRange(detail.band), direction: DIRECTION_ZH[detail.direction] ?? "", explain: detail.explain },
    series,
    data_points: series.length,
    interventions: detail.interventions.map((iv) => ({ category: iv.category, title: iv.title, start: iv.startDate, end: iv.endDate })),
  };
}

// ------------------------------------------------------------------ prompts

export function buildReportPrompt(payload: ReportPayload): string {
  return [
    "请为下面这份体检结果写一份通俗易懂的中文解读，读者是没有医学背景的家庭成员。",
    "要求：",
    "- overview：2–4 句总体概况。",
    "- groups 按优先级分组：urgent=需尽快就医，recheck=建议复查，lifestyle=生活方式关注，watch=轻微可观察。",
    "  每项包含 indicator（指标或结论名称）、what（这是什么，一句话）、meaning（你的数值意味着什么，结合数值和参考范围）、",
    "  next_step（下一步：复查什么项目、多久后复查、看哪个科室）。正常项目不要列出。",
    "- deterministic_alerts 中的每一项都必须放在 urgent 组。",
    "- comparison：与上一次体检相比 improved（好转）、worsened（变差）、new_findings（新出现），没有历史数据则都为空数组。",
    "- lifestyle_advice：3–5 条具体可执行的生活方式建议，结合成员的关注目标。",
    "- 不要下诊断，不要推荐具体药物或剂量，不要夸大风险；语气平实、具体。",
    "- 提到生活方式调整或用药与指标变化时，只能说“时间上同时发生”，不能说导致、起到作用、说明有效等因果结论。",
    "",
    "数据（JSON）：",
    JSON.stringify(payload),
  ].join("\n");
}

export function buildTrendPrompt(payload: TrendPayload, strict = false): string {
  return [
    `请用通俗中文解读这个指标在一段时间内的变化趋势：${payload.indicator.name}。`,
    "要求：",
    "- summary：2–3 句概括趋势（上升/下降/波动/稳定），引用具体数值和日期。",
    "- observations：2–4 条要点。",
    "- intervention_timing：如有生活方式或用药调整，只能描述为与指标变化“时间上同时发生”，",
    "  绝对不能说它导致、使得、造成、归功于或证明了指标变化；没有调整则写“期间没有记录的生活方式调整”。",
    "- confounders：可能同时影响这个指标的其他因素（如检测机构/方法不同、季节、饮食、饮酒、体重、用药、采血状态等）。",
    `- data_note：说明数据点数量（共 ${payload.data_points} 个）及其局限性，点数少时要明确说明结论不确定。`,
    "- suggestions：1–3 条下一步建议（如复查时间、就诊科室、继续记录）。",
    "- 不要下诊断，不要推荐具体药物。",
    strict ? "特别注意：上一版回答出现了因果表述，这次任何句子都不能暗示调整和指标变化之间存在因果关系。" : "",
    "",
    "数据（JSON）：",
    JSON.stringify(payload),
  ]
    .filter(Boolean)
    .join("\n");
}

// ------------------------------------------------------------------ report content

export interface InsightItem {
  indicator: string;
  what: string;
  meaning: string;
  next_step: string;
  source?: "model" | "rule";
}

export interface ReportInsight {
  overview: string;
  groups: { urgent: InsightItem[]; recheck: InsightItem[]; lifestyle: InsightItem[]; watch: InsightItem[] };
  comparison: { improved: string[]; worsened: string[]; new_findings: string[] };
  lifestyle_advice: string[];
  disclaimer: string;
}

const GROUP_KEYS = ["urgent", "recheck", "lifestyle", "watch"] as const;

const strOr = (v: unknown, d = ""): string => (typeof v === "string" ? v.trim() : d);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => strOr(x)).filter(Boolean) : []);

export function coerceReportInsight(raw: unknown): ReportInsight {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const g = (o.groups && typeof o.groups === "object" ? o.groups : {}) as Record<string, unknown>;
  const items = (v: unknown): InsightItem[] =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({ indicator: strOr(x.indicator), what: strOr(x.what), meaning: strOr(x.meaning), next_step: strOr(x.next_step), source: "model" as const }))
      .filter((x) => x.indicator);
  const c = (o.comparison && typeof o.comparison === "object" ? o.comparison : {}) as Record<string, unknown>;
  return {
    overview: strOr(o.overview),
    groups: { urgent: items(g.urgent), recheck: items(g.recheck), lifestyle: items(g.lifestyle), watch: items(g.watch) },
    comparison: { improved: strList(c.improved), worsened: strList(c.worsened), new_findings: strList(c.new_findings) },
    lifestyle_advice: strList(o.lifestyle_advice),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Guarantee every deterministic alert appears in 需尽快就医: move a matching
 * model item there, or add a rule-based item.
 */
export function mergeAlerts(insight: ReportInsight, alerts: CriticalAlert[], findingAlerts: FindingAlert[]): ReportInsight {
  const out: ReportInsight = { ...insight, groups: { urgent: [...insight.groups.urgent], recheck: [...insight.groups.recheck], lifestyle: [...insight.groups.lifestyle], watch: [...insight.groups.watch] } };
  const wanted = [
    ...alerts.map((a) => ({
      name: a.name,
      item: {
        indicator: a.name,
        what: getIndicator(a.code)?.explain ?? "",
        meaning: `本次结果 ${a.value}${a.unit ? ` ${a.unit}` : ""}。${a.message}`,
        next_step: a.message,
        source: "rule" as const,
      },
    })),
    ...findingAlerts.map((a) => {
      const def = getFinding(a.findingKey);
      const name = def?.zh ?? a.findingKey;
      return { name, item: { indicator: name, what: def?.explain ?? "", meaning: a.message, next_step: a.message, source: "rule" as const } };
    }),
  ];
  for (const w of wanted) {
    if (out.groups.urgent.some((i) => i.indicator.includes(w.name) || w.name.includes(i.indicator))) continue;
    let moved = false;
    for (const k of GROUP_KEYS) {
      if (k === "urgent") continue;
      const idx = out.groups[k].findIndex((i) => i.indicator.includes(w.name) || w.name.includes(i.indicator));
      if (idx >= 0) {
        const [item] = out.groups[k].splice(idx, 1);
        out.groups.urgent.push({ ...item, next_step: item.next_step || w.item.next_step });
        moved = true;
        break;
      }
    }
    if (!moved) out.groups.urgent.unshift(w.item);
  }
  return out;
}

const GROUP_ZH: Record<(typeof GROUP_KEYS)[number], string> = { urgent: "需尽快就医", recheck: "建议复查", lifestyle: "生活方式关注", watch: "轻微可观察" };

/** Remove causal sentences from every text field of a report interpretation. */
export function stripReportCausal(ins: ReportInsight): ReportInsight {
  const clean = (s: string) =>
    s
      .split(/(?<=[。！？；;!?])/)
      .filter((p) => !CAUSAL_RE.test(p))
      .join("")
      .trim();
  const items = (xs: InsightItem[]) => xs.map((i) => ({ ...i, what: clean(i.what), meaning: clean(i.meaning), next_step: clean(i.next_step) }));
  return {
    ...ins,
    overview: clean(ins.overview),
    groups: { urgent: items(ins.groups.urgent), recheck: items(ins.groups.recheck), lifestyle: items(ins.groups.lifestyle), watch: items(ins.groups.watch) },
    comparison: {
      improved: ins.comparison.improved.map(clean).filter(Boolean),
      worsened: ins.comparison.worsened.map(clean).filter(Boolean),
      new_findings: ins.comparison.new_findings.map(clean).filter(Boolean),
    },
    lifestyle_advice: ins.lifestyle_advice.map(clean).filter(Boolean),
  };
}

export function reportMarkdown(ins: ReportInsight): string {
  const lines: string[] = ["## 总体概况", ins.overview || "（无）", ""];
  for (const k of GROUP_KEYS) {
    if (!ins.groups[k].length) continue;
    lines.push(`## ${GROUP_ZH[k]}`);
    for (const i of ins.groups[k]) {
      lines.push(`### ${i.indicator}`);
      if (i.what) lines.push(`- **这是什么**：${i.what}`);
      if (i.meaning) lines.push(`- **你的数值意味着什么**：${i.meaning}`);
      if (i.next_step) lines.push(`- **下一步**：${i.next_step}`);
    }
    lines.push("");
  }
  const cmp = ins.comparison;
  if (cmp.improved.length || cmp.worsened.length || cmp.new_findings.length) {
    lines.push("## 与往年对比");
    if (cmp.improved.length) lines.push(`- **好转**：${cmp.improved.join("；")}`);
    if (cmp.worsened.length) lines.push(`- **变差**：${cmp.worsened.join("；")}`);
    if (cmp.new_findings.length) lines.push(`- **新出现**：${cmp.new_findings.join("；")}`);
    lines.push("");
  }
  if (ins.lifestyle_advice.length) {
    lines.push("## 生活方式建议", ...ins.lifestyle_advice.map((a) => `- ${a}`), "");
  }
  lines.push(`> ${DISCLAIMER}`);
  return lines.join("\n");
}

// ------------------------------------------------------------------ trend content

export interface TrendInsight {
  summary: string;
  observations: string[];
  intervention_timing: string;
  confounders: string[];
  data_note: string;
  suggestions: string[];
  disclaimer: string;
  /** Sentences removed by the causal-language guard (kept for transparency). */
  removed?: number;
}

export function coerceTrendInsight(raw: unknown): TrendInsight {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    summary: strOr(o.summary),
    observations: strList(o.observations),
    intervention_timing: strOr(o.intervention_timing),
    confounders: strList(o.confounders),
    data_note: strOr(o.data_note),
    suggestions: strList(o.suggestions),
    disclaimer: DISCLAIMER,
  };
}

/** Causal phrasing we never allow about interventions and indicator changes. */
const CAUSAL_RE =
  /导致|致使|使得|造成了?|归功于|得益于|多亏|因为[^。；;]{0,30}所以|由于[^。；;]{0,30}(下降|升高|改善|好转|降低|回落|变好|变差)|(饮食|运动|快走|跑步|控制|调整|干预|用药|服药|药物|减重|减肥|戒酒|戒烟)[^。；;]{0,15}(降低了|改善了|使其|让[^。；;]{0,6}(下降|降低|改善))|有效(地)?(降低|改善|控制|逆转)|起(到|了)了?[^。；;]{0,6}(作用|效果)|发挥了?[^。；;]{0,6}作用|奏效|见成效|收到了?[^。；;]{0,4}效果|证明了?|说明[^。；;]{0,20}(有效|起效|见效|作用|奏效|成效|效果)/;

export function findCausalPhrases(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[。！？；;!?])/)) {
    if (CAUSAL_RE.test(sentence)) out.push(sentence.trim());
  }
  return out;
}

function trendTexts(t: TrendInsight): string[] {
  return [t.summary, ...t.observations, t.intervention_timing, ...t.confounders, t.data_note, ...t.suggestions];
}

export function hasCausalLanguage(t: TrendInsight): boolean {
  return trendTexts(t).some((s) => findCausalPhrases(s).length > 0);
}

/** Remove causal sentences; replace an emptied intervention note with the neutral framing. */
export function stripCausal(t: TrendInsight): TrendInsight {
  let removed = 0;
  const clean = (s: string) => {
    const parts = s.split(/(?<=[。！？；;!?])/);
    const kept = parts.filter((p) => {
      const bad = CAUSAL_RE.test(p);
      if (bad) removed++;
      return !bad;
    });
    return kept.join("").trim();
  };
  const cleanList = (xs: string[]) => xs.map(clean).filter(Boolean);
  const out: TrendInsight = {
    ...t,
    summary: clean(t.summary),
    observations: cleanList(t.observations),
    intervention_timing: clean(t.intervention_timing) || "记录的生活方式调整与指标变化只是时间上同时发生，不能据此判断两者存在因果关系。",
    confounders: cleanList(t.confounders),
    data_note: clean(t.data_note),
    suggestions: cleanList(t.suggestions),
  };
  return { ...out, removed };
}

export function trendMarkdown(name: string, t: TrendInsight): string {
  const lines = [`## ${name} 趋势解读`, t.summary, ""];
  if (t.observations.length) lines.push(...t.observations.map((o) => `- ${o}`), "");
  if (t.intervention_timing) lines.push("### 生活方式调整（时间上同时发生）", t.intervention_timing, "");
  if (t.confounders.length) lines.push("### 可能的其他影响因素", ...t.confounders.map((c) => `- ${c}`), "");
  if (t.data_note) lines.push("### 数据说明", t.data_note, "");
  if (t.suggestions.length) lines.push("### 建议", ...t.suggestions.map((s) => `- ${s}`), "");
  lines.push(`> ${DISCLAIMER}`);
  return lines.join("\n");
}

// ------------------------------------------------------------------ generation

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

export function reportScopeId(reportId: string) {
  return reportId;
}

export function trendScopeId(memberId: string, code: string) {
  return `${memberId}:${code}`;
}

export async function generateReportInsight(store: FamilyHealthStore, reportId: string, callAgent: AgentCaller, opts: { force?: boolean } = {}): Promise<InsightRow> {
  const built = buildReportPayload(store, reportId);
  if (!built) throw new Error("报告不存在");
  const report = store.getReport(reportId)!;
  const inputHash = hashPayload({ v: REPORT_PROMPT_VERSION, p: built.payload });
  const existing = store.getInsight("report", reportId);
  if (existing && existing.status === "ready" && existing.inputHash === inputHash && !opts.force) return existing;
  const base = { scope: "report", scopeId: reportScopeId(reportId), memberId: report.memberId, model: REPORT_AGENT, promptVersion: REPORT_PROMPT_VERSION, inputHash };
  store.upsertInsight({ ...base, status: "pending", content: existing?.content ?? null, markdown: existing?.markdown ?? null, error: null });
  const res = await callAgent(REPORT_AGENT, buildReportPrompt(built.payload));
  if (!res.ok) {
    return store.upsertInsight({ ...base, status: "failed", content: existing?.content ?? null, markdown: existing?.markdown ?? null, error: `生成解读失败：${res.error}` });
  }
  const content = mergeAlerts(stripReportCausal(coerceReportInsight(res.data)), built.alerts, built.findingAlerts);
  return store.upsertInsight({ ...base, status: "ready", content, markdown: reportMarkdown(content), error: null });
}

export async function generateTrendInsight(store: FamilyHealthStore, memberId: string, code: string, callAgent: AgentCaller, opts: { force?: boolean } = {}): Promise<InsightRow> {
  const payload = buildTrendPayload(store, memberId, code);
  if (!payload) throw new Error("成员或指标不存在");
  const scopeId = trendScopeId(memberId, code);
  const inputHash = hashPayload({ v: TREND_PROMPT_VERSION, p: payload });
  const existing = store.getInsight("indicator", scopeId);
  if (existing && existing.status === "ready" && existing.inputHash === inputHash && !opts.force) return existing;
  const base = { scope: "indicator", scopeId, memberId, model: TREND_AGENT, promptVersion: TREND_PROMPT_VERSION, inputHash };
  store.upsertInsight({ ...base, status: "pending", content: existing?.content ?? null, markdown: existing?.markdown ?? null, error: null });
  if (payload.data_points === 0) {
    return store.upsertInsight({ ...base, status: "failed", content: null, markdown: null, error: "还没有这个指标的已确认数据" });
  }
  let res = await callAgent(TREND_AGENT, buildTrendPrompt(payload));
  if (!res.ok) return store.upsertInsight({ ...base, status: "failed", content: existing?.content ?? null, markdown: existing?.markdown ?? null, error: `生成解读失败：${res.error}` });
  let content = coerceTrendInsight(res.data);
  if (hasCausalLanguage(content)) {
    // One regeneration with a stricter reminder, then deterministic clean-up.
    const retry = await callAgent(TREND_AGENT, buildTrendPrompt(payload, true));
    if (retry.ok) content = coerceTrendInsight(retry.data);
    if (hasCausalLanguage(content)) content = stripCausal(content);
  }
  return store.upsertInsight({ ...base, status: "ready", content, markdown: trendMarkdown(payload.indicator.name, content), error: null });
}

/** Deterministic alerts for a report (used by the API even before interpretation). */
export function reportAlerts(store: FamilyHealthStore, reportId: string) {
  const built = buildReportPayload(store, reportId);
  return built ? { alerts: built.alerts, findingAlerts: built.findingAlerts } : { alerts: [], findingAlerts: [] };
}


/**
 * Apply the causal-language guard to a stored insight as it is served, so
 * interpretations generated before a guard improvement (or edited in the DB)
 * never show causal claims about interventions.
 */
export function guardStoredInsight<T extends { scope: string; status: string; content: unknown; markdown: string | null }>(row: T | undefined | null): T | null {
  if (!row) return null;
  if (row.status !== "ready" || !row.content || typeof row.content !== "object") return row;
  if (row.scope === "report") {
    const content = stripReportCausal(row.content as ReportInsight);
    return { ...row, content, markdown: reportMarkdown(content) };
  }
  const t = row.content as TrendInsight;
  if (Array.isArray(t.observations) && hasCausalLanguage(t)) {
    const content = stripCausal(t);
    return { ...row, content, markdown: null };
  }
  return row;
}
