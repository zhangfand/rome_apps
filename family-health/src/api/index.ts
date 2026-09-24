/**
 * HTTP API for 家庭体检助手 (`/api/apps/family-health/...`).
 *
 * Family medical data: every route except `status` is guardian-only, even if
 * the app is later shared. Uploads are raw binary bodies, one file per
 * request. Long work (extraction, AI interpretation) is dispatched as detached
 * actions; the UI polls the persisted status.
 */
import { existsSync, readFileSync } from "node:fs";
import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { FINDINGS, getFinding } from "../domain/findings.js";
import { CATEGORIES, INDICATORS, getIndicator } from "../domain/indicators.js";
import { mapIndicator, searchIndicators } from "../domain/mapping.js";
import { GOAL_PANELS, getPanel, sanitizeGoals } from "../domain/panels.js";
import { RELATIONS } from "../domain/types.js";
import { FamilyHealthStore, type FindingRow, type ReportRow, type ResultRow } from "../db/repositories/store.js";
import { normalizeExamDate, resolveDate, todayIso } from "../lib/dates.js";
import { STALE_EXTRACTION_MS, isStaleExtraction, renormalizeResult } from "../lib/extraction.js";
import { reportAlerts } from "../lib/insights.js";
import { processUploadIsolated } from "../lib/media-runner.js";
import { clearDemoData, seedDemoData } from "../lib/seed.js";
import {
  DISCLAIMER,
  INTERVENTION_CATEGORIES,
  UserFacingError,
  deleteReportFiles,
  deleteReportFully,
  logIntervention,
  logMeasurement,
  memberAllIndicators,
  memberCard,
  memberFindings,
  memberIndicatorDetail,
  memberPanel,
  normalizeCategory,
  normalizeRelation,
  normalizeSex,
  publicIntervention,
  publicMember,
} from "../lib/service.js";
import { reportDir, resolveStoredPath } from "../lib/storage.js";

const APP = "family-health";
/** Hard cap per uploaded file (the host's own body limit may be lower). */
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) => json({ error, message, ...extra }, status);

function readJson(request: RomeAppApiRequest): Record<string, unknown> {
  if (!request.body || request.body.byteLength === 0) return {};
  try {
    const v = JSON.parse(new TextDecoder().decode(request.body));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    throw new UserFacingError("请求内容不是有效的 JSON", "invalid_json");
  }
}

const optStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const optNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

// ------------------------------------------------------------------ serializers

function pageUrl(reportId: string, page: number) {
  return `/api/apps/${APP}/reports/${reportId}/pages/${page}`;
}

export function publicReport(r: ReportRow, now = new Date()) {
  return {
    id: r.id,
    memberId: r.memberId,
    examDate: r.examDate,
    provider: r.provider,
    status: r.status,
    stale: isStaleExtraction(r, now),
    error: r.error,
    pagesDone: r.pagesDone,
    pagesTotal: r.pagesTotal,
    isDemo: r.isDemo,
    files: r.sourceFiles.map((f) => ({ name: f.name, mime: f.mime, size: f.size })),
    pages: r.pageImages.map((p) => ({ page: p.page, url: pageUrl(r.id, p.page), width: p.width, height: p.height, sourceIndex: p.sourceIndex })),
    confirmedAt: r.confirmedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function publicResult(r: ResultRow) {
  const def = getIndicator(r.indicatorCode);
  return {
    id: r.id,
    indicatorCode: r.indicatorCode,
    name: def?.zh ?? null,
    category: def?.category ?? null,
    direction: def?.direction ?? null,
    rawName: r.rawName,
    rawValue: r.rawValue,
    valueNum: r.valueNum,
    valueText: r.valueText,
    rawUnit: r.rawUnit,
    unit: r.unit,
    refLow: r.refLow,
    refHigh: r.refHigh,
    refText: r.refText,
    flag: r.flag,
    section: r.section,
    page: r.page,
    confidence: r.confidence,
    source: r.source,
    confirmed: r.confirmed,
  };
}

function publicFinding(f: FindingRow) {
  return { id: f.id, findingKey: f.findingKey, name: getFinding(f.findingKey)?.zh ?? null, organ: f.organ, severity: f.severity, rawText: f.rawText, page: f.page, examDate: f.examDate, confirmed: f.confirmed };
}

function reportDetail(store: FamilyHealthStore, r: ReportRow) {
  const { alerts, findingAlerts } = reportAlerts(store, r.id);
  const member = store.getMember(r.memberId);
  return {
    report: publicReport(r),
    member: member ? publicMember(member) : null,
    results: store.listReportResults(r.id).map(publicResult),
    findings: store.listReportFindings(r.id).map(publicFinding),
    alerts,
    findingAlerts,
    insight: store.getInsight("report", r.id) ?? null,
    disclaimer: DISCLAIMER,
  };
}

// ------------------------------------------------------------------ router

type Params = Record<string, string>;
type Handler = (req: RomeAppApiRequest, p: Params) => Promise<Response> | Response;
interface Route {
  method: string;
  parts: string[];
  handler: Handler;
}

class FamilyHealthApi implements RomeAppApiHandler {
  private readonly routes: Route[] = [];
  private storeInstance: FamilyHealthStore | null = null;

  constructor(private readonly ctx: RomeAppContext) {
    this.register();
  }

  private get store(): FamilyHealthStore {
    this.storeInstance ??= new FamilyHealthStore(this.ctx.db);
    return this.storeInstance;
  }

  private on(method: string, pattern: string, handler: Handler) {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
  }

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const path = request.path.filter(Boolean);
    if (request.method === "GET" && path.join("/") === "status") {
      return json({ appId: this.ctx.app.id, version: this.ctx.app.version, status: "ok" });
    }
    if (request.caller && request.caller.kind !== "guardian") {
      return fail(403, "forbidden", "家庭健康数据仅限主人访问");
    }
    for (const route of this.routes) {
      if (route.method !== request.method || route.parts.length !== path.length) continue;
      const params: Params = {};
      let match = true;
      for (let i = 0; i < route.parts.length; i++) {
        const part = route.parts[i];
        if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(path[i]);
        else if (part !== path[i]) {
          match = false;
          break;
        }
      }
      if (!match) continue;
      try {
        return await route.handler(request, params);
      } catch (err) {
        if (err instanceof UserFacingError) return fail(400, err.code, err.message, err.details ?? {});
        this.ctx.log.error("api error", { path: path.join("/"), error: (err as Error).message });
        return fail(500, "internal_error", `服务器出错：${(err as Error).message}`);
      }
    }
    return fail(404, "not_found", `未知接口：/${path.join("/")}`);
  }

  private member(id: string) {
    const m = this.store.getMember(id);
    if (!m) throw new UserFacingError("成员不存在", "member_not_found");
    return m;
  }

  private report(id: string) {
    const r = this.store.getReport(id);
    if (!r) throw new UserFacingError("报告不存在", "report_not_found");
    return r;
  }

  private async dispatch(action: string, args: Record<string, unknown>) {
    return this.ctx.runAction(`${APP}:${action}`, args, { detached: true });
  }

  private register() {
    const s = () => this.store;

    // ---- meta
    this.on("GET", "meta", () =>
      json({
        categories: CATEGORIES,
        panels: GOAL_PANELS.map((p) => ({ key: p.key, name: p.zh, description: p.description })),
        findings: FINDINGS.map((f) => ({ key: f.key, name: f.zh, organ: f.organ })),
        relations: RELATIONS,
        interventionCategories: INTERVENTION_CATEGORIES,
        disclaimer: DISCLAIMER,
        maxUploadBytes: MAX_UPLOAD_BYTES,
      }),
    );
    this.on("GET", "indicators", () =>
      json({ indicators: INDICATORS.map((d) => ({ code: d.code, name: d.zh, en: d.en, category: d.category, unit: d.unit, valueType: d.valueType, derived: !!d.derived })) }),
    );
    this.on("GET", "indicators/search", (req) => {
      const q = req.query.get("q") ?? "";
      const limit = Math.min(Number(req.query.get("limit") ?? 20) || 20, 50);
      return json({ results: searchIndicators(q, limit).map((d) => ({ code: d.code, name: d.zh, en: d.en, category: d.category, unit: d.unit, aliases: d.aliases.slice(0, 6) })) });
    });

    // ---- overview
    this.on("GET", "overview", () => {
      const today = todayIso();
      const members = s().listMembers();
      return json({
        members: members.map((m) => memberCard(s(), m, today)),
        hasDemo: members.some((m) => m.isDemo),
        disclaimer: DISCLAIMER,
      });
    });

    // ---- members
    this.on("GET", "members", () => json({ members: s().listMembers().map((m) => publicMember(m)) }));
    this.on("POST", "members", (req) => {
      const b = readJson(req);
      const name = optStr(b.name);
      if (!name) throw new UserFacingError("请填写姓名", "missing_name");
      const birthDate = optStr(b.birthDate);
      if (birthDate && !resolveDate(birthDate)) throw new UserFacingError("出生日期格式不正确", "invalid_date");
      const m = s().createMember({
        name,
        relation: normalizeRelation(b.relation),
        sex: normalizeSex(b.sex),
        birthDate: birthDate ? resolveDate(birthDate) : null,
        heightCm: optNum(b.heightCm),
        goals: sanitizeGoals(b.goals),
        notes: optStr(b.notes) ?? "",
      });
      return json({ member: publicMember(m) }, 201);
    });
    this.on("GET", "members/:id", (_req, p) => {
      const m = this.member(p.id);
      return json({ ...memberCard(s(), m), reports: s().listReports({ memberId: m.id }).map((r) => publicReport(r)), disclaimer: DISCLAIMER });
    });
    this.on("PATCH", "members/:id", (req, p) => {
      this.member(p.id);
      const b = readJson(req);
      const patch: Parameters<FamilyHealthStore["updateMember"]>[1] = {};
      if ("name" in b) {
        const name = optStr(b.name);
        if (!name) throw new UserFacingError("姓名不能为空", "missing_name");
        patch.name = name;
      }
      if ("relation" in b) patch.relation = normalizeRelation(b.relation);
      if ("sex" in b) patch.sex = normalizeSex(b.sex);
      if ("birthDate" in b) {
        const bd = optStr(b.birthDate);
        if (bd && !resolveDate(bd)) throw new UserFacingError("出生日期格式不正确", "invalid_date");
        patch.birthDate = bd ? resolveDate(bd) : null;
      }
      if ("heightCm" in b) patch.heightCm = optNum(b.heightCm);
      if ("goals" in b) patch.goals = sanitizeGoals(b.goals);
      if ("notes" in b) patch.notes = typeof b.notes === "string" ? b.notes : "";
      return json({ member: publicMember(s().updateMember(p.id, patch)!) });
    });
    this.on("DELETE", "members/:id", (_req, p) => {
      this.member(p.id);
      const reportIds = s().deleteMember(p.id);
      for (const id of reportIds) deleteReportFiles(id);
      return json({ deleted: true, reports: reportIds.length });
    });
    this.on("GET", "members/:id/panels/:key", (_req, p) => {
      const m = this.member(p.id);
      if (!getPanel(p.key)) throw new UserFacingError("未知的关注目标", "panel_not_found");
      return json({ panel: memberPanel(s(), m, p.key) });
    });
    this.on("GET", "members/:id/indicators", (_req, p) => json({ categories: memberAllIndicators(s(), this.member(p.id)) }));
    this.on("GET", "members/:id/indicators/:code", (_req, p) => {
      const detail = memberIndicatorDetail(s(), this.member(p.id), p.code.toUpperCase());
      if (!detail) throw new UserFacingError("未知指标", "indicator_not_found");
      return json({ indicator: detail, disclaimer: DISCLAIMER });
    });
    this.on("GET", "members/:id/findings", (_req, p) => json({ findings: memberFindings(s(), this.member(p.id)) }));

    // ---- interventions
    this.on("GET", "members/:id/interventions", (_req, p) => json({ interventions: s().listInterventions(this.member(p.id).id).map(publicIntervention) }));
    this.on("POST", "members/:id/interventions", (req, p) => {
      const b = readJson(req);
      const { intervention } = logIntervention(s(), {
        member: this.member(p.id).id,
        category: optStr(b.category) ?? undefined,
        title: optStr(b.title) ?? "",
        description: optStr(b.description) ?? "",
        startDate: optStr(b.startDate) ?? undefined,
        endDate: optStr(b.endDate),
        createdVia: "ui",
      });
      return json({ intervention: publicIntervention(intervention) }, 201);
    });
    this.on("PATCH", "interventions/:id", (req, p) => {
      const iv = s().getIntervention(p.id);
      if (!iv) throw new UserFacingError("干预记录不存在", "intervention_not_found");
      const b = readJson(req);
      const patch: Record<string, unknown> = {};
      if ("title" in b) {
        const t = optStr(b.title);
        if (!t) throw new UserFacingError("名称不能为空", "missing_title");
        patch.title = t;
      }
      if ("category" in b) patch.category = normalizeCategory(b.category);
      if ("description" in b) patch.description = typeof b.description === "string" ? b.description : "";
      if ("startDate" in b) {
        const d = resolveDate(optStr(b.startDate));
        if (!d) throw new UserFacingError("开始日期格式不正确", "invalid_date");
        patch.startDate = d;
      }
      if ("endDate" in b) {
        const raw = optStr(b.endDate);
        const d = raw ? resolveDate(raw) : null;
        if (raw && !d) throw new UserFacingError("结束日期格式不正确", "invalid_date");
        patch.endDate = d;
      }
      const start = (patch.startDate as string) ?? iv.startDate;
      const end = "endDate" in patch ? (patch.endDate as string | null) : iv.endDate;
      if (end && end < start) throw new UserFacingError("结束日期不能早于开始日期", "invalid_date");
      return json({ intervention: publicIntervention(s().updateIntervention(p.id, patch)!) });
    });
    this.on("DELETE", "interventions/:id", (_req, p) => {
      s().deleteIntervention(p.id);
      return json({ deleted: true });
    });

    // ---- measurements
    this.on("GET", "members/:id/measurements", (req, p) => {
      const code = req.query.get("code") ?? undefined;
      return json({
        measurements: s()
          .listMeasurements(this.member(p.id).id, code?.toUpperCase())
          .map((m) => ({ id: m.id, indicatorCode: m.indicatorCode, name: getIndicator(m.indicatorCode)?.zh ?? m.indicatorCode, value: m.value, unit: m.unit, rawValue: m.rawValue, rawUnit: m.rawUnit, measuredAt: m.measuredAt, note: m.note, createdVia: m.createdVia })),
      });
    });
    this.on("POST", "members/:id/measurements", (req, p) => {
      const b = readJson(req);
      const { measurements } = logMeasurement(s(), {
        member: this.member(p.id).id,
        indicator: optStr(b.indicator) ?? "",
        value: typeof b.value === "number" ? b.value : optStr(b.value) ?? "",
        unit: optStr(b.unit),
        date: optStr(b.date) ?? undefined,
        note: optStr(b.note) ?? "",
        createdVia: "ui",
      });
      return json({ measurements }, 201);
    });
    this.on("DELETE", "measurements/:id", (_req, p) => json({ deleted: s().deleteMeasurement(p.id) }));

    // ---- reports
    this.on("GET", "reports", (req) => {
      const memberId = req.query.get("memberId") ?? undefined;
      return json({ reports: s().listReports({ memberId }).map((r) => publicReport(r)) });
    });
    this.on("POST", "reports", (req) => {
      const b = readJson(req);
      const member = this.member(optStr(b.memberId) ?? "");
      const rawDate = optStr(b.examDate);
      const examDate = rawDate ? normalizeExamDate(rawDate) : null;
      if (rawDate && !examDate) throw new UserFacingError("体检日期格式不正确", "invalid_date");
      const r = s().createReport({ memberId: member.id, examDate, provider: optStr(b.provider) ?? "" });
      return json({ report: publicReport(r) }, 201);
    });
    this.on("GET", "reports/:id", (_req, p) => json(reportDetail(s(), this.report(p.id))));
    this.on("PATCH", "reports/:id", (req, p) => {
      const r = this.report(p.id);
      const b = readJson(req);
      const patch: Partial<ReportRow> = {};
      if ("examDate" in b) {
        const raw = optStr(b.examDate);
        const d = raw ? normalizeExamDate(raw) : null;
        if (raw && !d) throw new UserFacingError("体检日期格式不正确", "invalid_date");
        patch.examDate = d;
      }
      if ("provider" in b) patch.provider = optStr(b.provider) ?? "";
      if ("memberId" in b && optStr(b.memberId) !== r.memberId) {
        const m = this.member(optStr(b.memberId) ?? "");
        patch.memberId = m.id;
      }
      const updated = s().updateReport(p.id, patch)!;
      if (patch.memberId || "examDate" in patch) {
        // Keep denormalized columns of child rows in sync.
        for (const row of s().listReportResults(p.id)) s().updateResult(row.id, { memberId: updated.memberId });
        for (const f of s().listReportFindings(p.id)) s().updateFinding(f.id, { memberId: updated.memberId, examDate: updated.examDate });
      }
      return json(reportDetail(s(), updated));
    });
    this.on("DELETE", "reports/:id", (_req, p) => {
      this.report(p.id);
      deleteReportFully(s(), p.id);
      return json({ deleted: true });
    });

    // Upload one file (raw body). `?name=` carries the original file name.
    this.on("POST", "reports/:id/files", async (req, p) => {
      const r = this.report(p.id);
      if (r.status === "confirmed") throw new UserFacingError("报告已确认，不能再添加文件", "report_confirmed");
      if (r.status === "extracting" && !isStaleExtraction(r)) throw new UserFacingError("正在识别中，请稍后再上传", "busy");
      const body = req.body;
      if (!body || body.byteLength === 0) throw new UserFacingError("没有收到文件内容", "empty_body");
      if (body.byteLength > MAX_UPLOAD_BYTES) {
        return fail(413, "file_too_large", `文件过大（${(body.byteLength / 1048576).toFixed(1)} MB），单个文件请不超过 ${MAX_UPLOAD_BYTES / 1048576} MB，可拆分 PDF 或分批拍照上传。`);
      }
      const name = (req.query.get("name") ?? "upload").slice(0, 200);
      const stem = `f${String(r.sourceFiles.length).padStart(2, "0")}-${Date.now().toString(36)}`;
      const processed = await processUploadIsolated(body, name, reportDir(r.id), stem).catch((err: Error) => {
        throw new UserFacingError(err.message, "upload_failed");
      });
      const updated = s().appendSourceFile(r.id, { name, path: processed.sourcePath, mime: processed.mime, size: body.byteLength }, processed.pages)!;
      // New pages invalidate a previous extraction.
      if (updated.status !== "uploaded") s().updateReport(r.id, { status: "uploaded", error: null, pagesDone: 0 });
      return json({ report: publicReport(s().getReport(r.id)!), added: processed.pages.length }, 201);
    });

    this.on("GET", "reports/:id/pages/:page", (req, p) => {
      const r = this.report(p.id);
      const page = r.pageImages.find((x) => x.page === Number(p.page));
      const safe = page ? resolveStoredPath(page.path) : null;
      if (!page || !safe || !existsSync(safe)) return fail(404, "not_found", "页面不存在");
      const etag = `"${r.id}-${page.page}-${r.pageImages.length}"`;
      const headers = { "content-type": "image/jpeg", "cache-control": "private, max-age=86400", etag };
      if (req.headers["if-none-match"] === etag) return new Response(null, { status: 304, headers });
      return new Response(new Uint8Array(readFileSync(safe)) as unknown as BodyInit, { headers });
    });

    this.on("POST", "reports/:id/extract", async (_req, p) => {
      const r = this.report(p.id);
      if (r.status === "confirmed") throw new UserFacingError("报告已确认，不能重新识别", "report_confirmed");
      if (r.status === "extracting" && !isStaleExtraction(r)) throw new UserFacingError(`正在识别中（超过 ${STALE_EXTRACTION_MS / 60000} 分钟无进展可重试）`, "busy");
      if (r.pageImages.length === 0) throw new UserFacingError("请先上传报告文件", "no_pages");
      s().updateReport(r.id, { status: "extracting", error: null, pagesDone: 0, pagesTotal: r.pageImages.length });
      try {
        await this.dispatch("family_health_extract_report", { report_id: r.id });
      } catch (err) {
        s().updateReport(r.id, { status: "failed", error: `无法启动识别：${(err as Error).message}` });
        throw new UserFacingError(`无法启动识别：${(err as Error).message}`, "dispatch_failed");
      }
      return json({ report: publicReport(s().getReport(r.id)!) }, 202);
    });

    this.on("POST", "reports/:id/confirm", async (_req, p) => {
      const r = this.report(p.id);
      if (r.status !== "needs_review") throw new UserFacingError("只有“待确认”的报告可以确认", "invalid_status");
      if (!r.examDate) throw new UserFacingError("请先填写体检日期再确认", "missing_exam_date");
      s().confirmReport(r.id);
      // Mark the interpretation pending so the UI shows progress immediately.
      s().upsertInsight({ scope: "report", scopeId: r.id, memberId: r.memberId, status: "pending", content: null, markdown: null, error: null, model: null, promptVersion: "report-v1", inputHash: null });
      try {
        await this.dispatch("family_health_generate_insight", { scope: "report", report_id: r.id });
      } catch (err) {
        s().upsertInsight({ scope: "report", scopeId: r.id, memberId: r.memberId, status: "failed", content: null, markdown: null, error: `无法启动解读：${(err as Error).message}`, model: null, promptVersion: "report-v1", inputHash: null });
      }
      return json(reportDetail(s(), s().getReport(r.id)!));
    });

    // ---- review edits: results
    this.on("POST", "reports/:id/results", (req, p) => {
      const r = this.report(p.id);
      const b = readJson(req);
      const rawName = optStr(b.rawName) ?? getIndicator(optStr(b.indicatorCode))?.zh;
      const rawValue = optStr(b.rawValue) ?? (typeof b.rawValue === "number" ? String(b.rawValue) : null);
      if (!rawName || rawValue == null) throw new UserFacingError("请填写项目名称和结果", "missing_fields");
      const sex = this.memberSex(r.memberId);
      const norm = renormalizeResult({ rawName, rawValue, rawUnit: optStr(b.rawUnit) ?? "", refText: optStr(b.refText), indicatorCode: optStr(b.indicatorCode) ?? mapOnly(rawName) }, sex);
      const existing = s().listReportResults(r.id);
      s().insertResults([
        {
          reportId: r.id,
          memberId: r.memberId,
          rawName,
          rawValue,
          rawUnit: optStr(b.rawUnit) ?? "",
          refText: optStr(b.refText),
          section: optStr(b.section),
          page: optNum(b.page),
          confidence: null,
          source: "manual",
          confirmed: r.status === "confirmed",
          sortOrder: existing.length,
          ...norm,
        },
      ]);
      return json(reportDetail(s(), s().getReport(r.id)!), 201);
    });
    this.on("PATCH", "results/:id", (req, p) => {
      const row = s().getResult(p.id);
      if (!row) throw new UserFacingError("结果不存在", "result_not_found");
      const b = readJson(req);
      const next = {
        rawName: "rawName" in b ? optStr(b.rawName) ?? row.rawName : row.rawName,
        rawValue: "rawValue" in b ? (typeof b.rawValue === "number" ? String(b.rawValue) : optStr(b.rawValue) ?? "") : row.rawValue,
        rawUnit: "rawUnit" in b ? optStr(b.rawUnit) ?? "" : row.rawUnit,
        refText: "refText" in b ? optStr(b.refText) : row.refText,
        indicatorCode: "indicatorCode" in b ? optStr(b.indicatorCode) : row.indicatorCode,
        section: row.section,
      };
      if (next.indicatorCode && !getIndicator(next.indicatorCode)) throw new UserFacingError("未知指标代码", "indicator_not_found");
      const norm = renormalizeResult(next, this.memberSex(row.memberId));
      s().updateResult(p.id, { rawName: next.rawName, rawValue: next.rawValue, rawUnit: next.rawUnit, refText: next.refText, ...norm, confidence: "indicatorCode" in b ? 1 : row.confidence });
      return json(reportDetail(s(), this.report(row.reportId)));
    });
    this.on("DELETE", "results/:id", (_req, p) => {
      const row = s().getResult(p.id);
      if (!row) throw new UserFacingError("结果不存在", "result_not_found");
      s().deleteResult(p.id);
      return json(reportDetail(s(), this.report(row.reportId)));
    });

    // ---- review edits: findings
    this.on("POST", "reports/:id/findings", (req, p) => {
      const r = this.report(p.id);
      const b = readJson(req);
      const rawText = optStr(b.rawText);
      if (!rawText) throw new UserFacingError("请填写结论原文", "missing_fields");
      const key = optStr(b.findingKey);
      if (key && !getFinding(key)) throw new UserFacingError("未知的结论类型", "finding_key_invalid");
      s().insertFindings([{ reportId: r.id, memberId: r.memberId, examDate: r.examDate, organ: optStr(b.organ) ?? getFinding(key)?.organ ?? "", findingKey: key, severity: optStr(b.severity), rawText, page: optNum(b.page), confirmed: r.status === "confirmed" }]);
      return json(reportDetail(s(), s().getReport(r.id)!), 201);
    });
    this.on("PATCH", "findings/:id", (req, p) => {
      const f = s().getFinding(p.id);
      if (!f) throw new UserFacingError("结论不存在", "finding_not_found");
      const b = readJson(req);
      const patch: Partial<FindingRow> = {};
      if ("findingKey" in b) {
        const key = optStr(b.findingKey);
        if (key && !getFinding(key)) throw new UserFacingError("未知的结论类型", "finding_key_invalid");
        patch.findingKey = key;
      }
      if ("severity" in b) patch.severity = optStr(b.severity);
      if ("organ" in b) patch.organ = optStr(b.organ) ?? "";
      if ("rawText" in b) {
        const t = optStr(b.rawText);
        if (!t) throw new UserFacingError("结论原文不能为空", "missing_fields");
        patch.rawText = t;
      }
      s().updateFinding(p.id, patch);
      return json(reportDetail(s(), this.report(f.reportId)));
    });
    this.on("DELETE", "findings/:id", (_req, p) => {
      const f = s().getFinding(p.id);
      if (!f) throw new UserFacingError("结论不存在", "finding_not_found");
      s().deleteFinding(p.id);
      return json(reportDetail(s(), this.report(f.reportId)));
    });

    // ---- insights
    this.on("GET", "insights", (req) => {
      const scope = req.query.get("scope") ?? "";
      const id = req.query.get("id") ?? "";
      return json({ insight: s().getInsight(scope, id) ?? null });
    });
    this.on("POST", "insights", async (req) => {
      const b = readJson(req);
      const scope = optStr(b.scope);
      const force = b.force === true;
      let scopeId: string;
      let memberId: string;
      let args: Record<string, unknown>;
      if (scope === "report") {
        const r = this.report(optStr(b.reportId) ?? "");
        if (r.status !== "confirmed") throw new UserFacingError("请先确认报告，再生成解读", "not_confirmed");
        scopeId = r.id;
        memberId = r.memberId;
        args = { scope, report_id: r.id, force };
      } else if (scope === "indicator") {
        const m = this.member(optStr(b.memberId) ?? "");
        const code = (optStr(b.code) ?? "").toUpperCase();
        if (!getIndicator(code)) throw new UserFacingError("未知指标", "indicator_not_found");
        scopeId = `${m.id}:${code}`;
        memberId = m.id;
        args = { scope, member_id: m.id, indicator: code, force };
      } else {
        throw new UserFacingError("scope 必须是 report 或 indicator", "invalid_scope");
      }
      const existing = s().getInsight(scope, scopeId);
      if (existing?.status === "pending" && Date.now() - existing.updatedAt.getTime() < 5 * 60_000) return json({ insight: existing }, 202);
      const pending = s().upsertInsight({ scope, scopeId, memberId, status: "pending", content: existing?.content ?? null, markdown: existing?.markdown ?? null, error: null, model: existing?.model ?? null, promptVersion: existing?.promptVersion ?? "v1", inputHash: existing?.inputHash ?? null });
      await this.dispatch("family_health_generate_insight", args);
      return json({ insight: pending }, 202);
    });

    // ---- demo
    this.on("POST", "demo/seed", () => json({ seeded: seedDemoData(s()) }));
    this.on("POST", "demo/clear", () => json({ cleared: clearDemoData(s()) }));
  }

  private memberSex(memberId: string) {
    const m = this.store.getMember(memberId);
    return m?.sex === "male" || m?.sex === "female" ? m.sex : null;
  }
}

/** For manual rows without an explicit code, use the deterministic mapping by name. */
function mapOnly(rawName: string): string | null {
  return mapIndicator(rawName)?.code ?? null;
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new FamilyHealthApi(ctx);
}
