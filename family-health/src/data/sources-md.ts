/**
 * Renders SOURCES.md (app folder) from the knowledge base: every cited source
 * grouped by evidence level, with what it supports. Regenerate with
 * `pnpm sources:md`; test/knowledge-base.test.ts fails when the file is stale.
 */
import { LEVELS, type Source, type SourceLevel, type ThresholdInput } from "./schema.js";
import type { IndicatorEntryInput } from "./schema.js";

const LEVEL_TITLE: Record<SourceLevel, string> = {
  national_cn: "国家标准（National standards, China）",
  international: "国际标准（International standards）",
  cn_guideline: "中国指南（Chinese guidelines）",
  cn_consensus: "中国专家共识（Chinese expert consensus）",
  intl_guideline: "国际指南（International guidelines）",
  report: "报告单（lab report, per result — not listed here）",
  unverified: "未核实（not yet verified）",
};

const SCOPE_ZH: Record<string, string> = {
  code: "编码",
  name: "名称",
  reference_range: "参考范围",
  decision_threshold: "判定切点",
  explanation: "通俗解释",
};

export function renderSourcesMd(input: {
  sources: Source[];
  indicators: IndicatorEntryInput[];
  thresholds: ThresholdInput[];
  loincAttribution: string | null;
}): string {
  const supports = new Map<string, Set<string>>();
  const add = (id: string | undefined, what: string) => {
    if (!id) return;
    if (!supports.has(id)) supports.set(id, new Set());
    supports.get(id)!.add(what);
  };
  for (const e of input.indicators) {
    add(e.explain.sourceId, `${e.code} 解释`);
    add(e.legacyRefSourceId, `${e.code} 内置参考范围`);
    if (e.loinc) add(e.loinc.sourceId, `${e.code} LOINC`);
    for (const r of e.ranges ?? []) add(r.sourceId, `${e.code} 参考范围`);
  }
  for (const t of input.thresholds) add(t.sourceId, `${t.id}（${t.indicatorCodes.join("/")}）切点`);

  const lines: string[] = [
    "# 数据来源 / Sources",
    "",
    "> 本文件由 `pnpm sources:md` 根据 `src/data/sources.ts` 自动生成，请勿手工编辑。",
    "> Generated from `src/data/sources.ts` — do not edit by hand.",
    "",
    "判定原则：同一指标的国家标准与国际标准不一致时，以国家标准为准；报告单上印有参考范围时，以报告单为准（不同实验室的检测方法和试剂不同）。",
    "",
  ];
  for (const level of LEVELS) {
    const list = input.sources.filter((s) => s.level === level);
    if (!list.length) continue;
    lines.push(`## ${LEVEL_TITLE[level]}`, "");
    for (const s of list) {
      const used = [...(supports.get(s.id) ?? [])].sort();
      lines.push(`### ${s.org} — ${s.title}`, "");
      lines.push(`- 编号 / Identifier: ${s.identifier}`);
      if (s.locator) lines.push(`- 位置 / Locator: ${s.locator}`);
      if (s.url) lines.push(`- 链接 / URL: <${s.url}>`);
      lines.push(`- 适用内容 / Scope: ${s.scope.map((x) => SCOPE_ZH[x] ?? x).join("、")}`);
      if (s.status) lines.push(`- 现行状态 / Status: ${s.status}`);
      lines.push(`- 核对日期 / Retrieved: ${s.retrieved}${s.verifiedVia ? `（${s.verifiedVia === "primary" ? "官方原文核对" : "转载或镜像全文核对，待官方原文复核"}）` : ""}`);
      if (s.notes) lines.push(`- 核对说明 / Notes: ${s.notes.replace(/\s*\n\s*/g, " ")}`);
      lines.push(`- 源 ID: \`${s.id}\``);
      lines.push(`- 支持的条目 / Supports: ${used.length ? `${used.length} 项` : "（暂无）"}`);
      if (used.length) lines.push("", `  <details><summary>展开</summary>`, "", `  ${used.join("，")}`, "", "  </details>");
      lines.push("");
    }
  }
  lines.push("## LOINC", "");
  lines.push(input.loincAttribution ?? "（待补充：LOINC 使用声明将随核实后的 LOINC 编码一起加入。在此之前应用中不显示任何 LOINC 编码。）");
  lines.push("");
  return lines.join("\n");
}
