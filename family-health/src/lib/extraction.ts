/**
 * Report extraction pipeline:
 *
 *   page images → batches of 2 (≤3 in flight) → extractor agent (vision, strict JSON)
 *   → validate/repair → deterministic mapping (normalizeRow)
 *   → one mapper-agent call for all unmapped names → flags
 *   → findings normalization → status `needs_review`
 *
 * Progress (`pagesDone` / `pagesTotal`) is persisted as each batch finishes
 * (monotonic, in completion order) so the UI can poll. Results are merged in
 * page order regardless of completion order. A failed batch is retried once; if it still fails the other
 * batches' rows are kept and a partial warning is stored in `error`. The run
 * is idempotent: it starts by clearing the report's unconfirmed rows.
 */
import { detectFindings, isNormalConclusion, parseSeverity, severityLabel } from "../domain/findings.js";
import { INDICATORS, getIndicator } from "../domain/indicators.js";
import { normalizeRow, splitCompoundRow, type NormalizedRow } from "../domain/normalize.js";
import type { Sex } from "../domain/types.js";
import type { FamilyHealthStore, FindingInsert, ResultInsert } from "../db/repositories/store.js";
import type { PageImage } from "../db/schema.js";
import type { AgentCaller } from "./agent.js";
import { parseExtractorOutput, parseMapperOutput, type ExtractedFinding, type ExtractedResult, type MapperInput } from "./extraction-parse.js";

export const EXTRACTOR_AGENT = "family-health:extractor";
export const MAPPER_AGENT = "family-health:mapper";
/** Pages per extractor call: small enough that dense pages get full attention. */
export const BATCH_SIZE = 2;
/** Extractor calls in flight at once for one report. */
export const EXTRACTION_CONCURRENCY = 3;
/** An `extracting` report not updated for this long is considered abandoned (e.g. daemon restart). */
export const STALE_EXTRACTION_MS = 15 * 60 * 1000;

export function isStaleExtraction(report: { status: string; updatedAt: Date }, now: Date = new Date()): boolean {
  return report.status === "extracting" && now.getTime() - report.updatedAt.getTime() > STALE_EXTRACTION_MS;
}

export function chunkPages<T>(pages: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < pages.length; i += size) out.push(pages.slice(i, i + size));
  return out;
}

export function buildExtractorPrompt(pages: Array<Pick<PageImage, "page" | "path">>): string {
  return [
    "下面是一份中文体检报告中的若干页（已转成图片）。请用 Read 工具逐页打开每个图片文件，仔细阅读后提取数据。",
    "",
    "页码与文件路径：",
    ...pages.map((p) => `第 ${p.page} 页：${p.path}`),
    "",
    "返回一个 JSON 对象（字段见输出格式），只包含你在这些页面上真正看到的内容：",
    "- results：每一行检验结果。name 按原文照抄项目名称（含括号里的英文缩写），value 按原文照抄结果（数字、阴性/阳性、+/++ 等），",
    "  unit 为单位，ref 为参考范围原文，flag 为结果旁的 ↑ ↓ H L * 等标记（没有则 null），section 为该行所在的检查分组标题（如 血常规、肝功能），page 为页码。",
    "- findings：超声、影像、心电图、眼底、总检结论等文字结论，每条一项；text 照抄“检查结论/提示”里对应的那一句原文（如“脂肪肝（轻度）”），",
    "  不要抄整段“检查所见”；organ 为器官/部位，",
    "  finding_key 从以下取值中选择（都不合适则 null）：fatty_liver, liver_cyst, liver_hemangioma, gallbladder_polyp, gallstone, renal_cyst,",
    "  kidney_stone, thyroid_nodule, breast_nodule, breast_hyperplasia, lung_nodule, carotid_plaque, carotid_imt, prostate_hyperplasia,",
    "  prostate_calcification, uterine_fibroid, ovarian_cyst, sinus_bradycardia, sinus_tachycardia, ecg_st_t, arrhythmia,",
    "  left_ventricular_hypertrophy, fundus_arteriosclerosis, cataract, cervical_spondylosis, osteoporosis, osteopenia；",
    "  severity 为程度（轻度/中度/重度、TI-RADS n类、BI-RADS n类、大小），没有则 null。“未见异常”类的正常结论不要列出。",
    "- exam_date：体检日期（YYYY-MM-DD），provider：体检机构名称；页面上没有则 null。",
    "- skipped_pages：封面、目录、广告、医生简介、须知等没有检查数据的页码（这些页上的任何数字都不要写进 results）。",
    "- 一行里写着两个数值的（如 血压 138/88），value 照抄 “138/88”，由程序拆分。",
    "",
    "注意：表格可能是多栏排版（一页左右两栏），请逐栏逐行读取，不要把相邻两栏的数值串行；不要推测或编造数值；",
    "同一项目在“异常汇总”页和明细页重复出现时都照实列出；不要做任何医学解读。",
  ].join("\n");
}

function dictionaryLines(): string {
  return INDICATORS.map((d) => `${d.code}|${d.zh}|${d.unit || "-"}`).join("\n");
}

export function buildMapperPrompt(items: MapperInput[]): string {
  return [
    "把体检报告中未能自动识别的项目名称映射到标准指标代码。只能使用下面词典里的代码；没有把握或词典中没有对应项时 code 填 null。",
    "注意区分血液与尿液项目（尿常规里的葡萄糖、蛋白、白细胞是尿检项目），以及百分比与绝对值。",
    "",
    "待映射项目（名称 | 单位 | 分组）：",
    ...items.map((i) => `${i.name} | ${i.unit ?? "-"} | ${i.section ?? "-"}`),
    "",
    "词典（代码|中文名|标准单位）：",
    dictionaryLines(),
  ].join("\n");
}

interface CollectedRow {
  row: ExtractedResult;
  norm: NormalizedRow;
}

const CONFIDENCE: Record<string, number> = { exact: 1, candidate: 0.9, forced: 0.75, ambiguous: 0.6 };

export interface ExtractionOutcome {
  status: "needs_review" | "failed";
  results: number;
  findings: number;
  warnings: string[];
  error?: string;
}

export interface ExtractionDeps {
  store: FamilyHealthStore;
  callAgent: AgentCaller;
  /** Override pages per extractor call (tests). */
  batchSize?: number;
  /** Override extractor calls in flight (tests). */
  concurrency?: number;
  now?: () => Date;
  log?: { info: (m: string, d?: Record<string, unknown>) => void; warn: (m: string, d?: Record<string, unknown>) => void };
}

/**
 * Run `fn` over `items` with at most `limit` calls in flight; results keep
 * input order. `fn` must not throw (failures are part of its result).
 */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

function pageRangeLabel(pages: number[]): string {
  return pages.length === 1 ? `第 ${pages[0]} 页` : `第 ${pages[0]}–${pages.at(-1)} 页`;
}

export async function runExtraction(reportId: string, deps: ExtractionDeps): Promise<ExtractionOutcome> {
  const { store, callAgent } = deps;
  const now = deps.now ?? (() => new Date());
  const report = store.getReport(reportId);
  if (!report) return { status: "failed", results: 0, findings: 0, warnings: [], error: "报告不存在" };
  if (report.status === "confirmed") return { status: "failed", results: 0, findings: 0, warnings: [], error: "报告已确认，不能重新识别" };
  const member = store.getMember(report.memberId);
  const sex: Sex | null = member?.sex === "male" || member?.sex === "female" ? member.sex : null;

  const pages = report.pageImages;
  if (pages.length === 0) {
    store.updateReport(reportId, { status: "failed", error: "还没有上传任何文件" });
    return { status: "failed", results: 0, findings: 0, warnings: [], error: "还没有上传任何文件" };
  }

  store.clearReportRows(reportId);
  store.updateReport(reportId, {
    status: "extracting",
    error: null,
    pagesDone: 0,
    pagesTotal: pages.length,
    pageImages: pages.map(({ skipped: _s, ...p }) => p),
  });

  const warnings: string[] = [];
  const extractedResults: ExtractedResult[] = [];
  const extractedFindings: ExtractedFinding[] = [];
  let examDate: string | null = null;
  let provider: string | null = null;
  const skipped = new Set<number>();
  let okBatches = 0;
  let done = 0;

  const batches = chunkPages(pages, deps.batchSize ?? BATCH_SIZE);
  const outcomes = await mapPool(batches, deps.concurrency ?? EXTRACTION_CONCURRENCY, async (batch) => {
    const pageNums = batch.map((p) => p.page);
    const prompt = buildExtractorPrompt(batch);
    let parsed: ReturnType<typeof parseExtractorOutput> = null;
    let lastError = "";
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const res = await callAgent(EXTRACTOR_AGENT, prompt).catch((err: Error) => ({ ok: false as const, error: err?.message ?? String(err) }));
      if (!res.ok) {
        lastError = res.error;
        continue;
      }
      parsed = parseExtractorOutput(res.data, pageNums, now());
      if (!parsed) lastError = "模型返回的内容不是有效的 JSON 对象";
    }
    // Single-threaded JS: this increment + write happens atomically per batch.
    done += batch.length;
    store.updateReport(reportId, { pagesDone: done });
    return { pageNums, parsed, lastError };
  });

  // Merge in page order (batches finish in any order).
  for (const { pageNums, parsed, lastError } of outcomes) {
    if (parsed) {
      okBatches++;
      extractedResults.push(...parsed.results);
      extractedFindings.push(...parsed.findings);
      parsed.skippedPages.forEach((p) => skipped.add(p));
      examDate = examDate ?? parsed.examDate;
      provider = provider ?? parsed.provider;
    } else {
      warnings.push(`${pageRangeLabel(pageNums)}识别失败（${lastError.slice(0, 80)}），可重新识别或手动补充`);
      deps.log?.warn("extractor batch failed", { reportId, pages: pageNums, error: lastError });
    }
  }

  if (okBatches === 0) {
    const error = `识别失败：${warnings.length ? warnings[0] : "模型没有返回结果"}。请稍后重试。`;
    store.updateReport(reportId, { status: "failed", error });
    return { status: "failed", results: 0, findings: 0, warnings, error };
  }

  // ---- deterministic mapping
  const collected: CollectedRow[] = extractedResults.flatMap((row) => {
    const raw = { rawName: row.name, rawValue: row.value, rawUnit: row.unit, refText: row.ref, arrow: row.flag, section: row.section };
    // e.g. 血压 138/88 → 收缩压 138 + 舒张压 88
    const parts = splitCompoundRow(raw);
    if (!parts) return [{ row, norm: normalizeRow(raw, { sex }) }];
    return parts.map((p) => ({
      row: { ...row, name: p.rawName, value: String(p.rawValue), ref: p.refText ?? null, flag: p.arrow ?? null },
      norm: normalizeRow(p, { sex }),
    }));
  });

  // ---- LLM fallback for unmapped names (one call for the whole report)
  const unmapped: MapperInput[] = [];
  for (const c of collected) {
    if (!c.norm.indicatorCode && !unmapped.some((u) => u.name === c.row.name)) {
      unmapped.push({ name: c.row.name, unit: c.row.unit, section: c.row.section });
    }
  }
  if (unmapped.length > 0) {
    const res = await callAgent(MAPPER_AGENT, buildMapperPrompt(unmapped));
    if (res.ok) {
      const mapping = parseMapperOutput(res.data, unmapped);
      for (const c of collected) {
        const code = mapping.get(c.row.name);
        if (code) {
          c.norm = normalizeRow(
            { rawName: c.row.name, rawValue: c.row.value, rawUnit: c.row.unit, refText: c.row.ref, arrow: c.row.flag, section: c.row.section, indicatorCode: code },
            { sex },
          );
        }
      }
    } else {
      deps.log?.warn("mapper failed", { reportId, error: res.error });
    }
  }

  // ---- de-duplicate rows repeated on summary pages
  const seen = new Set<string>();
  const resultRows: ResultInsert[] = [];
  collected.forEach((c) => {
    const key = c.norm.indicatorCode
      ? `${c.norm.indicatorCode}|${c.norm.valueNum ?? c.norm.valueText ?? c.row.value}`
      : `raw:${c.row.name}|${c.row.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    resultRows.push({
      reportId,
      memberId: report.memberId,
      indicatorCode: c.norm.indicatorCode,
      rawName: c.row.name,
      rawValue: c.row.value,
      valueNum: c.norm.valueNum,
      valueText: c.norm.valueText,
      rawUnit: c.row.unit ?? "",
      unit: c.norm.unit,
      refLow: c.norm.refLow,
      refHigh: c.norm.refHigh,
      refText: c.norm.refText,
      flag: c.norm.flag,
      section: c.row.section,
      page: c.row.page,
      confidence: c.norm.match ? CONFIDENCE[c.norm.match] ?? null : null,
      source: "extracted",
      confirmed: false,
      sortOrder: resultRows.length,
    });
  });

  const finalExamDate = report.examDate ?? examDate;
  const findingRows: FindingInsert[] = [];
  const seenFindings = new Set<string>();
  for (const f of extractedFindings) {
    const detected = f.findingKey ? [{ key: f.findingKey, organ: f.organ ?? "", severity: parseSeverity(f.text) }] : detectFindings(f.text).map((d) => ({ key: d.key, organ: d.organ, severity: d.severity }));
    // Unrecognized text that only states a normal result (窦性心律 / 未见明显异常) is noise.
    if (!detected.length && isNormalConclusion(f.text)) continue;
    const targets = detected.length ? detected : [{ key: null as string | null, organ: f.organ ?? "", severity: parseSeverity(f.text) }];
    for (const t of targets) {
      const dedupe = `${t.key ?? f.text}`;
      if (seenFindings.has(dedupe)) continue;
      seenFindings.add(dedupe);
      findingRows.push({
        reportId,
        memberId: report.memberId,
        examDate: finalExamDate,
        organ: f.organ ?? t.organ,
        findingKey: t.key,
        severity: f.severity ?? (severityLabel(t.severity) || null),
        rawText: f.text,
        page: f.page,
        confirmed: false,
      });
    }
  }

  store.insertResults(resultRows);
  store.insertFindings(findingRows);
  if (resultRows.length === 0 && findingRows.length === 0) warnings.push("没有识别到检验结果或检查结论，请确认上传的是体检报告，或手动添加");
  // A page counts as skipped only if the model said so AND nothing was taken from it.
  const used = new Set([...resultRows.map((r) => r.page), ...findingRows.map((f) => f.page)]);
  const skippedPages = pages.map(({ skipped: _old, ...p }) => (skipped.has(p.page) && !used.has(p.page) ? { ...p, skipped: true } : p));
  store.updateReport(reportId, {
    status: "needs_review",
    pageImages: skippedPages,
    examDate: finalExamDate,
    provider: report.provider || provider || "",
    error: warnings.length ? warnings.join("；") : null,
    pagesDone: pages.length,
  });
  deps.log?.info("extraction finished", { reportId, results: resultRows.length, findings: findingRows.length, warnings: warnings.length });
  return { status: "needs_review", results: resultRows.length, findings: findingRows.length, warnings };
}

/**
 * Recompute derived columns of one result row after a reviewer edit. The
 * reviewer's mapping choice is authoritative: a null code stays unmapped
 * (no silent re-mapping from the name) and keeps its raw number.
 */
export function renormalizeResult(
  input: { rawName: string; rawValue: string; rawUnit: string; refText: string | null; indicatorCode: string | null; section?: string | null },
  sex: Sex | null,
) {
  const code = input.indicatorCode && getIndicator(input.indicatorCode) ? input.indicatorCode : null;
  const norm = normalizeRow(
    { rawName: code ? input.rawName : "", rawValue: input.rawValue, rawUnit: input.rawUnit, refText: input.refText, section: input.section, indicatorCode: code },
    { sex },
  );
  return {
    indicatorCode: code,
    valueNum: norm.valueNum,
    valueText: norm.valueText,
    unit: norm.unit,
    refLow: norm.refLow,
    refHigh: norm.refHigh,
    flag: norm.flag,
  };
}
