/**
 * Re-map without re-extraction, provenance in the API, the additive
 * migration, and the flag regression over seeded demo data. Synthetic data
 * only (the "测试成员" rows below are made up).
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RomeAppApiRequest, RomeAppCaller, RomeAppContext } from "@rome-os/app-runtime";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiHandler } from "../src/api/index.js";
import { FamilyHealthStore, type ResultInsert } from "../src/db/repositories/store.js";
import { ageAt } from "../src/domain/derived.js";
import type { AgentCaller, AgentResult } from "../src/lib/agent.js";
import { MAPPER_AGENT } from "../src/lib/extraction.js";
import { remapReport } from "../src/lib/remap.js";
import { seedDemoData } from "../src/lib/seed.js";
import { resultVerdict } from "../src/lib/verdicts.js";
import { createTestDb } from "./sqlite.js";

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "fh-remap-"));
  process.env.FAMILY_HEALTH_DATA_DIR = dataDir;
});
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

let dbCtx: ReturnType<typeof createTestDb>["ctx"];
let store: FamilyHealthStore;
beforeEach(() => {
  dbCtx = createTestDb().ctx;
  store = new FamilyHealthStore(dbCtx);
});

const row = (reportId: string, memberId: string, r: Partial<ResultInsert> & { rawName: string; rawValue: string }): ResultInsert =>
  ({
    reportId,
    memberId,
    indicatorCode: null,
    rawUnit: "",
    unit: "",
    valueNum: null,
    valueText: null,
    refLow: null,
    refHigh: null,
    refText: null,
    flag: null,
    section: null,
    page: 1,
    confidence: null,
    source: "extracted",
    confirmed: false,
    sortOrder: 0,
    ...r,
  }) as ResultInsert;

function fixture() {
  const m = store.createMember({ name: "测试成员", relation: "本人", sex: "male", birthDate: "1980-01-01" });
  const r = store.createReport({ memberId: m.id, examDate: "2026-01-10", provider: "测试体检中心" });
  store.updateReport(r.id, { status: "needs_review" });
  store.insertResults([
    // old deterministic mis-mapping: P电轴 → 血磷 P (flagged H against the phosphorus range)
    row(r.id, m.id, { rawName: "P电轴", rawValue: "60", rawUnit: "Angle", section: "心电图", indicatorCode: "P", valueNum: 60, unit: "mmol/L", flag: "H", confidence: 0.9, sortOrder: 0 }),
    // unmapped; its H came from a separate 提示 column (no printed range)
    row(r.id, m.id, { rawName: "镜检管型", rawValue: "3", rawUnit: "Cast/LP", section: "尿常规", valueNum: 3, flag: "H", sortOrder: 1 }),
    // reviewer-edited row must stay exactly as is
    row(r.id, m.id, { rawName: "P电轴", rawValue: "61", rawUnit: "Angle", section: "心电图", indicatorCode: "P", valueNum: 61, unit: "mmol/L", flag: "H", confidence: 1, edited: true, originalRawValue: "60", sortOrder: 2 }),
    // manual row must stay exactly as is
    row(r.id, m.id, { rawName: "手工项目", rawValue: "5", source: "manual", sortOrder: 3 }),
    // earlier LLM-mapper choice (0.75) that deterministic mapping cannot reproduce: kept
    row(r.id, m.id, { rawName: "某检验项目甲", rawValue: "40", rawUnit: "U/L", section: "生化", indicatorCode: "GGT", valueNum: 40, unit: "U/L", flag: "normal", confidence: 0.75, sortOrder: 4 }),
    // unknown names → mapper
    row(r.id, m.id, { rawName: "某检验项目乙", rawValue: "30", rawUnit: "U/L", refText: "9-50", section: "生化", valueNum: 30, flag: "normal", sortOrder: 5 }),
    row(r.id, m.id, { rawName: "P波", rawValue: "0.1", rawUnit: "mV", section: "心电图", valueNum: 0.1, sortOrder: 6 }),
    // ultrasound bone density T值 previously sent to DXA BMD_T
    row(r.id, m.id, { rawName: "T值", rawValue: "-1.2", section: "超声骨密度检测", indicatorCode: "BMD_T", valueNum: -1.2, flag: "normal", confidence: 1, sortOrder: 7 }),
  ]);
  return { m, r };
}

function fakeMapper(map: Record<string, string>) {
  const prompts: string[] = [];
  const call: AgentCaller = async <T>(agent: string, prompt: string) => {
    prompts.push(prompt);
    expect(agent).toBe(MAPPER_AGENT);
    const names = [...prompt.matchAll(/^(.+?) \| /gm)].map((x) => x[1]).filter((n) => !n.includes("|"));
    return { ok: true, raw: "", data: { mappings: names.map((n) => ({ raw_name: n, code: map[n] ?? null })) } } as AgentResult<T>;
  };
  return { call, prompts };
}

describe("remap without re-extraction", () => {
  it("fixes collisions, keeps edits/manual rows and mapper choices, calls the mapper only for unknown names", async () => {
    const { r } = fixture();
    const before = store.listReportResults(r.id);
    const mapper = fakeMapper({ "某检验项目乙": "ALT", "P波": "P" });
    const out = await remapReport(r.id, { store, callAgent: mapper.call });

    expect(out.before).toEqual({ mapped: 4, unmapped: 4 });
    expect(out.after).toEqual({ mapped: 6, unmapped: 2 });
    expect(out.preserved).toBe(2);
    expect(out.mapperCalled).toBe(true);
    expect(mapper.prompts).toHaveLength(1);
    expect(mapper.prompts[0]).toContain("某检验项目乙");
    expect(mapper.prompts[0]).toContain("P波");
    expect(mapper.prompts[0]).not.toContain("某检验项目甲");
    expect(out.changed.map((c) => [c.raw_name, c.from, c.to])).toEqual([
      ["P电轴", "P", "ECG_P_AXIS"],
      ["镜检管型", null, "U_CAST_MICRO"],
      ["某检验项目乙", null, "ALT"],
      ["T值", "BMD_T", "QUS_T"],
    ]);

    const after = new Map(store.listReportResults(r.id).map((x) => [x.id, x]));
    expect(after.size).toBe(before.length);
    const [pAxis, cast, edited, manual, kept, mapped, pWave, qus] = before.map((b) => after.get(b.id)!);
    expect(pAxis).toMatchObject({ indicatorCode: "ECG_P_AXIS", unit: "°", valueNum: 60, flag: null, confidence: 1 });
    // the lab's lost ↑ is kept as the printed marker
    expect(cast).toMatchObject({ indicatorCode: "U_CAST_MICRO", flag: "H", printedMarker: "H" });
    // edited + manual rows: byte-for-byte unchanged
    expect(edited).toEqual(before[2]);
    expect(manual).toEqual(before[3]);
    expect(kept).toEqual(before[4]);
    expect(mapped).toMatchObject({ indicatorCode: "ALT", confidence: 0.75, refLow: 9, refHigh: 50, flag: "normal" });
    // the mapper's P for "P波" is refused by the collision fences
    expect(pWave.indicatorCode).toBeNull();
    expect(qus.indicatorCode).toBe("QUS_T");
  });

  it("is idempotent", async () => {
    const { r } = fixture();
    const mapper = fakeMapper({ "某检验项目乙": "ALT", "P波": "P" });
    await remapReport(r.id, { store, callAgent: mapper.call });
    const snapshot = store.listReportResults(r.id);
    const again = await remapReport(r.id, { store, callAgent: mapper.call });
    expect(again.changed).toEqual([]);
    expect(store.listReportResults(r.id)).toEqual(snapshot);
  });

  it("works without an agent (deterministic only) and never touches row count", async () => {
    const { r } = fixture();
    const out = await remapReport(r.id, { store });
    expect(out.mapperCalled).toBe(false);
    expect(store.listReportResults(r.id)).toHaveLength(8);
  });

  it("refuses confirmed and extracting reports", async () => {
    const { r } = fixture();
    store.updateReport(r.id, { status: "confirmed" });
    await expect(remapReport(r.id, { store })).rejects.toMatchObject({ code: "report_confirmed" });
    store.updateReport(r.id, { status: "extracting" });
    await expect(remapReport(r.id, { store })).rejects.toMatchObject({ code: "busy" });
    await expect(remapReport("nope", { store })).rejects.toMatchObject({ code: "report_not_found" });
  });
});

// ------------------------------------------------------------------ API

function api() {
  const ctx = {
    db: dbCtx,
    app: { id: "family-health", version: "test" },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    // No real agent in tests: the mapper call fails and remap stays deterministic.
    runAction: async () => ({ status: "error", error: "no agent in tests" }),
  } as unknown as RomeAppContext;
  const handler = createApiHandler(ctx);
  const caller: RomeAppCaller = { kind: "guardian", userId: "u", via: "cookie" };
  return async (method: string, path: string, body?: unknown) => {
    const res = await handler.handle({
      method,
      path: path.split("/").filter(Boolean),
      headers: {},
      query: new URLSearchParams(),
      body: body === undefined ? undefined : new TextEncoder().encode(JSON.stringify(body)),
      caller,
    } as RomeAppApiRequest);
    return { status: res.status, body: (await res.json()) as any };
  };
}

describe("API: provenance, library, remap", () => {
  it("report detail carries a verdict per row", async () => {
    const call = api();
    const { r } = fixture();
    const d = await call("GET", `reports/${r.id}`);
    const byName = (n: string) => d.body.results.find((x: any) => x.rawName === n);
    const mapped = byName("某检验项目甲");
    // GGT has a verified national range (WS/T 404.1) and the row printed none.
    expect(mapped.verdict).toMatchObject({ basis: "standard", disagreement: false });
    expect(mapped.verdict.usedRange.levelZh).toBe("国家标准");
    expect(mapped.verdict.usedRange.evidenceQuote).toContain("GGT");
    const withRef = byName("某检验项目乙");
    expect(withRef.verdict.basis).toBe("report");
  });

  it("remap endpoint returns the summary and refuses confirmed reports", async () => {
    const call = api();
    const { r } = fixture();
    const res = await call("POST", `reports/${r.id}/remap`);
    expect(res.status).toBe(200);
    expect(res.body.changed.map((c: any) => c.to)).toContain("ECG_P_AXIS");
    expect(res.body.detail.results).toHaveLength(8);
    store.updateReport(r.id, { status: "confirmed" });
    expect((await call("POST", `reports/${r.id}/remap`)).status).toBe(409);
  });

  it("library lists every entry with sources and levels", async () => {
    const call = api();
    const lib = await call("GET", "library");
    expect(lib.status).toBe(200);
    expect(lib.body.indicators.length).toBeGreaterThan(200);
    expect(lib.body.sources.map((s: any) => s.id)).toContain("legacy-unverified");
    const glu = lib.body.indicators.find((i: any) => i.code === "GLU");
    expect(glu.legacy.source.level).toBe("unverified");
    expect(glu.explain.source.levelZh ?? glu.explain.source.level).toBeTruthy();
    expect(glu.verified).toBe(true); // 糖尿病诊断切点 (中国糖尿病防治指南 2024)
    expect(glu.thresholds.map((t: any) => t.id)).toContain("glu_fpg_cn");
    const cea = lib.body.indicators.find((i: any) => i.code === "CEA");
    expect(cea.verified).toBe(false);
    const one = await call("GET", "library/ecg_p_axis");
    expect(one.body).toMatchObject({ code: "ECG_P_AXIS", categoryZh: "心电图", ranges: [], loinc: null });
    expect((await call("GET", "library/NOPE")).status).toBe(404);
  });

  it("sources lists every cited source with usage, plain-Chinese notes and the research gaps", async () => {
    const call = api();
    const idx = await call("GET", "sources");
    expect(idx.status).toBe(200);
    const ids = idx.body.sources.map((s: any) => s.id);
    expect(ids).toContain("legacy-unverified");
    expect(ids).toContain("src_wst404_1_2012");
    for (const s of idx.body.sources) expect(s.note?.checkedHow, s.id).toBeTruthy();
    expect(idx.body.counts.needsOfficialCheck).toBe(idx.body.sources.filter((s: any) => s.verifiedVia === "secondary").length);
    expect(idx.body.gaps.length).toBeGreaterThan(5);
    expect(idx.body.research.flatMap((r: any) => r.gaps).length).toBeGreaterThan(0);

    const one = await call("GET", "sources/src_wst404_1_2012");
    expect(one.status).toBe(200);
    expect(one.body.ranges.map((r: any) => r.code)).toEqual(expect.arrayContaining(["ALT", "AST", "ALP", "GGT"]));
    expect(one.body.ranges.every((r: any) => r.candidate.evidenceQuote)).toBe(true);
    const lipid = await call("GET", "sources/src_cn_lipid_guideline_2023");
    expect(lipid.body.thresholds.map((t: any) => t.id)).toContain("thr_tg_primary_low_risk");
    expect(lipid.body.needsOfficialCheck).toBe(true);
    const legacy = await call("GET", "sources/legacy-unverified");
    expect(legacy.body.legacyInUse.map((i: any) => i.code)).toContain("CEA");
    expect(legacy.body.legacyInUse.map((i: any) => i.code)).not.toContain("ALT");
    expect((await call("GET", "sources/nope")).status).toBe(404);
  });
});

// ------------------------------------------------------------------ migration + regression

describe("migrations are additive", () => {
  it("0002 keeps existing rows and adds defaults", () => {
    const dir = join(import.meta.dirname, "..", "src", "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const db = new DatabaseSync(":memory:");
    const apply = (f: string) => {
      for (const stmt of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) if (stmt.trim()) db.exec(stmt);
    };
    const i = files.findIndex((f) => f.startsWith("0002"));
    expect(i).toBeGreaterThan(0);
    files.slice(0, i).forEach(apply);
    db.exec(`INSERT INTO family_health__indicator_defs (code, name_zh, category, direction, updated_at) VALUES ('X', '测试', 'general', 'info', 0)`);
    db.exec(`INSERT INTO family_health__results (id, report_id, member_id, raw_name, created_at, updated_at) VALUES ('res1', 'r1', 'm1', '测试项目', 0, 0)`);
    const sql = readFileSync(join(dir, files[i]), "utf8");
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE|RENAME/i);
    apply(files[i]);
    expect(db.prepare("SELECT code, ranges, loinc FROM family_health__indicator_defs").all()).toEqual([{ code: "X", ranges: "[]", loinc: null }]);
    expect(db.prepare("SELECT id, raw_name, printed_marker FROM family_health__results").all()).toEqual([{ id: "res1", raw_name: "测试项目", printed_marker: null }]);
  });
});

describe("flag regression over seeded demo data", () => {
  it("read-time verdicts reproduce every stored flag", () => {
    seedDemoData(store);
    let n = 0;
    for (const m of store.listMembers()) {
      const who = (date: string | null) => ({ sex: (m.sex as "male" | "female" | null) ?? null, age: date ? ageAt(m.birthDate, date) : null });
      for (const rep of store.listReports({ memberId: m.id })) {
        for (const r of store.listReportResults(rep.id)) {
          const v = resultVerdict(r, who(rep.examDate), { reportId: rep.id, provider: rep.provider, examDate: rep.examDate });
          expect(v.flag, `${r.rawName} ${r.rawValue} ${r.refText}`).toBe(r.flag);
          n++;
        }
      }
    }
    expect(n).toBe(650);
  });
});
