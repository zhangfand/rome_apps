import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FamilyHealthStore } from "../src/db/repositories/store.js";
import { buildSnapshots, memberCtx, memberOverview } from "../src/lib/analytics.js";
import { resolveDate } from "../src/lib/dates.js";
import { clearDemoData, seedDemoData } from "../src/lib/seed.js";
import {
  UserFacingError,
  endIntervention,
  logIntervention,
  logMeasurement,
  memberCard,
  memberIndicatorDetail,
  memberPanel,
  normalizeCategory,
  queryMember,
  resolveIndicatorOrThrow,
  resolveMemberOrThrow,
} from "../src/lib/service.js";
import { createTestDb } from "./sqlite.js";

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "fh-svc-"));
  process.env.FAMILY_HEALTH_DATA_DIR = dataDir;
});
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

let store: FamilyHealthStore;
beforeEach(() => {
  store = new FamilyHealthStore(createTestDb().ctx);
});

function expectUserError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(UserFacingError);
    expect((err as UserFacingError).code).toBe(code);
    return err as UserFacingError;
  }
  throw new Error(`expected ${code}`);
}

describe("demo seed", () => {
  it("creates four demo members with confirmed checkups and is idempotent", () => {
    const first = seedDemoData(store);
    expect(first.members).toBe(4);
    expect(first.reports).toBe(17);
    const second = seedDemoData(store);
    expect(second).toEqual(first);
    expect(store.listMembers().map((m) => m.relation)).toEqual(["本人", "配偶", "父亲", "母亲"]);
    expect(store.listReports().every((r) => r.status === "confirmed" && r.isDemo)).toBe(true);
  });

  it("clears only demo rows", () => {
    seedDemoData(store);
    const real = store.createMember({ name: "真实成员", relation: "子女" });
    store.createReport({ memberId: real.id });
    const cleared = clearDemoData(store);
    expect(cleared.members).toBe(4);
    expect(store.listMembers().map((m) => m.id)).toEqual([real.id]);
    expect(store.listReports()).toHaveLength(1);
  });

  it("keeps the seed free of critical values", () => {
    seedDemoData(store);
    for (const m of store.listMembers()) {
      const card = memberCard(store, m, "2026-09-23");
      expect(card.overview.alerts, m.name).toEqual([]);
    }
  });

  it("tells the intended story for 本人", () => {
    seedDemoData(store);
    const self = store.getMember("demo-self")!;
    const snaps = buildSnapshots(store.listMemberResults(self.id), memberCtx(self));
    const tg = snaps.map((s) => s.values.get("TG")?.value);
    expect(tg).toEqual([1.92, 2.41, 3.12, 2.18, 1.58]);
    // Derived metrics are computed from confirmed data.
    expect(snaps[2].values.get("HOMA_IR")?.value).toBeCloseTo((6.3 * 17.8) / 22.5, 1);
    expect(snaps[2].values.get("NON_HDL_C")?.value).toBeCloseTo(4.89, 2);
    expect(snaps[0].values.get("EGFR")?.value).toBeGreaterThan(90);
    const overview = memberOverview({ ...memberCtx(self), goals: self.goals }, snaps, store.listMemberFindings(self.id));
    expect(overview.latestExamDate).toBe("2026-06-15");
    expect(overview.topChanges.length).toBeGreaterThan(0);
    expect(overview.topChanges.every((c) => c.trend === "better" || c.trend === "changed")).toBe(true);
    const panel = memberPanel(store, self, "weight_metabolic")!;
    const tgItem = panel.items.find((i) => i.code === "TG")!;
    expect(tgItem.trend).toBe("better");
    expect(panel.findings[0].summary).toBe("2022 轻度 → 2023 中度 → 2024 中度 → 2025 中度 → 2026 轻度");
    const weight = memberIndicatorDetail(store, self, "WEIGHT")!;
    expect(weight.points.some((p) => p.source === "measurement")).toBe(true);
    expect(weight.interventions.map((i) => i.title)).toEqual(expect.arrayContaining(["控制晚餐碳水", "每周3次快走"]));
  });
});

describe("member and indicator resolution for actions", () => {
  beforeEach(() => seedDemoData(store));

  it("resolves chat references", () => {
    expect(resolveMemberOrThrow(store, "我").id).toBe("demo-self");
    expect(resolveMemberOrThrow(store, "老婆").id).toBe("demo-spouse");
    expect(resolveMemberOrThrow(store, "我爸").id).toBe("demo-father");
    expect(resolveMemberOrThrow(store, "王秀英").id).toBe("demo-mother");
  });

  it("returns candidates for unknown members", () => {
    const err = expectUserError(() => resolveMemberOrThrow(store, "儿子"), "member_not_found");
    expect((err.details?.candidates as unknown[]).length).toBe(4);
  });

  it("resolves indicators by alias and code, with suggestions otherwise", () => {
    expect(resolveIndicatorOrThrow("体重").code).toBe("WEIGHT");
    expect(resolveIndicatorOrThrow("tg").code).toBe("TG");
    expect(resolveIndicatorOrThrow("尿酸").code).toBe("UA");
    const err = expectUserError(() => resolveIndicatorOrThrow("血脂水平"), "indicator_not_found");
    expect(err.details?.suggestions).toBeDefined();
  });

  it("normalizes intervention categories", () => {
    expect(normalizeCategory("每天跑步5公里")).toBe("运动");
    expect(normalizeCategory("控制晚餐碳水")).toBe("饮食");
    expect(normalizeCategory("吃他汀")).toBe("药物");
    expect(normalizeCategory("早睡")).toBe("睡眠");
    expect(normalizeCategory("运动")).toBe("运动");
  });
});

describe("chat logging", () => {
  beforeEach(() => seedDemoData(store));

  it("logs an intervention with a resolved relative date", () => {
    const { member, intervention } = logIntervention(store, { member: "我", title: "每天跑步5公里", startDate: "2026-09-16" });
    expect(member.id).toBe("demo-self");
    expect(intervention).toMatchObject({ category: "运动", startDate: "2026-09-16", endDate: null, createdVia: "chat" });
  });

  it("rejects unparseable dates with a clear error", () => {
    expectUserError(() => logIntervention(store, { member: "我", title: "快走", startDate: "某天" }), "invalid_date");
  });

  it("ends an intervention by fuzzy title, asking when ambiguous", () => {
    const ended = endIntervention(store, { member: "我", title: "快走", endDate: "2026-09-01" });
    expect(ended.endDate).toBe("2026-09-01");
    expectUserError(() => endIntervention(store, { member: "我", title: "游泳" }), "intervention_not_found");
    expectUserError(() => endIntervention(store, { member: "我爸" }), "ambiguous_intervention");
  });

  it("logs weight in 斤 converted to kg", () => {
    const { measurements } = logMeasurement(store, { member: "老婆", indicator: "体重", value: "125", unit: "斤", date: "2026-09-20" });
    expect(measurements[0]).toMatchObject({ indicatorCode: "WEIGHT", value: 62.5, unit: "kg", rawUnit: "斤" });
  });

  it("logs a value with an embedded unit", () => {
    const { measurements } = logMeasurement(store, { member: "老婆", indicator: "体重", value: "62.5kg" });
    expect(measurements[0]).toMatchObject({ value: 62.5, unit: "kg" });
  });

  it("splits blood pressure into SBP and DBP", () => {
    const { measurements } = logMeasurement(store, { member: "我爸", indicator: "血压", value: "135/85", date: "2026-09-22" });
    expect(measurements.map((m) => [m.indicatorCode, m.value])).toEqual([
      ["SBP", 135],
      ["DBP", 85],
    ]);
  });

  it("converts glucose mg/dL and rejects incompatible units", () => {
    const { measurements } = logMeasurement(store, { member: "我", indicator: "空腹血糖", value: 99, unit: "mg/dL" });
    expect(measurements[0].value).toBeCloseTo(5.49, 2);
    expectUserError(() => logMeasurement(store, { member: "我", indicator: "空腹血糖", value: 5, unit: "kg" }), "incompatible_unit");
  });
});

describe("query", () => {
  it("returns compact history for one indicator with filters", () => {
    seedDemoData(store);
    const out = queryMember(store, { member: "我爸", indicator: "尿酸", from: "2024-01-01" }) as Record<string, any>;
    expect(out.member.relation).toBe("父亲");
    expect(out.indicator.code).toBe("UA");
    expect(out.indicator.history.map((h: any) => h.date)).toEqual(["2024-04-16", "2025-04-15", "2026-04-14"]);
    expect(out.latest_exam.abnormal.map((a: any) => a.name)).toContain("尿酸");
    expect(out.findings.map((f: any) => f.name)).toContain("颈动脉斑块");
    expect(out.disclaimer).toBe("仅供参考，不能替代医生诊断");
  });
});

describe("dates", () => {
  const now = new Date(2026, 8, 23);
  it.each([
    ["2026-09-16", "2026-09-16"],
    ["2026/9/1", "2026-09-01"],
    ["2025年3月1日", "2025-03-01"],
    ["今天", "2026-09-23"],
    ["昨天", "2026-09-22"],
    ["上周", "2026-09-16"],
    ["3天前", "2026-09-20"],
    ["两周前", "2026-09-09"],
    ["9月1日", "2026-09-01"],
    ["12月1日", "2025-12-01"],
  ])("%s → %s", (input, expected) => {
    expect(resolveDate(input, now)).toBe(expected);
  });
  it("rejects nonsense", () => {
    expect(resolveDate("某天", now)).toBeNull();
    expect(resolveDate("2026-02-30", now)).toBeNull();
  });
});

describe("guardian timezone", () => {
  it("computes today in the guardian's zone, not the host clock", async () => {
    const { setTimeZone, todayIso, resolveDate: rd } = await import("../src/lib/dates.js");
    const instant = new Date("2026-09-24T03:30:00Z"); // 20:30 on the 23rd in Los Angeles
    setTimeZone("America/Los_Angeles");
    try {
      expect(todayIso(instant)).toBe("2026-09-23");
      expect(rd("昨天", instant)).toBe("2026-09-22");
      setTimeZone("Asia/Shanghai");
      expect(todayIso(instant)).toBe("2026-09-24");
      setTimeZone("Not/AZone");
      expect(todayIso(new Date(2026, 8, 23, 12))).toBe("2026-09-23");
    } finally {
      setTimeZone(null);
    }
  });

  it("prefers a title match over the category fallback when ending interventions", () => {
    seedDemoData(store);
    logIntervention(store, { member: "我", title: "每天跑步5公里", startDate: "2026-09-14" });
    expect(endIntervention(store, { member: "我", title: "跑步", endDate: "2026-09-23" }).title).toBe("每天跑步5公里");
  });
});

describe("weight trend", () => {
  it("judges weight change against the healthy BMI range", () => {
    seedDemoData(store);
    const panel = memberPanel(store, store.getMember("demo-self")!, "weight_metabolic")!;
    const w = panel.items.find((i) => i.code === "WEIGHT")!;
    expect(w.trend).toBe("better");
    expect(w.ref).toEqual({ low: 56.7, high: 73.2 });
  });
});

describe("reopen", () => {
  it("returns a confirmed report to review and hides it from trends", () => {
    seedDemoData(store);
    store.reopenReport("demo-self-2026");
    expect(store.getReport("demo-self-2026")!.status).toBe("needs_review");
    const dates = buildSnapshots(store.listMemberResults("demo-self"), memberCtx(store.getMember("demo-self")!)).map((s) => s.examDate);
    expect(dates).not.toContain("2026-06-15");
    expect(store.listReportResults("demo-self-2026").every((r) => !r.confirmed)).toBe(true);
  });
});
