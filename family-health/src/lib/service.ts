/**
 * Application operations shared by the HTTP API and the chat actions:
 * member / indicator resolution, intervention and measurement logging, the
 * compact query used by the chat agent, and dashboard read models.
 */
import { rmSync } from "node:fs";
import { ageAt } from "../domain/derived.js";
import { getFinding } from "../domain/findings.js";
import { isConcerning } from "../domain/flags.js";
import { getIndicator } from "../domain/indicators.js";
import { mapIndicator, searchIndicators } from "../domain/mapping.js";
import { resolveMember, type MemberRef, type ResolveResult } from "../domain/members.js";
import { formatRange } from "../domain/refRange.js";
import { RELATIONS, type IndicatorDef, type Relation } from "../domain/types.js";
import { normalizeUnit, toCanonical } from "../domain/units.js";
import { parseResultValue, splitBloodPressure } from "../domain/values.js";
import type { FamilyHealthStore, InterventionRow, MeasurementRow, MemberRow } from "../db/repositories/store.js";
import { allIndicators, buildSnapshots, findingsTimeline, indicatorDetail, memberCtx, memberOverview, panelData } from "./analytics.js";
import { resolveDate, todayIso } from "./dates.js";
import { appDataDir, reportDir } from "./storage.js";

export const DISCLAIMER = "仅供参考，不能替代医生诊断";

/** Structured failure the chat agent can act on (e.g. ask which member). */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// ------------------------------------------------------------------ members

export function publicMember(m: MemberRow, today = todayIso()) {
  return {
    id: m.id,
    name: m.name,
    relation: m.relation,
    sex: m.sex,
    birthDate: m.birthDate,
    age: ageAt(m.birthDate, today),
    heightCm: m.heightCm,
    goals: m.goals,
    notes: m.notes,
    isDemo: m.isDemo,
  };
}

const memberRef = (m: MemberRow): MemberRef => ({ id: m.id, name: m.name, relation: m.relation, sex: m.sex === "male" || m.sex === "female" ? m.sex : null });

export function resolveMemberOrThrow(store: FamilyHealthStore, query: string | null | undefined): MemberRow {
  const members = store.listMembers();
  if (members.length === 0) throw new UserFacingError("还没有任何家庭成员，请先添加成员（或运行演示数据）。", "no_members");
  const r: ResolveResult = resolveMember(query, members.map(memberRef));
  if (r.status === "found") return members.find((m) => m.id === r.member.id)!;
  const candidates = (r.status === "ambiguous" ? r.candidates : r.candidates).map((c) => ({ id: c.id, name: c.name, relation: c.relation }));
  throw new UserFacingError(`${r.reason}。请确认是哪位成员。`, r.status === "ambiguous" ? "ambiguous_member" : "member_not_found", { candidates });
}

const SEX_WORDS: Record<string, "male" | "female"> = { male: "male", m: "male", 男: "male", 男性: "male", female: "female", f: "female", 女: "female", 女性: "female" };

export function normalizeSex(v: unknown): "male" | "female" | null {
  if (typeof v !== "string") return null;
  return SEX_WORDS[v.trim().toLowerCase()] ?? null;
}

export function normalizeRelation(v: unknown): Relation {
  if (typeof v === "string" && (RELATIONS as readonly string[]).includes(v.trim())) return v.trim() as Relation;
  const map: Record<string, Relation> = { self: "本人", me: "本人", 我: "本人", spouse: "配偶", wife: "配偶", husband: "配偶", 妻子: "配偶", 丈夫: "配偶", 老婆: "配偶", 老公: "配偶", father: "父亲", dad: "父亲", 爸爸: "父亲", mother: "母亲", mom: "母亲", 妈妈: "母亲", child: "子女", son: "子女", daughter: "子女", 儿子: "子女", 女儿: "子女" };
  return (typeof v === "string" && map[v.trim().toLowerCase()]) || "其他";
}

// ------------------------------------------------------------------ indicators

export function resolveIndicatorOrThrow(query: string, unit?: string | null): IndicatorDef {
  const q = (query ?? "").trim();
  const direct = getIndicator(q.toUpperCase());
  if (direct) return direct;
  const hit = mapIndicator(q, { unit: unit ?? undefined });
  if (hit) return getIndicator(hit.code)!;
  const suggestions = searchIndicators(q, 5).map((d) => ({ code: d.code, name: d.zh, unit: d.unit }));
  throw new UserFacingError(`无法识别指标“${query}”。`, "indicator_not_found", { suggestions });
}

// ------------------------------------------------------------------ interventions

export const INTERVENTION_CATEGORIES = ["饮食", "运动", "药物", "睡眠", "体重管理", "其他"] as const;

export function normalizeCategory(v: unknown): (typeof INTERVENTION_CATEGORIES)[number] {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if ((INTERVENTION_CATEGORIES as readonly string[]).includes(s)) return s as (typeof INTERVENTION_CATEGORIES)[number];
  if (/exercise|sport|运动|跑|走|健身|游泳|骑|锻炼|瑜伽|力量/.test(s)) return "运动";
  if (/med|drug|药|他汀|二甲双胍|降压|补充剂|维生素/.test(s)) return "药物";
  if (/diet|food|饮食|吃|碳水|控糖|少油|少盐|戒酒|饮酒|餐/.test(s)) return "饮食";
  if (/sleep|睡/.test(s)) return "睡眠";
  if (/weight|减重|减肥|体重|轻断食/.test(s)) return "体重管理";
  return "其他";
}

function dateOrThrow(input: unknown, field: string, fallbackToday: boolean): string {
  if ((input == null || input === "") && fallbackToday) return todayIso();
  const iso = resolveDate(typeof input === "string" ? input : String(input ?? ""));
  if (!iso) throw new UserFacingError(`无法理解日期“${String(input ?? "")}”（${field}），请提供 YYYY-MM-DD 格式的日期。`, "invalid_date", { field });
  return iso;
}

export function logIntervention(
  store: FamilyHealthStore,
  input: { member: string; category?: string; title: string; description?: string; startDate?: string; endDate?: string | null; createdVia?: string },
): { member: MemberRow; intervention: InterventionRow } {
  const member = resolveMemberOrThrow(store, input.member);
  const title = (input.title ?? "").trim();
  if (!title) throw new UserFacingError("请提供干预措施的名称，例如“每周3次快走”。", "missing_title");
  const startDate = dateOrThrow(input.startDate, "start_date", true);
  const endDate = input.endDate ? dateOrThrow(input.endDate, "end_date", false) : null;
  if (endDate && endDate < startDate) throw new UserFacingError("结束日期不能早于开始日期。", "invalid_date");
  const intervention = store.createIntervention({
    memberId: member.id,
    category: normalizeCategory(input.category ?? title),
    title,
    description: (input.description ?? "").trim(),
    startDate,
    endDate,
    createdVia: input.createdVia ?? "chat",
  });
  return { member, intervention };
}

export function endIntervention(
  store: FamilyHealthStore,
  input: { member?: string; interventionId?: string; title?: string; endDate?: string },
): InterventionRow {
  let target: InterventionRow | undefined;
  if (input.interventionId) {
    target = store.getIntervention(input.interventionId);
    if (!target) throw new UserFacingError("找不到这条干预记录。", "intervention_not_found");
  } else {
    const member = resolveMemberOrThrow(store, input.member);
    const active = store.listActiveInterventions(member.id, todayIso());
    const q = (input.title ?? "").trim();
    // Title matches win; fall back to the category only when no title matches.
    const byTitle = q ? active.filter((iv) => iv.title.includes(q) || q.includes(iv.title)) : [];
    const matches = !q ? active : byTitle.length ? byTitle : active.filter((iv) => iv.category === normalizeCategory(q));
    if (matches.length !== 1) {
      throw new UserFacingError(
        matches.length === 0 ? "没有找到匹配的进行中干预措施。" : "有多条进行中的干预措施，请说明要结束哪一条。",
        matches.length === 0 ? "intervention_not_found" : "ambiguous_intervention",
        { candidates: (matches.length ? matches : active).map((iv) => ({ id: iv.id, title: iv.title, category: iv.category, startDate: iv.startDate })) },
      );
    }
    target = matches[0];
  }
  const endDate = dateOrThrow(input.endDate, "end_date", true);
  if (endDate < target.startDate) throw new UserFacingError("结束日期不能早于开始日期。", "invalid_date");
  return store.updateIntervention(target.id, { endDate })!;
}

// ------------------------------------------------------------------ measurements

export function logMeasurement(
  store: FamilyHealthStore,
  input: { member: string; indicator: string; value: string | number; unit?: string | null; date?: string; note?: string; createdVia?: string },
): { member: MemberRow; measurements: MeasurementRow[] } {
  const member = resolveMemberOrThrow(store, input.member);
  const measuredAt = dateOrThrow(input.date, "date", true);
  const note = (input.note ?? "").trim();
  const via = input.createdVia ?? "chat";
  const raw = String(input.value ?? "").trim();
  if (!raw) throw new UserFacingError("请提供测量数值。", "missing_value");

  // Blood pressure pairs: "128/82" with indicator 血压 / BP.
  const bp = splitBloodPressure(raw);
  if (bp && /血压|bp|blood\s*pressure|收缩|舒张/i.test(input.indicator)) {
    const rows = [
      store.createMeasurement({ memberId: member.id, indicatorCode: "SBP", value: bp.sbp, unit: "mmHg", rawValue: raw, rawUnit: input.unit ?? "mmHg", measuredAt, note, createdVia: via }),
      store.createMeasurement({ memberId: member.id, indicatorCode: "DBP", value: bp.dbp, unit: "mmHg", rawValue: raw, rawUnit: input.unit ?? "mmHg", measuredAt, note, createdVia: via }),
    ];
    return { member, measurements: rows };
  }

  const def = resolveIndicatorOrThrow(input.indicator, input.unit);
  const parsed = parseResultValue(raw);
  if (parsed.num == null) throw new UserFacingError(`“${raw}”不是有效的数值。`, "invalid_value");
  // A unit may be embedded in the value (e.g. "62.5kg").
  const embeddedUnit = raw.replace(/^[<>]?\s*-?[\d.,]+\s*/, "").trim();
  const unit = input.unit || embeddedUnit || def.unit;
  const conv = toCanonical(parsed.num, unit, def);
  if (conv.status === "incompatible") {
    throw new UserFacingError(`单位“${unit}”无法换算为${def.zh}的标准单位 ${def.unit}。`, "incompatible_unit", { expectedUnit: def.unit });
  }
  const row = store.createMeasurement({
    memberId: member.id,
    indicatorCode: def.code,
    value: conv.value,
    unit: def.unit,
    rawValue: raw,
    rawUnit: normalizeUnit(unit),
    measuredAt,
    note,
    createdVia: via,
  });
  return { member, measurements: [row] };
}

// ------------------------------------------------------------------ read models

export function loadMemberData(store: FamilyHealthStore, member: MemberRow) {
  const ctx = memberCtx(member);
  const snaps = buildSnapshots(store.listMemberResults(member.id), ctx);
  return { ctx, snaps, measurements: store.listMeasurements(member.id), findings: store.listMemberFindings(member.id), interventions: store.listInterventions(member.id) };
}

export function memberCard(store: FamilyHealthStore, member: MemberRow, today = todayIso()) {
  const d = loadMemberData(store, member);
  const overview = memberOverview({ ...d.ctx, goals: member.goals }, d.snaps, d.findings);
  const pending = store.listReports({ memberId: member.id }).filter((r) => r.status !== "confirmed").length;
  return {
    member: publicMember(member, today),
    overview,
    pendingReports: pending,
    activeInterventions: store.listActiveInterventions(member.id, today).map(publicIntervention),
  };
}

export function publicIntervention(iv: InterventionRow) {
  return { id: iv.id, memberId: iv.memberId, category: iv.category, title: iv.title, description: iv.description, startDate: iv.startDate, endDate: iv.endDate, createdVia: iv.createdVia };
}

export function memberPanel(store: FamilyHealthStore, member: MemberRow, panelKey: string) {
  const d = loadMemberData(store, member);
  return panelData(panelKey, d.ctx, d.snaps, d.measurements, d.findings);
}

export function memberAllIndicators(store: FamilyHealthStore, member: MemberRow) {
  const d = loadMemberData(store, member);
  return allIndicators(d.ctx, d.snaps, d.measurements);
}

export function memberIndicatorDetail(store: FamilyHealthStore, member: MemberRow, code: string) {
  const d = loadMemberData(store, member);
  const detail = indicatorDetail(code, d.ctx, d.snaps, d.measurements, d.interventions, todayIso());
  if (!detail) return null;
  return { ...detail, insight: store.getInsight("indicator", `${member.id}:${code}`) ?? null };
}

export function memberFindings(store: FamilyHealthStore, member: MemberRow) {
  return findingsTimeline(store.listMemberFindings(member.id));
}

/**
 * Compact JSON for the chat agent: latest abnormal results, one indicator's
 * history (reports + home measurements), findings timeline, interventions.
 */
export function queryMember(store: FamilyHealthStore, input: { member: string; indicator?: string; from?: string; to?: string }) {
  const member = resolveMemberOrThrow(store, input.member);
  const d = loadMemberData(store, member);
  const from = input.from ? resolveDate(input.from) : null;
  const to = input.to ? resolveDate(input.to) : null;
  const inRange = (date: string) => (!from || date >= from) && (!to || date <= to);
  const overview = memberOverview({ ...d.ctx, goals: member.goals }, d.snaps, d.findings);
  const latest = d.snaps.at(-1);

  const out: Record<string, unknown> = {
    member: { id: member.id, name: member.name, relation: member.relation, sex: member.sex === "male" ? "男" : member.sex === "female" ? "女" : null, age: ageAt(member.birthDate, todayIso()) },
    exams: d.snaps.filter((s) => inRange(s.examDate)).map((s) => ({ date: s.examDate, provider: s.provider })),
    latest_exam: latest
      ? {
          date: latest.examDate,
          abnormal: [...latest.values.values()]
            .filter((v) => isConcerning(v.flag, getIndicator(v.code)))
            .map((v) => ({ name: getIndicator(v.code)?.zh ?? v.code, value: v.value ?? v.valueText, unit: v.unit, flag: v.flag })),
        }
      : null,
    alerts: overview.alerts.map((a) => ({ name: a.name, level: a.level === "urgent" ? "建议尽快就医" : "建议近期就诊", message: a.message })),
    findings: findingsTimeline(d.findings).map((f) => ({ name: f.name, timeline: f.summary })),
    active_interventions: store.listActiveInterventions(member.id, todayIso()).map((iv) => ({ id: iv.id, category: iv.category, title: iv.title, since: iv.startDate })),
    disclaimer: DISCLAIMER,
  };
  if (input.indicator) {
    const def = resolveIndicatorOrThrow(input.indicator);
    const detail = indicatorDetail(def.code, d.ctx, d.snaps, d.measurements, d.interventions, todayIso())!;
    out.indicator = {
      code: def.code,
      name: def.zh,
      unit: def.unit,
      reference: formatRange(detail.band),
      explain: def.explain,
      history: detail.points
        .filter((p) => inRange(p.date))
        .map((p) => ({ date: p.date, value: p.value ?? p.valueText, flag: p.flag, source: p.source === "measurement" ? "自测" : p.source === "derived" ? "计算" : "体检" })),
      interventions_in_period: detail.interventions.map((iv) => ({ title: iv.title, category: iv.category, start: iv.startDate, end: iv.endDate })),
      note: "干预与指标变化只能说明时间上同时发生，不代表因果关系。",
    };
  }
  return out;
}

// ------------------------------------------------------------------ report cleanup

export function deleteReportFiles(reportId: string): void {
  try {
    rmSync(reportDir(reportId), { recursive: true, force: true });
  } catch {
    // Files are best-effort; the DB rows are authoritative.
  }
}

export function deleteReportFully(store: FamilyHealthStore, reportId: string): void {
  store.deleteReport(reportId);
  deleteReportFiles(reportId);
}

export function dataRoot(): string {
  return appDataDir();
}

export function findingName(key: string | null | undefined, fallback = "其他所见"): string {
  return getFinding(key)?.zh ?? fallback;
}
