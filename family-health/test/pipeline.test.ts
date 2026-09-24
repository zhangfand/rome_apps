import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FamilyHealthStore } from "../src/db/repositories/store.js";
import type { AgentCaller, AgentResult } from "../src/lib/agent.js";
import { extractJson } from "../src/lib/agent.js";
import { parseExtractorOutput, parseMapperOutput } from "../src/lib/extraction-parse.js";
import { EXTRACTOR_AGENT, MAPPER_AGENT, isStaleExtraction, renormalizeResult, runExtraction } from "../src/lib/extraction.js";
import {
  DISCLAIMER,
  buildReportPayload,
  buildTrendPayload,
  coerceReportInsight,
  findCausalPhrases,
  generateReportInsight,
  generateTrendInsight,
  hasCausalLanguage,
  mergeAlerts,
  stripCausal,
  coerceTrendInsight,
} from "../src/lib/insights.js";
import { seedDemoData } from "../src/lib/seed.js";
import { createTestDb } from "./sqlite.js";

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "fh-pipe-"));
  process.env.FAMILY_HEALTH_DATA_DIR = dataDir;
});
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

let store: FamilyHealthStore;
beforeEach(() => {
  store = new FamilyHealthStore(createTestDb().ctx);
});

/** Scripted fake agent: returns queued responses per agent name and records prompts. */
function fakeAgent(script: Record<string, Array<AgentResult<unknown>>>) {
  const prompts: Array<{ agent: string; prompt: string }> = [];
  const call: AgentCaller = async <T>(agent: string, prompt: string) => {
    prompts.push({ agent, prompt });
    const queue = script[agent] ?? [];
    const next = queue.shift();
    return (next ?? { ok: false, error: "no scripted response" }) as AgentResult<T>;
  };
  return { call, prompts };
}

function reportWithPages(pages: number) {
  const m = store.createMember({ name: "测试成员", relation: "本人", sex: "male", birthDate: "1980-01-01", notes: "私密备注" });
  const r = store.createReport({ memberId: m.id });
  store.appendSourceFile(
    r.id,
    { name: "a.pdf", path: "/tmp/a.pdf", mime: "application/pdf", size: 1 },
    Array.from({ length: pages }, (_, i) => ({ path: `/tmp/p${i + 1}.jpg`, width: 1131, height: 1600 })),
  );
  return { member: m, report: store.getReport(r.id)! };
}

const ok = (data: unknown): AgentResult<unknown> => ({ ok: true, data, raw: "" });

describe("extractor output parsing", () => {
  it("repairs common model mistakes", () => {
    const parsed = parseExtractorOutput(
      {
        data: {
          exam_date: "2025年6月10日",
          provider: "美年大健康",
          results: [
            { page: 99, section: "血脂", name: "甘油三酯(TG)", value: 2.35, unit: "mmol/L", ref: "0.45-1.70", flag: "↑" },
            { page: 2, name: "尿蛋白", value: "-", unit: null, ref: "阴性", flag: null, section: "null" },
            { page: 2, name: "", value: "1" },
          ],
          findings: [{ page: 3, organ: "肝脏", text: "脂肪肝（轻度）", finding_key: "bogus_key", severity: "轻度" }],
          skipped_pages: [1, 42],
        },
      },
      [1, 2, 3],
      new Date(2026, 0, 1),
    )!;
    expect(parsed.examDate).toBe("2025-06-10");
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0]).toMatchObject({ page: 1, value: "2.35" });
    expect(parsed.results[1]).toMatchObject({ value: "-", section: null });
    expect(parsed.findings[0].findingKey).toBeNull();
    expect(parsed.skippedPages).toEqual([1]);
  });

  it("returns null for non-objects", () => {
    expect(parseExtractorOutput("nope", [1])).toBeNull();
  });

  it("extracts JSON from fenced text", () => {
    expect(extractJson('好的：\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("accepts only valid, unit-compatible mapper codes", () => {
    const map = parseMapperOutput(
      { mappings: [{ raw_name: "胆固醇总量", code: "tc" }, { raw_name: "某项", code: "NOPE" }, { raw_name: "血糖值", code: "GLU" }] },
      [
        { name: "胆固醇总量", unit: "mmol/L", section: null },
        { name: "某项", unit: null, section: null },
        { name: "血糖值", unit: "kg", section: null },
      ],
    );
    expect([...map.entries()]).toEqual([["胆固醇总量", "TC"]]);
  });
});

describe("runExtraction", () => {
  it("extracts, maps, falls back to the mapper and lands in needs_review", async () => {
    const { report } = reportWithPages(7);
    const agent = fakeAgent({
      [EXTRACTOR_AGENT]: [
        ok({
          exam_date: "2025-06-10",
          provider: "演示体检",
          results: [
            { page: 2, section: "血脂", name: "甘油三酯(TG)", value: "2.35↑", unit: "mmol/L", ref: "0.45-1.70", flag: null },
            { page: 2, section: "血脂", name: "胆固醇总量(酶法)", value: "5.5", unit: "mmol/L", ref: "<5.2", flag: "H" },
            { page: 3, section: "尿常规", name: "蛋白质", value: "阴性", unit: null, ref: "阴性", flag: null },
          ],
          findings: [{ page: 4, organ: "肝脏", text: "脂肪肝（中度）", finding_key: null, severity: null }],
          skipped_pages: [1],
        }),
        ok({
          exam_date: null,
          provider: null,
          results: [{ page: 6, section: "异常汇总", name: "甘油三酯", value: "2.35", unit: "mmol/L", ref: "0.45-1.70", flag: "↑" }],
          findings: [],
          skipped_pages: [],
        }),
      ],
      [MAPPER_AGENT]: [ok({ mappings: [{ raw_name: "胆固醇总量(酶法)", code: "TC" }] })],
    });
    const out = await runExtraction(report.id, { store, callAgent: agent.call });
    expect(out).toMatchObject({ status: "needs_review", results: 3, findings: 1, warnings: [] });
    const rep = store.getReport(report.id)!;
    expect(rep).toMatchObject({ status: "needs_review", examDate: "2025-06-10", provider: "演示体检", pagesDone: 7, pagesTotal: 7, error: null });
    const rows = store.listReportResults(report.id);
    expect(rows.map((r) => [r.indicatorCode, r.flag])).toEqual([
      ["TG", "H"],
      ["TC", "H"],
      ["U_PRO", "normal"],
    ]);
    expect(rows[1].confidence).toBe(0.75);
    expect(store.listReportFindings(report.id)[0]).toMatchObject({ findingKey: "fatty_liver", severity: "中度", examDate: "2025-06-10" });
    // Two extractor batches (5 + 2 pages) and one mapper call.
    expect(agent.prompts.map((p) => p.agent)).toEqual([EXTRACTOR_AGENT, EXTRACTOR_AGENT, MAPPER_AGENT]);
    expect(agent.prompts[0].prompt).toContain("/tmp/p5.jpg");
    expect(agent.prompts[0].prompt).not.toContain("/tmp/p6.jpg");
  });

  it("retries a failed batch once, keeps other batches and records a partial warning", async () => {
    const { report } = reportWithPages(10);
    const agent = fakeAgent({
      [EXTRACTOR_AGENT]: [
        ok({ exam_date: null, provider: null, results: [{ page: 1, section: null, name: "ALT", value: "30", unit: "U/L", ref: "9-50", flag: null }], findings: [], skipped_pages: [] }),
        { ok: false, error: "timeout" },
        { ok: false, error: "timeout again" },
      ],
    });
    const out = await runExtraction(report.id, { store, callAgent: agent.call });
    expect(out.status).toBe("needs_review");
    expect(out.warnings[0]).toContain("第 6–10 页识别失败");
    expect(store.getReport(report.id)!.error).toContain("第 6–10 页");
    expect(store.listReportResults(report.id)).toHaveLength(1);
  });

  it("fails cleanly when every batch fails, and a retry starts from scratch", async () => {
    const { report } = reportWithPages(3);
    const failing = fakeAgent({ [EXTRACTOR_AGENT]: [{ ok: false, error: "boom" }, { ok: false, error: "boom" }] });
    const out = await runExtraction(report.id, { store, callAgent: failing.call });
    expect(out.status).toBe("failed");
    expect(store.getReport(report.id)!.status).toBe("failed");
    expect(store.getReport(report.id)!.error).toMatch(/识别失败/);

    const row = { page: 1, section: null, name: "ALT", value: "30", unit: "U/L", ref: "9-50", flag: null };
    const good = fakeAgent({ [EXTRACTOR_AGENT]: [ok({ exam_date: null, provider: null, results: [row], findings: [], skipped_pages: [] })] });
    await runExtraction(report.id, { store, callAgent: good.call });
    const again = fakeAgent({ [EXTRACTOR_AGENT]: [ok({ exam_date: null, provider: null, results: [row], findings: [], skipped_pages: [] })] });
    await runExtraction(report.id, { store, callAgent: again.call });
    expect(store.listReportResults(report.id)).toHaveLength(1);
    expect(store.getReport(report.id)!.status).toBe("needs_review");
  });

  it("refuses to re-extract a confirmed report", async () => {
    const { report } = reportWithPages(1);
    store.confirmReport(report.id);
    const out = await runExtraction(report.id, { store, callAgent: fakeAgent({}).call });
    expect(out.status).toBe("failed");
    expect(store.getReport(report.id)!.status).toBe("confirmed");
  });

  it("detects stale extractions", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(isStaleExtraction({ status: "extracting", updatedAt: new Date("2026-09-23T11:00:00Z") }, now)).toBe(true);
    expect(isStaleExtraction({ status: "extracting", updatedAt: new Date("2026-09-23T11:55:00Z") }, now)).toBe(false);
    expect(isStaleExtraction({ status: "needs_review", updatedAt: new Date(0) }, now)).toBe(false);
  });

  it("recomputes a row after a reviewer edit and honours explicit unmapping", () => {
    const edited = renormalizeResult({ rawName: "葡萄糖", rawValue: "126", rawUnit: "mg/dL", refText: "70-110", indicatorCode: "GLU" }, "male");
    expect(edited.valueNum).toBeCloseTo(6.99, 2);
    expect(edited.flag).toBe("H");
    const unmapped = renormalizeResult({ rawName: "甘油三酯", rawValue: "2.1", rawUnit: "mmol/L", refText: null, indicatorCode: null }, "male");
    expect(unmapped).toMatchObject({ indicatorCode: null, valueNum: 2.1, flag: null });
  });
});

describe("insights", () => {
  it("never puts member names or notes into model payloads", () => {
    seedDemoData(store);
    store.updateMember("demo-self", { notes: "私密：公司体检卡号 12345" });
    const report = buildReportPayload(store, "demo-self-2026")!;
    const trend = buildTrendPayload(store, "demo-self", "TG")!;
    for (const payload of [report.payload, trend]) {
      const json = JSON.stringify(payload);
      expect(json).not.toContain("张伟");
      expect(json).not.toContain("私密");
      expect(json).not.toContain("demo-self");
      expect(json).not.toContain("12345");
    }
    expect(report.payload.member).toEqual({ age: 40, sex: "男", height_cm: 175, goals: ["减重/代谢", "血脂/心血管", "肝功能/脂肪肝"] });
    expect(report.payload.changes_vs_previous.find((c) => c.name === "甘油三酯")).toMatchObject({ previous: 2.18, current: 1.58 });
    expect(trend.interventions.map((i) => i.title)).toContain("控制晚餐碳水");
  });

  it("merges deterministic alerts into 需尽快就医", () => {
    const base = coerceReportInsight({
      overview: "总体尚可",
      groups: { urgent: [], recheck: [{ indicator: "空腹血糖", what: "", meaning: "", next_step: "三个月复查" }], lifestyle: [], watch: [] },
      comparison: {},
      lifestyle_advice: ["少喝含糖饮料"],
    });
    const merged = mergeAlerts(
      base,
      [
        { code: "GLU", name: "空腹血糖", level: "urgent", value: 17.2, unit: "mmol/L", message: "空腹血糖极高" },
        { code: "K", name: "钾", level: "urgent", value: 6.3, unit: "mmol/L", message: "血钾过高" },
      ],
      [{ findingKey: "thyroid_nodule", level: "soon", message: "TI-RADS 4 类" }],
    );
    expect(merged.groups.urgent.map((i) => i.indicator)).toEqual(expect.arrayContaining(["空腹血糖", "钾", "甲状腺结节"]));
    expect(merged.groups.recheck).toHaveLength(0);
    expect(merged.disclaimer).toBe(DISCLAIMER);
  });

  it("detects and strips causal language about interventions", () => {
    expect(findCausalPhrases("控制晚餐碳水后甘油三酯下降，说明饮食调整有效。")).toHaveLength(1);
    expect(findCausalPhrases("由于坚持快走，体重明显降低。")).toHaveLength(1);
    expect(findCausalPhrases("饮食调整导致甘油三酯下降。")).toHaveLength(1);
    expect(findCausalPhrases("甘油三酯的下降与饮食调整在时间上同时发生。")).toHaveLength(0);
    const t = coerceTrendInsight({
      summary: "甘油三酯从 3.12 降到 1.58。控制晚餐碳水使得甘油三酯下降。",
      observations: ["快走起到了明显作用", "2024 年为最高点"],
      intervention_timing: "得益于饮食控制。",
      confounders: ["检测机构不同"],
      data_note: "共 5 个数据点",
      suggestions: [],
    });
    expect(hasCausalLanguage(t)).toBe(true);
    const clean = stripCausal(t);
    expect(hasCausalLanguage(clean)).toBe(false);
    expect(clean.summary).toBe("甘油三酯从 3.12 降到 1.58。");
    expect(clean.observations).toEqual(["2024 年为最高点"]);
    expect(clean.intervention_timing).toContain("时间上同时发生");
  });

  it("generates and caches a report insight with the disclaimer", async () => {
    seedDemoData(store);
    const agent = fakeAgent({
      "family-health:interpreter": [ok({ overview: "总体平稳", groups: { urgent: [], recheck: [], lifestyle: [], watch: [] }, comparison: { improved: ["甘油三酯"], worsened: [], new_findings: [] }, lifestyle_advice: [] })],
    });
    const row = await generateReportInsight(store, "demo-self-2026", agent.call);
    expect(row.status).toBe("ready");
    expect(row.markdown).toContain("> 仅供参考，不能替代医生诊断");
    const again = await generateReportInsight(store, "demo-self-2026", agent.call);
    expect(again.id).toBe(row.id);
    expect(agent.prompts).toHaveLength(1);
  });

  it("regenerates a trend insight once when causal language appears", async () => {
    seedDemoData(store);
    const causal = { summary: "饮食控制导致甘油三酯下降。", observations: [], intervention_timing: "", confounders: [], data_note: "共 5 个数据点", suggestions: [] };
    const neutral = { ...causal, summary: "甘油三酯 2024 年后回落，与饮食调整时间上同时发生。" };
    const agent = fakeAgent({ "family-health:trend-interpreter": [ok(causal), ok(neutral)] });
    const row = await generateTrendInsight(store, "demo-self", "TG", agent.call);
    expect(agent.prompts).toHaveLength(2);
    expect(agent.prompts[1].prompt).toContain("上一版回答出现了因果表述");
    expect((row.content as { summary: string }).summary).toContain("时间上同时发生");
    expect(row.markdown).toContain(DISCLAIMER);
  });
});

describe("report causal guard", () => {
  it("removes causal sentences from report interpretations", async () => {
    const { stripReportCausal } = await import("../src/lib/insights.js");
    const ins = coerceReportInsight({
      overview: "整体改善。说明减重和控制饮食起到了作用。",
      groups: { urgent: [], recheck: [], lifestyle: [{ indicator: "脂肪肝", what: "肝脏脂肪偏多。", meaning: "由轻度变为中度后又回到轻度。控制饮食使得脂肪肝好转。", next_step: "一年后复查。" }], watch: [] },
      comparison: { improved: ["甘油三酯下降", "得益于快走，体重下降"], worsened: [], new_findings: [] },
      lifestyle_advice: ["继续快走"],
    });
    const out = stripReportCausal(ins);
    expect(out.overview).toBe("整体改善。");
    expect(out.groups.lifestyle[0].meaning).toBe("由轻度变为中度后又回到轻度。");
    expect(out.comparison.improved).toEqual(["甘油三酯下降"]);
    expect(out.lifestyle_advice).toEqual(["继续快走"]);
  });
});
