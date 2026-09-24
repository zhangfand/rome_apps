import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as addMember from "../src/actions/add-member/index.js";
import * as endIntervention from "../src/actions/end-intervention/index.js";
import * as listMembers from "../src/actions/list-members/index.js";
import * as logIntervention from "../src/actions/log-intervention/index.js";
import * as logMeasurement from "../src/actions/log-measurement/index.js";
import * as query from "../src/actions/query/index.js";
import * as seedDemo from "../src/actions/seed-demo/index.js";
import { createTestDb } from "./sqlite.js";

let dataDir: string;
beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), "fh-act-"));
  process.env.FAMILY_HEALTH_DATA_DIR = dataDir;
});
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

let deps: AppActionRuntimeDeps;
beforeEach(() => {
  const { ctx } = createTestDb();
  deps = { appContext: { db: ctx } } as unknown as AppActionRuntimeDeps;
});

type Mod = { createAction: (c: ActionConfig, d: AppActionRuntimeDeps) => { execute: (args: Record<string, unknown>, ctx?: never) => Promise<ActionResult> } };

async function call(mod: Mod, args: Record<string, unknown> = {}): Promise<ActionResult> {
  const action = mod.createAction({ name: "t" } as ActionConfig, deps);
  return action.execute(args, {} as never);
}

function data(r: ActionResult): any {
  expect(r.status, JSON.stringify(r)).toBe("ok");
  return (r as { data: unknown }).data;
}

function errorOf(r: ActionResult): any {
  expect(r.status).toBe("error");
  return JSON.parse((r as { error: string }).error);
}

describe("chat actions", () => {
  beforeEach(async () => {
    data(await call(seedDemo as Mod));
  });

  it("lists members with relation and latest exam", async () => {
    const out = data(await call(listMembers as Mod));
    expect(out.members.map((m: any) => [m.relation, m.latest_exam_date])).toEqual([
      ["本人", "2026-06-15"],
      ["配偶", "2026-06-15"],
      ["父亲", "2026-04-14"],
      ["母亲", "2026-04-14"],
    ]);
  });

  it("logs an intervention for 我", async () => {
    const out = data(await call(logIntervention as Mod, { member: "我", title: "每天跑步5公里", start_date: "2026-09-14" }));
    expect(out.member.relation).toBe("本人");
    expect(out.intervention).toMatchObject({ category: "运动", startDate: "2026-09-14" });
  });

  it("returns structured candidates for an unknown member", async () => {
    const err = errorOf(await call(logIntervention as Mod, { member: "儿子", title: "跳绳" }));
    expect(err.code).toBe("member_not_found");
    expect(err.message).toContain("子女");
    expect(err.candidates.map((c: any) => c.relation)).toEqual(["本人", "配偶", "父亲", "母亲"]);
  });

  it("logs weight and blood pressure measurements", async () => {
    const w = data(await call(logMeasurement as Mod, { member: "老婆", indicator: "体重", value: 62.5, unit: "kg", date: "2026-09-23" }));
    expect(w.logged).toEqual([expect.objectContaining({ indicator: "体重", value: 62.5, unit: "kg", date: "2026-09-23" })]);
    const bp = data(await call(logMeasurement as Mod, { member: "爸爸", indicator: "血压", value: "135/85" }));
    expect(bp.logged.map((l: any) => l.indicator)).toEqual(["收缩压", "舒张压"]);
  });

  it("rejects an unknown indicator with suggestions", async () => {
    const err = errorOf(await call(logMeasurement as Mod, { member: "我", indicator: "快乐指数", value: 9 }));
    expect(err.code).toBe("indicator_not_found");
  });

  it("ends an intervention", async () => {
    const out = data(await call(endIntervention as Mod, { member: "我", title: "快走", end_date: "2026-09-20" }));
    expect(out.intervention).toMatchObject({ title: "每周3次快走", endDate: "2026-09-20" });
  });

  it("queries an indicator history", async () => {
    const out = data(await call(query as Mod, { member: "我爸", indicator: "尿酸" }));
    expect(out.indicator.history).toHaveLength(4);
    expect(out.indicator.note).toContain("时间上同时发生");
  });

  it("adds a member and rejects duplicates", async () => {
    const out = data(await call(addMember as Mod, { name: "张小明", relation: "儿子", sex: "男", birth_date: "2015-06-01" }));
    expect(out.member).toMatchObject({ relation: "子女", sex: "male", birthDate: "2015-06-01" });
    expect(errorOf(await call(addMember as Mod, { name: "张小明" })).code).toBe("duplicate_member");
  });

  it("clears demo data only", async () => {
    data(await call(addMember as Mod, { name: "真实成员", relation: "其他" }));
    const out = data(await call(seedDemo as Mod, { clear_only: true }));
    expect(out.cleared.members).toBe(4);
    expect(data(await call(listMembers as Mod)).members.map((m: any) => m.name)).toEqual(["真实成员"]);
  });
});
