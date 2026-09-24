/**
 * Safety behaviours added after independent verification:
 * - home measurements go through the same critical-value rules (banner, query, action result);
 * - hard plausibility bounds for measurements and reviewer edits;
 * - edited rows keep the extracted value for provenance and show a clean value;
 * - causal-language guard on stored insights and on all seeded demo text;
 * - owner-only API gate fails closed.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActionConfig, ActionResult, AppActionRuntimeDeps, RomeAppApiRequest, RomeAppCaller, RomeAppContext } from "@rome-os/app-runtime";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as logMeasurementAction from "../src/actions/log-measurement/index.js";
import * as queryAction from "../src/actions/query/index.js";
import { createApiHandler } from "../src/api/index.js";
import { FamilyHealthStore } from "../src/db/repositories/store.js";
import { INDICATORS } from "../src/domain/indicators.js";
import { checkPlausible, plausibleRange } from "../src/domain/plausibility.js";
import { stripValueMarker } from "../src/domain/values.js";
import { daysBetween, todayIso } from "../src/lib/dates.js";
import { findCausalPhrases } from "../src/lib/insights.js";
import { seedDemoData } from "../src/lib/seed.js";
import { UserFacingError, logMeasurement, memberCard } from "../src/lib/service.js";
import { createTestDb } from "./sqlite.js";

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "fh-safety-"));
  process.env.FAMILY_HEALTH_DATA_DIR = dataDir;
});
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

let dbCtx: ReturnType<typeof createTestDb>["ctx"];
let store: FamilyHealthStore;
beforeEach(() => {
  dbCtx = createTestDb().ctx;
  store = new FamilyHealthStore(dbCtx);
});

const daysAgo = (n: number) => {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

function newMember(name = "测试成员") {
  return store.createMember({ name, relation: "父亲", sex: "male", birthDate: "1960-01-01" });
}

// ------------------------------------------------------------------ domain

describe("plausibility bounds", () => {
  it("covers only real dictionary codes", () => {
    const codes = new Set(INDICATORS.map((d) => d.code));
    for (const d of INDICATORS) {
      if (plausibleRange(d.code)) expect(codes.has(d.code)).toBe(true);
    }
    for (const c of ["WEIGHT", "SBP", "DBP", "GLU", "HR", "HEIGHT", "WAIST"]) expect(plausibleRange(c), c).not.toBeNull();
  });

  it("rejects impossible values with a Chinese message and the accepted range", () => {
    const w = checkPlausible("WEIGHT", 7000)!;
    expect(w).toMatchObject({ code: "WEIGHT", min: 1, max: 400, unit: "kg" });
    expect(w.message).toContain("体重 7000 kg 超出合理范围（1–400 kg）");
    expect(checkPlausible("WEIGHT", 72.5)).toBeNull();
    expect(checkPlausible("GLU", 108)?.message).toContain("0.5–60 mmol/L");
    expect(checkPlausible("ALT", -3)?.message).toContain("0–20000 U/L");
    expect(checkPlausible("APOB", -1)?.message).toContain("不小于 0");
    expect(checkPlausible("BMD_T", -3.1)).toBeNull();
    expect(checkPlausible(null, 5)).toBeNull();
  });

  it("strips printed markers for display", () => {
    expect(stripValueMarker("6.4↑")).toBe("6.4");
    expect(stripValueMarker("↓0.92")).toBe("0.92");
    expect(stripValueMarker("2.35 H")).toBe("2.35");
    expect(stripValueMarker("阳性(+)*")).toBe("阳性(+)");
    expect(stripValueMarker("阴性(-)")).toBe("阴性(-)");
    expect(stripValueMarker("138/88")).toBe("138/88");
  });
});

// ------------------------------------------------------------------ measurements

describe("home-measurement red flags", () => {
  it("raises 建议尽快就医 for a 185/115 blood pressure on the member card and in query", () => {
    const m = newMember();
    const out = logMeasurement(store, { member: m.id, indicator: "血压", value: "185/115" });
    expect(out.alerts.map((a) => [a.code, a.level])).toEqual([
      ["SBP", "urgent"],
      ["DBP", "urgent"],
    ]);
    const card = memberCard(store, store.getMember(m.id)!);
    const alerts = (card as { overview: { alerts: Array<{ code: string; level: string; source?: string; message: string }> } }).overview.alerts;
    expect(alerts.map((a) => [a.code, a.level, a.source])).toEqual([
      ["SBP", "urgent", "measurement"],
      ["DBP", "urgent", "measurement"],
    ]);
    expect(alerts[0].message).toMatch(/^家庭自测（\d{4}-\d{2}-\d{2}）收缩压 185 mmHg：收缩压 ≥180 mmHg/);
  });

  it("ignores old measurements and ones superseded by a later checkup", () => {
    const m = newMember();
    logMeasurement(store, { member: m.id, indicator: "血压", value: "185/115", date: daysAgo(40) });
    expect((memberCard(store, store.getMember(m.id)!) as any).overview.alerts).toEqual([]);

    const m2 = newMember("测试成员二");
    logMeasurement(store, { member: m2.id, indicator: "血压", value: "182/100", date: daysAgo(5) });
    const r = store.createReport({ memberId: m2.id, examDate: daysAgo(2) });
    store.insertResults([
      { reportId: r.id, memberId: m2.id, indicatorCode: "SBP", rawName: "收缩压", rawValue: "128", valueNum: 128, rawUnit: "mmHg", unit: "mmHg", refText: "90-139", refLow: 90, refHigh: 139, flag: "normal", confirmed: true, source: "extracted", sortOrder: 0 },
      { reportId: r.id, memberId: m2.id, indicatorCode: "DBP", rawName: "舒张压", rawValue: "82", valueNum: 82, rawUnit: "mmHg", unit: "mmHg", refText: "60-89", refLow: 60, refHigh: 89, flag: "normal", confirmed: true, source: "extracted", sortOrder: 1 },
    ] as never);
    store.updateReport(r.id, { status: "confirmed" });
    expect(daysBetween(daysAgo(5), todayIso())).toBe(5);
    expect((memberCard(store, store.getMember(m2.id)!) as any).overview.alerts).toEqual([]);
  });

  it("rejects implausible values and saves nothing", () => {
    const m = newMember();
    const err = (() => {
      try {
        logMeasurement(store, { member: m.id, indicator: "体重", value: 7000, unit: "kg" });
      } catch (e) {
        return e as UserFacingError;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err!.code).toBe("value_out_of_range");
    expect(err!.details).toEqual({ accepted: { min: 1, max: 400, unit: "kg" } });
    expect(() => logMeasurement(store, { member: m.id, indicator: "血压", value: "400/100" })).toThrow(/超出合理范围/);
    expect(() => logMeasurement(store, { member: m.id, indicator: "空腹血糖", value: 108, unit: "mmol/L" })).toThrow(/0\.5–60 mmol\/L/);
    expect(store.listMeasurements(m.id)).toHaveLength(0);
    // …while unit conversion still makes 108 mg/dL fine.
    expect(logMeasurement(store, { member: m.id, indicator: "空腹血糖", value: 108, unit: "mg/dL" }).measurements[0].value).toBeCloseTo(5.99, 2);
  });
});

describe("chat actions relay alerts", () => {
  let deps: AppActionRuntimeDeps;
  beforeEach(() => {
    deps = { appContext: { db: dbCtx } } as unknown as AppActionRuntimeDeps;
  });
  type Mod = { createAction: (c: ActionConfig, d: AppActionRuntimeDeps) => { execute: (a: Record<string, unknown>, c?: never) => Promise<ActionResult> } };
  const call = (mod: Mod, args: Record<string, unknown>) => mod.createAction({ name: "t" } as ActionConfig, deps).execute(args, {} as never);

  it("log_measurement returns alerts + a relay sentence; query reports them too", async () => {
    newMember();
    const r = await call(logMeasurementAction as Mod, { member: "测试成员", indicator: "血压", value: "185/115" });
    expect(r.status).toBe("ok");
    const d = (r as { data: any }).data;
    expect(d.alerts).toHaveLength(2);
    expect(d.alerts[0]).toMatchObject({ level: "建议尽快就医", indicator: "收缩压", value: 185, unit: "mmHg" });
    expect(d.relay).toMatch(/^【建议尽快就医】收缩压 ≥180 mmHg/);
    expect(d.relay).toContain("不能替代医生诊断");

    const q = (await call(queryAction as Mod, { member: "测试成员" })) as { data: any };
    expect(q.data.alerts.map((a: any) => a.level)).toEqual(["建议尽快就医", "建议尽快就医"]);
  });

  it("a normal reading has no alerts", async () => {
    newMember();
    const d = ((await call(logMeasurementAction as Mod, { member: "测试成员", indicator: "血压", value: "128/82" })) as { data: any }).data;
    expect(d.alerts).toEqual([]);
    expect(d.relay).toBeUndefined();
  });

  it("value_out_of_range is a structured action error", async () => {
    newMember();
    const r = await call(logMeasurementAction as Mod, { member: "测试成员", indicator: "体重", value: 7000, unit: "kg" });
    expect(r.status).toBe("error");
    const e = JSON.parse((r as { error: string }).error);
    expect(e).toMatchObject({ code: "value_out_of_range", accepted: { min: 1, max: 400, unit: "kg" } });
  });
});

// ------------------------------------------------------------------ API

function api() {
  const ctx = {
    db: dbCtx,
    app: { id: "family-health", version: "test" },
    log: { info() {}, warn() {}, error() {}, debug() {} },
    runAction: async () => ({ status: "ok" }),
  } as unknown as RomeAppContext;
  const handler = createApiHandler(ctx);
  const guardian: RomeAppCaller = { kind: "guardian", userId: "u1", via: "cookie" };
  return async (method: string, path: string, body?: unknown, caller: RomeAppCaller | undefined = guardian) => {
    const [p, q = ""] = path.split("?");
    const res = await handler.handle({
      method,
      path: p.split("/").filter(Boolean),
      headers: {},
      query: new URLSearchParams(q),
      body: body === undefined ? undefined : new TextEncoder().encode(JSON.stringify(body)),
      caller: caller as RomeAppCaller,
    } as RomeAppApiRequest);
    return { status: res.status, body: (await res.json()) as any };
  };
}

describe("API", () => {
  it("is owner-only and fails closed", async () => {
    const call = api();
    expect((await call("GET", "members")).status).toBe(200);
    expect((await call("GET", "members", undefined, { kind: "guardian", userId: "u", via: "loopback" })).status).toBe(200);
    const anon = await call("GET", "members", undefined, { kind: "anonymous" });
    expect(anon.status).toBe(401);
    expect(anon.body.error ?? anon.body.code).toBe("guardian_only");
    expect((await call("GET", "members", undefined, { kind: "visitor", accountId: "a", email: "x@y.z" })).status).toBe(401);
    expect((await call("GET", "members", undefined, null as never)).status).toBe(401);
    const st = await call("GET", "status", undefined, { kind: "guardian", userId: "u", via: "loopback" });
    expect(st.body.caller).toEqual({ kind: "guardian", via: "loopback" });
  });

  it("POST measurements validates bounds and returns alerts", async () => {
    const call = api();
    const m = newMember();
    const bad = await call("POST", `members/${m.id}/measurements`, { indicator: "体重", value: 7000, unit: "kg" });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain("value_out_of_range");
    const ok = await call("POST", `members/${m.id}/measurements`, { indicator: "血压", value: "185/115" });
    expect(ok.status).toBe(201);
    expect(ok.body.alerts.map((a: any) => a.level)).toEqual(["urgent", "urgent"]);
    const card = await call("GET", `members/${m.id}`);
    expect(card.body.overview.alerts).toHaveLength(2);
  });

  it("review edits: clean display value, edited flag with provenance, bounds", async () => {
    const call = api();
    const m = newMember();
    const r = store.createReport({ memberId: m.id, examDate: "2026-08-18" });
    const added = await call("POST", `reports/${r.id}/results`, { rawName: "空腹血糖 GLU", rawValue: "6.4↑", rawUnit: "mmol/L", refText: "3.9-6.1" });
    expect(added.status).toBe(201);
    const row = added.body.results[0];
    expect(row).toMatchObject({ indicatorCode: "GLU", rawValue: "6.4↑", displayValue: "6.4", valueNum: 6.4, flag: "H", edited: false, originalRawValue: null });

    // Saving the unchanged value is not an edit.
    const same = await call("PATCH", `results/${row.id}`, { rawValue: "6.4↑" });
    expect(same.body.results[0].edited).toBe(false);

    const edited = await call("PATCH", `results/${row.id}`, { rawValue: "6.8" });
    expect(edited.status).toBe(200);
    expect(edited.body.results[0]).toMatchObject({ rawValue: "6.8", displayValue: "6.8", valueNum: 6.8, edited: true, originalRawValue: "6.4↑" });
    // A second edit keeps the first extracted value.
    const again = await call("PATCH", `results/${row.id}`, { rawValue: "6.2" });
    expect(again.body.results[0]).toMatchObject({ edited: true, originalRawValue: "6.4↑" });
    // Persisted, not just echoed.
    expect(store.getResult(row.id)).toMatchObject({ edited: true, originalRawValue: "6.4↑", rawValue: "6.2" });

    const tooHigh = await call("PATCH", `results/${row.id}`, { rawValue: "680" });
    expect(tooHigh.status).toBe(400);
    expect(JSON.stringify(tooHigh.body)).toContain("超出合理范围");
    expect(store.getResult(row.id)!.rawValue).toBe("6.2");
    // A unit change that makes the canonical value impossible is rejected too (6.2 mg/dL glucose = 0.34 mmol/L).
    const unitSlip = await call("PATCH", `results/${row.id}`, { rawUnit: "mg/dL" });
    expect(unitSlip.status).toBe(400);
    expect(store.getResult(row.id)!.rawUnit).toBe("mmol/L");

    const badAdd = await call("POST", `reports/${r.id}/results`, { rawName: "体重", rawValue: "7000", rawUnit: "kg" });
    expect(badAdd.status).toBe(400);
  });

  it("serves stored interpretations through the causal-language guard", async () => {
    const call = api();
    const m = newMember();
    const r = store.createReport({ memberId: m.id, examDate: "2026-06-15" });
    store.upsertInsight({
      scope: "report",
      scopeId: r.id,
      memberId: m.id,
      status: "ready",
      content: {
        overview: "整体情况比去年好。",
        groups: {
          urgent: [],
          recheck: [],
          lifestyle: [{ indicator: "脂肪肝", what: "肝脏脂肪偏多。", meaning: "B超显示为轻度，比往年的中度有所减轻。说明减重和控制饮食起了作用。", next_step: "一年后复查。" }],
          watch: [],
        },
        comparison: { improved: ["脂肪肝减轻"], worsened: [], new_findings: [] },
        lifestyle_advice: ["继续控制饮食。"],
        disclaimer: "仅供参考",
      },
      markdown: "说明减重和控制饮食起了作用。",
      error: null,
      model: "t",
      promptVersion: "t",
      inputHash: "t",
    } as never);
    const d = await call("GET", `reports/${r.id}`);
    const text = JSON.stringify(d.body.insight);
    expect(text).toContain("有所减轻");
    expect(text).not.toContain("起了作用");
    const viaGet = await call("GET", `insights?scope=report&id=${r.id}`);
    expect(JSON.stringify(viaGet.body.insight)).not.toContain("起了作用");
  });
});

// ------------------------------------------------------------------ demo text

describe("seeded demo data", () => {
  it("contains no causal phrasing about interventions anywhere", () => {
    seedDemoData(store);
    const texts: string[] = [];
    for (const m of store.listMembers()) {
      texts.push(m.notes ?? "");
      for (const iv of store.listInterventions(m.id)) texts.push(iv.title, iv.description ?? "");
      for (const ms of store.listMeasurements(m.id)) texts.push(ms.note ?? "");
      for (const f of store.listMemberFindings(m.id)) texts.push(f.rawText ?? "", f.severity ?? "");
      for (const r of store.listReports({ memberId: m.id })) {
        texts.push(r.provider ?? "");
        const ins = store.getInsight("report", r.id);
        if (ins) texts.push(JSON.stringify(ins.content), ins.markdown ?? "");
      }
    }
    const extra = /起了作用|起到了?作用|说明[^。；]{0,20}(有效|作用|见效)|因为[^。；]{0,30}所以|导致|使得/;
    const bad = texts.filter((t) => findCausalPhrases(t).length > 0 || extra.test(t));
    expect(bad).toEqual([]);
    expect(texts.length).toBeGreaterThan(30);
  });
});
