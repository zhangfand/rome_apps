import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** A file the user uploaded for a report (stored under the app data dir). */
export interface SourceFile {
  /** Original file name as uploaded. */
  name: string;
  /** Absolute path of the stored (HEIC→JPEG converted) file. */
  path: string;
  mime: string;
  size: number;
}

/** One rendered page image handed to the vision extractor. */
export interface PageImage {
  /** 1-based page number across the whole report. */
  page: number;
  /** Absolute path of the downscaled page image. */
  path: string;
  /** Index into `sourceFiles`. */
  sourceIndex: number;
  width: number;
  height: number;
  /** Set by extraction when the page had no data (cover, ad, notice…). */
  skipped?: boolean;
}

export interface UnitConversionRow {
  unit: string;
  factor: number;
  offset?: number;
}

export function createAppDbSchema(tablePrefix: string = "family_health") {
  const t = (name: string) => `${tablePrefix}__${name}`;

  // Family members. `goals` holds goal-panel keys (weight_metabolic, …).
  const members = sqliteTable(
    t("members"),
    {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      relation: text("relation").notNull().default("其他"), // 本人 | 配偶 | 父亲 | 母亲 | 子女 | 其他
      sex: text("sex"), // male | female
      birthDate: text("birth_date"), // YYYY-MM-DD
      heightCm: real("height_cm"),
      goals: text("goals", { mode: "json" }).$type<string[]>().notNull().default([]),
      notes: text("notes").notNull().default(""),
      isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
  );

  // One checkup report (one exam date, one or more uploaded files).
  const reports = sqliteTable(
    t("reports"),
    {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull(),
      examDate: text("exam_date"), // YYYY-MM-DD, user-entered or AI-detected
      provider: text("provider").notNull().default(""),
      sourceFiles: text("source_files", { mode: "json" }).$type<SourceFile[]>().notNull().default([]),
      pageImages: text("page_images", { mode: "json" }).$type<PageImage[]>().notNull().default([]),
      // uploaded | extracting | needs_review | confirmed | failed
      status: text("status").notNull().default("uploaded"),
      error: text("error"),
      pagesDone: integer("pages_done").notNull().default(0),
      pagesTotal: integer("pages_total").notNull().default(0),
      isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
      confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
    (tbl) => [index(`${t("reports")}_member_idx`).on(tbl.memberId, tbl.examDate)],
  );

  // Canonical indicator dictionary, synced from src/domain/indicators.ts.
  const indicatorDefs = sqliteTable(t("indicator_defs"), {
    code: text("code").primaryKey(),
    nameZh: text("name_zh").notNull(),
    nameEn: text("name_en").notNull().default(""),
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
    category: text("category").notNull(),
    unit: text("unit").notNull().default(""),
    valueType: text("value_type").notNull().default("numeric"), // numeric | qualitative
    conversions: text("conversions", { mode: "json" }).$type<UnitConversionRow[]>().notNull().default([]),
    // SexRange JSON: {low?, high?, …} or {male:{…}, female:{…}}
    refRange: text("ref_range", { mode: "json" }).$type<unknown>(),
    direction: text("direction").notNull(), // higher_worse | lower_worse | both | qualitative | info
    sex: text("sex"),
    derived: integer("derived", { mode: "boolean" }).notNull().default(false),
    explain: text("explain").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  });

  // Lab values extracted from a report (or computed from other values).
  const results = sqliteTable(
    t("results"),
    {
      id: text("id").primaryKey(),
      reportId: text("report_id").notNull(),
      memberId: text("member_id").notNull(),
      indicatorCode: text("indicator_code"), // null when unmapped
      rawName: text("raw_name").notNull(),
      rawValue: text("raw_value").notNull().default(""),
      valueNum: real("value_num"), // canonical unit
      valueText: text("value_text"), // qualitative: 阴性 / 阳性 / 弱阳性 …
      rawUnit: text("raw_unit").notNull().default(""),
      unit: text("unit").notNull().default(""),
      refLow: real("ref_low"), // canonical unit
      refHigh: real("ref_high"),
      refText: text("ref_text"),
      flag: text("flag"), // H | L | normal | abnormal
      section: text("section"),
      page: integer("page"),
      confidence: real("confidence"),
      source: text("source").notNull().default("extracted"), // extracted | manual | derived
      /** Set when a reviewer changed the value, unit, range or mapping of the row. */
      edited: integer("edited", { mode: "boolean" }).notNull().default(false),
      /** The value exactly as first extracted, kept for provenance once a reviewer edits it. */
      originalRawValue: text("original_raw_value"),
      confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
      sortOrder: integer("sort_order").notNull().default(0),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
    (tbl) => [
      index(`${t("results")}_report_idx`).on(tbl.reportId),
      index(`${t("results")}_member_code_idx`).on(tbl.memberId, tbl.indicatorCode),
    ],
  );

  // Text conclusions from 超声 / 影像 / 心电图 / 总检.
  const findings = sqliteTable(
    t("findings"),
    {
      id: text("id").primaryKey(),
      reportId: text("report_id").notNull(),
      memberId: text("member_id").notNull(),
      examDate: text("exam_date"),
      organ: text("organ").notNull().default(""),
      findingKey: text("finding_key"), // fatty_liver, thyroid_nodule, …
      severity: text("severity"), // 轻度 / 中度 / TI-RADS 3类 …
      rawText: text("raw_text").notNull(),
      page: integer("page"),
      confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
    (tbl) => [
      index(`${t("findings")}_report_idx`).on(tbl.reportId),
      index(`${t("findings")}_member_key_idx`).on(tbl.memberId, tbl.findingKey),
    ],
  );

  // Lifestyle / medication changes, drawn as spans on trend charts.
  const interventions = sqliteTable(
    t("interventions"),
    {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull(),
      category: text("category").notNull(), // 饮食 | 运动 | 药物 | 睡眠 | 体重管理 | 其他
      title: text("title").notNull(),
      description: text("description").notNull().default(""),
      startDate: text("start_date").notNull(), // YYYY-MM-DD
      endDate: text("end_date"), // null = ongoing
      createdVia: text("created_via").notNull().default("ui"), // chat | ui | demo
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
    (tbl) => [index(`${t("interventions")}_member_idx`).on(tbl.memberId, tbl.startDate)],
  );

  // Ad-hoc values logged from chat (home weight, blood pressure, …).
  const measurements = sqliteTable(
    t("measurements"),
    {
      id: text("id").primaryKey(),
      memberId: text("member_id").notNull(),
      indicatorCode: text("indicator_code").notNull(),
      value: real("value").notNull(), // canonical unit
      unit: text("unit").notNull().default(""),
      rawValue: text("raw_value"),
      rawUnit: text("raw_unit"),
      measuredAt: text("measured_at").notNull(), // YYYY-MM-DD (or ISO datetime)
      note: text("note").notNull().default(""),
      createdVia: text("created_via").notNull().default("chat"),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    },
    (tbl) => [index(`${t("measurements")}_member_code_idx`).on(tbl.memberId, tbl.indicatorCode, tbl.measuredAt)],
  );

  // Cached AI interpretations.
  const insights = sqliteTable(
    t("insights"),
    {
      id: text("id").primaryKey(),
      scope: text("scope").notNull(), // report | indicator | panel | member
      scopeId: text("scope_id").notNull(), // report id, `${memberId}:${code}`, …
      memberId: text("member_id"),
      status: text("status").notNull().default("pending"), // pending | ready | failed
      content: text("content", { mode: "json" }).$type<unknown>(),
      markdown: text("markdown"),
      error: text("error"),
      model: text("model"),
      promptVersion: text("prompt_version").notNull().default("v1"),
      inputHash: text("input_hash"),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
    (tbl) => [uniqueIndex(`${t("insights")}_scope_uq`).on(tbl.scope, tbl.scopeId)],
  );

  return { members, reports, indicatorDefs, results, findings, interventions, measurements, insights };
}

const defaultSchema = createAppDbSchema();

export const members = defaultSchema.members;
export const reports = defaultSchema.reports;
export const indicatorDefs = defaultSchema.indicatorDefs;
export const results = defaultSchema.results;
export const findings = defaultSchema.findings;
export const interventions = defaultSchema.interventions;
export const measurements = defaultSchema.measurements;
export const insights = defaultSchema.insights;

export type AppSchema = ReturnType<typeof createAppDbSchema>;
