/**
 * Data access for 家庭体检助手. All SQL goes through this class; API handlers
 * and actions never touch Drizzle tables directly. There are no SQL foreign
 * keys (shared system SQLite), so deletes cascade explicitly here.
 */
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema, type PageImage, type SourceFile } from "../schema.js";
import { syncIndicatorDefs } from "./indicator-defs.js";

type Tables = ReturnType<typeof createAppDbSchema>;
export type MemberRow = Tables["members"]["$inferSelect"];
export type ReportRow = Tables["reports"]["$inferSelect"];
export type ResultRow = Tables["results"]["$inferSelect"];
export type FindingRow = Tables["findings"]["$inferSelect"];
export type InterventionRow = Tables["interventions"]["$inferSelect"];
export type MeasurementRow = Tables["measurements"]["$inferSelect"];
export type InsightRow = Tables["insights"]["$inferSelect"];

export type ResultInsert = Omit<Tables["results"]["$inferInsert"], "id" | "createdAt" | "updatedAt"> & { id?: string };
export type FindingInsert = Omit<Tables["findings"]["$inferInsert"], "id" | "createdAt" | "updatedAt"> & { id?: string };

/** A confirmed (or report-scoped) result joined with its report's exam date. */
export interface DatedResult extends ResultRow {
  examDate: string | null;
  provider: string;
  reportStatus: string;
}

const RELATION_ORDER: Record<string, number> = { 本人: 0, 配偶: 1, 父亲: 2, 母亲: 3, 子女: 4, 其他: 5 };

const synced = new Set<string>();

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export class FamilyHealthStore {
  readonly t: Tables;
  readonly db: DrizzleDb;

  constructor(readonly ctx: AppDbContext) {
    this.t = createAppDbSchema(ctx.tablePrefix);
    this.db = ctx.connection;
    // Keep indicator_defs in step with the code dictionary once per process.
    if (!synced.has(ctx.tablePrefix)) {
      syncIndicatorDefs(ctx);
      synced.add(ctx.tablePrefix);
    }
  }

  // ---------------------------------------------------------------- members
  listMembers(): MemberRow[] {
    const rows = this.db.select().from(this.t.members).orderBy(asc(this.t.members.createdAt)).all();
    return rows.sort((a, b) => (RELATION_ORDER[a.relation] ?? 9) - (RELATION_ORDER[b.relation] ?? 9));
  }

  getMember(id: string): MemberRow | undefined {
    return this.db.select().from(this.t.members).where(eq(this.t.members.id, id)).get();
  }

  createMember(input: {
    id?: string;
    name: string;
    relation: string;
    sex?: string | null;
    birthDate?: string | null;
    heightCm?: number | null;
    goals?: string[];
    notes?: string;
    isDemo?: boolean;
  }): MemberRow {
    const now = new Date();
    const row = {
      id: input.id ?? newId("m"),
      name: input.name.trim(),
      relation: input.relation,
      sex: input.sex ?? null,
      birthDate: input.birthDate ?? null,
      heightCm: input.heightCm ?? null,
      goals: input.goals ?? [],
      notes: input.notes ?? "",
      isDemo: input.isDemo ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(this.t.members).values(row).run();
    return row;
  }

  updateMember(id: string, patch: Partial<Pick<MemberRow, "name" | "relation" | "sex" | "birthDate" | "heightCm" | "goals" | "notes">>): MemberRow | undefined {
    this.db.update(this.t.members).set({ ...patch, updatedAt: new Date() }).where(eq(this.t.members.id, id)).run();
    return this.getMember(id);
  }

  /** Delete a member and everything that belongs to them. Returns deleted report ids (for file cleanup). */
  deleteMember(id: string): string[] {
    const reportIds = this.listReports({ memberId: id }).map((r) => r.id);
    this.db.transaction((tx) => {
      tx.delete(this.t.results).where(eq(this.t.results.memberId, id)).run();
      tx.delete(this.t.findings).where(eq(this.t.findings.memberId, id)).run();
      tx.delete(this.t.reports).where(eq(this.t.reports.memberId, id)).run();
      tx.delete(this.t.interventions).where(eq(this.t.interventions.memberId, id)).run();
      tx.delete(this.t.measurements).where(eq(this.t.measurements.memberId, id)).run();
      tx.delete(this.t.insights).where(eq(this.t.insights.memberId, id)).run();
      tx.delete(this.t.members).where(eq(this.t.members.id, id)).run();
    });
    return reportIds;
  }

  // ---------------------------------------------------------------- reports
  listReports(filter: { memberId?: string; status?: string } = {}): ReportRow[] {
    const conds = [];
    if (filter.memberId) conds.push(eq(this.t.reports.memberId, filter.memberId));
    if (filter.status) conds.push(eq(this.t.reports.status, filter.status));
    return this.db
      .select()
      .from(this.t.reports)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(this.t.reports.examDate), desc(this.t.reports.createdAt))
      .all();
  }

  getReport(id: string): ReportRow | undefined {
    return this.db.select().from(this.t.reports).where(eq(this.t.reports.id, id)).get();
  }

  createReport(input: { id?: string; memberId: string; examDate?: string | null; provider?: string; status?: string; isDemo?: boolean; confirmedAt?: Date | null }): ReportRow {
    const now = new Date();
    const row = {
      id: input.id ?? newId("r"),
      memberId: input.memberId,
      examDate: input.examDate ?? null,
      provider: input.provider ?? "",
      sourceFiles: [] as SourceFile[],
      pageImages: [] as PageImage[],
      status: input.status ?? "uploaded",
      error: null,
      pagesDone: 0,
      pagesTotal: 0,
      isDemo: input.isDemo ?? false,
      confirmedAt: input.confirmedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(this.t.reports).values(row).run();
    return row;
  }

  updateReport(id: string, patch: Partial<Omit<ReportRow, "id" | "createdAt">>): ReportRow | undefined {
    this.db.update(this.t.reports).set({ ...patch, updatedAt: new Date() }).where(eq(this.t.reports.id, id)).run();
    return this.getReport(id);
  }

  /** Append a processed upload; pages are numbered continuously across files. */
  appendSourceFile(id: string, file: SourceFile, pages: Array<{ path: string; width: number; height: number }>): ReportRow | undefined {
    const report = this.getReport(id);
    if (!report) return undefined;
    const sourceIndex = report.sourceFiles.length;
    const start = report.pageImages.length;
    const pageImages = [
      ...report.pageImages,
      ...pages.map((p, i) => ({ page: start + i + 1, path: p.path, sourceIndex, width: p.width, height: p.height })),
    ];
    return this.updateReport(id, { sourceFiles: [...report.sourceFiles, file], pageImages, pagesTotal: pageImages.length });
  }

  deleteReport(id: string): void {
    this.db.transaction((tx) => {
      tx.delete(this.t.results).where(eq(this.t.results.reportId, id)).run();
      tx.delete(this.t.findings).where(eq(this.t.findings.reportId, id)).run();
      tx.delete(this.t.insights).where(and(eq(this.t.insights.scope, "report"), eq(this.t.insights.scopeId, id))).run();
      tx.delete(this.t.reports).where(eq(this.t.reports.id, id)).run();
    });
  }

  /** Reports stuck in `extracting` (e.g. the daemon restarted mid-run). */
  listStaleExtracting(olderThan: Date): ReportRow[] {
    return this.db
      .select()
      .from(this.t.reports)
      .where(and(eq(this.t.reports.status, "extracting"), lt(this.t.reports.updatedAt, olderThan)))
      .all();
  }

  /** Confirm a report: marks every result/finding confirmed. */
  confirmReport(id: string): ReportRow | undefined {
    const now = new Date();
    this.db.transaction((tx) => {
      tx.update(this.t.results).set({ confirmed: true, updatedAt: now }).where(eq(this.t.results.reportId, id)).run();
      tx.update(this.t.findings).set({ confirmed: true, updatedAt: now }).where(eq(this.t.findings.reportId, id)).run();
      tx.update(this.t.reports).set({ status: "confirmed", confirmedAt: now, updatedAt: now }).where(eq(this.t.reports.id, id)).run();
    });
    return this.getReport(id);
  }

  /** Re-open a confirmed report for edits: rows become unconfirmed again. */
  reopenReport(id: string): ReportRow | undefined {
    const now = new Date();
    this.db.transaction((tx) => {
      tx.update(this.t.results).set({ confirmed: false, updatedAt: now }).where(eq(this.t.results.reportId, id)).run();
      tx.update(this.t.findings).set({ confirmed: false, updatedAt: now }).where(eq(this.t.findings.reportId, id)).run();
      tx.update(this.t.reports).set({ status: "needs_review", confirmedAt: null, updatedAt: now }).where(eq(this.t.reports.id, id)).run();
    });
    return this.getReport(id);
  }

  // ---------------------------------------------------------------- results
  listReportResults(reportId: string): ResultRow[] {
    return this.db
      .select()
      .from(this.t.results)
      .where(eq(this.t.results.reportId, reportId))
      .orderBy(asc(this.t.results.sortOrder), asc(this.t.results.createdAt))
      .all();
  }

  /** Results joined with their report, for trends. `confirmedOnly` restricts to confirmed reports. */
  listMemberResults(memberId: string, opts: { confirmedOnly?: boolean; codes?: string[] } = {}): DatedResult[] {
    const r = this.t.results;
    const rep = this.t.reports;
    const conds = [eq(r.memberId, memberId)];
    if (opts.confirmedOnly !== false) conds.push(eq(rep.status, "confirmed"));
    if (opts.codes?.length) conds.push(inArray(r.indicatorCode, opts.codes));
    const rows = this.db
      .select({ result: r, examDate: rep.examDate, provider: rep.provider, reportStatus: rep.status })
      .from(r)
      .innerJoin(rep, eq(r.reportId, rep.id))
      .where(and(...conds))
      .orderBy(asc(rep.examDate), asc(r.sortOrder))
      .all();
    return rows.map((x) => ({ ...x.result, examDate: x.examDate, provider: x.provider, reportStatus: x.reportStatus }));
  }

  getResult(id: string): ResultRow | undefined {
    return this.db.select().from(this.t.results).where(eq(this.t.results.id, id)).get();
  }

  insertResults(rows: ResultInsert[]): void {
    if (rows.length === 0) return;
    const now = new Date();
    const values = rows.map((row) => ({ ...row, id: row.id ?? newId("res"), createdAt: now, updatedAt: now }));
    this.db.transaction((tx) => {
      // Chunk to stay well below SQLite's bound-parameter limit.
      for (let i = 0; i < values.length; i += 40) tx.insert(this.t.results).values(values.slice(i, i + 40)).run();
    });
  }

  updateResult(id: string, patch: Partial<Omit<ResultRow, "id" | "createdAt">>): ResultRow | undefined {
    this.db.update(this.t.results).set({ ...patch, updatedAt: new Date() }).where(eq(this.t.results.id, id)).run();
    return this.getResult(id);
  }

  deleteResult(id: string): void {
    this.db.delete(this.t.results).where(eq(this.t.results.id, id)).run();
  }

  /** Remove every extracted row of a report before a clean (re-)extraction. */
  clearReportRows(reportId: string): void {
    this.db.transaction((tx) => {
      tx.delete(this.t.results).where(eq(this.t.results.reportId, reportId)).run();
      tx.delete(this.t.findings).where(eq(this.t.findings.reportId, reportId)).run();
    });
  }

  // ---------------------------------------------------------------- findings
  listReportFindings(reportId: string): FindingRow[] {
    return this.db.select().from(this.t.findings).where(eq(this.t.findings.reportId, reportId)).orderBy(asc(this.t.findings.createdAt)).all();
  }

  listMemberFindings(memberId: string, opts: { confirmedOnly?: boolean } = {}): FindingRow[] {
    const conds = [eq(this.t.findings.memberId, memberId)];
    if (opts.confirmedOnly !== false) conds.push(eq(this.t.findings.confirmed, true));
    return this.db.select().from(this.t.findings).where(and(...conds)).orderBy(asc(this.t.findings.examDate)).all();
  }

  getFinding(id: string): FindingRow | undefined {
    return this.db.select().from(this.t.findings).where(eq(this.t.findings.id, id)).get();
  }

  insertFindings(rows: FindingInsert[]): void {
    if (rows.length === 0) return;
    const now = new Date();
    this.db.transaction((tx) => {
      for (const row of rows) tx.insert(this.t.findings).values({ ...row, id: row.id ?? newId("f"), createdAt: now, updatedAt: now }).run();
    });
  }

  updateFinding(id: string, patch: Partial<Omit<FindingRow, "id" | "createdAt">>): FindingRow | undefined {
    this.db.update(this.t.findings).set({ ...patch, updatedAt: new Date() }).where(eq(this.t.findings.id, id)).run();
    return this.getFinding(id);
  }

  deleteFinding(id: string): void {
    this.db.delete(this.t.findings).where(eq(this.t.findings.id, id)).run();
  }

  // ---------------------------------------------------------------- interventions
  listInterventions(memberId?: string): InterventionRow[] {
    return this.db
      .select()
      .from(this.t.interventions)
      .where(memberId ? eq(this.t.interventions.memberId, memberId) : undefined)
      .orderBy(desc(this.t.interventions.startDate))
      .all();
  }

  listActiveInterventions(memberId: string, today: string): InterventionRow[] {
    return this.db
      .select()
      .from(this.t.interventions)
      .where(
        and(
          eq(this.t.interventions.memberId, memberId),
          or(isNull(this.t.interventions.endDate), sql`${this.t.interventions.endDate} >= ${today}`),
        ),
      )
      .orderBy(desc(this.t.interventions.startDate))
      .all();
  }

  getIntervention(id: string): InterventionRow | undefined {
    return this.db.select().from(this.t.interventions).where(eq(this.t.interventions.id, id)).get();
  }

  createIntervention(input: Omit<InterventionRow, "id" | "createdAt" | "updatedAt"> & { id?: string }): InterventionRow {
    const now = new Date();
    const row = { ...input, id: input.id ?? newId("iv"), createdAt: now, updatedAt: now };
    this.db.insert(this.t.interventions).values(row).run();
    return row;
  }

  updateIntervention(id: string, patch: Partial<Omit<InterventionRow, "id" | "createdAt">>): InterventionRow | undefined {
    this.db.update(this.t.interventions).set({ ...patch, updatedAt: new Date() }).where(eq(this.t.interventions.id, id)).run();
    return this.getIntervention(id);
  }

  deleteIntervention(id: string): void {
    this.db.delete(this.t.interventions).where(eq(this.t.interventions.id, id)).run();
  }

  // ---------------------------------------------------------------- measurements
  listMeasurements(memberId: string, code?: string): MeasurementRow[] {
    const conds = [eq(this.t.measurements.memberId, memberId)];
    if (code) conds.push(eq(this.t.measurements.indicatorCode, code));
    return this.db.select().from(this.t.measurements).where(and(...conds)).orderBy(asc(this.t.measurements.measuredAt)).all();
  }

  createMeasurement(input: Omit<MeasurementRow, "id" | "createdAt"> & { id?: string }): MeasurementRow {
    const row = { ...input, id: input.id ?? newId("ms"), createdAt: new Date() };
    this.db.insert(this.t.measurements).values(row).run();
    return row;
  }

  deleteMeasurement(id: string): boolean {
    const res = this.db.delete(this.t.measurements).where(eq(this.t.measurements.id, id)).run();
    return res.changes > 0;
  }

  // ---------------------------------------------------------------- insights
  getInsight(scope: string, scopeId: string): InsightRow | undefined {
    return this.db
      .select()
      .from(this.t.insights)
      .where(and(eq(this.t.insights.scope, scope), eq(this.t.insights.scopeId, scopeId)))
      .get();
  }

  upsertInsight(input: Omit<InsightRow, "id" | "createdAt" | "updatedAt">): InsightRow {
    const existing = this.getInsight(input.scope, input.scopeId);
    const now = new Date();
    if (existing) {
      this.db.update(this.t.insights).set({ ...input, updatedAt: now }).where(eq(this.t.insights.id, existing.id)).run();
      return { ...existing, ...input, updatedAt: now };
    }
    const row = { ...input, id: newId("ins"), createdAt: now, updatedAt: now };
    this.db.insert(this.t.insights).values(row).run();
    return row;
  }

  // ---------------------------------------------------------------- demo
  demoMemberIds(): string[] {
    return this.db.select({ id: this.t.members.id }).from(this.t.members).where(eq(this.t.members.isDemo, true)).all().map((r) => r.id);
  }

  /** Delete every demo member (and all their rows). Real members are never touched. Returns demo report ids. */
  clearDemo(): { members: number; reportIds: string[] } {
    const ids = this.demoMemberIds();
    const reportIds: string[] = [];
    for (const id of ids) reportIds.push(...this.deleteMember(id));
    // Demo reports attached to a real member (should not happen, but be exact).
    for (const r of this.listReports().filter((r) => r.isDemo)) {
      this.deleteReport(r.id);
      reportIds.push(r.id);
    }
    return { members: ids.length, reportIds };
  }
}

export function createStore(ctx: AppDbContext): FamilyHealthStore {
  return new FamilyHealthStore(ctx);
}
