import { describe, expect, it } from "vitest";
import { FINDINGS, detectFindings, parseSeverity, severityLabel } from "./findings.js";
import { getIndicator } from "./indicators.js";
import { relationFromWord, resolveMember, type MemberRef } from "./members.js";
import { GOAL_PANELS, panelIndicators, sanitizeGoals } from "./panels.js";

const family: MemberRef[] = [
  { id: "m1", name: "张伟", relation: "本人", sex: "male" },
  { id: "m2", name: "李娜", relation: "配偶", sex: "female" },
  { id: "m3", name: "张建国", relation: "父亲", sex: "male" },
  { id: "m4", name: "王秀英", relation: "母亲", sex: "female" },
];

const found = (q: string, members = family) => {
  const r = resolveMember(q, members);
  return r.status === "found" ? r.member.id : r.status;
};

describe("member resolution", () => {
  it.each([
    ["我", "m1"], ["本人", "m1"], ["自己", "m1"], ["我自己", "m1"],
    ["老婆", "m2"], ["妻子", "m2"], ["媳妇", "m2"], ["老公", "m2"], ["爱人", "m2"], ["我老婆", "m2"], ["我的老婆", "m2"],
    ["爸", "m3"], ["爸爸", "m3"], ["我爸", "m3"], ["老爸", "m3"], ["父亲", "m3"],
    ["妈", "m4"], ["妈妈", "m4"], ["我妈", "m4"], ["咱妈", "m4"], ["母亲", "m4"],
    ["李娜", "m2"], ["m4", "m4"], ["建国", "m3"], ["  王秀英 ", "m4"],
  ])("%s → %s", (q, id) => {
    expect(found(q)).toBe(id);
  });

  it("reports missing relations with all candidates", () => {
    const r = resolveMember("儿子", family);
    expect(r.status).toBe("not_found");
    if (r.status === "not_found") expect(r.candidates).toHaveLength(4);
  });

  it("returns candidates instead of guessing between several children", () => {
    const withKids = [
      ...family,
      { id: "k1", name: "张小明", relation: "子女", sex: "male" as const },
      { id: "k2", name: "张小红", relation: "子女", sex: "female" as const },
    ];
    const r = resolveMember("孩子", withKids);
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") expect(r.candidates.map((c) => c.id)).toEqual(["k1", "k2"]);
    expect(found("儿子", withKids)).toBe("k1");
    expect(found("女儿", withKids)).toBe("k2");
    expect(found("小明", withKids)).toBe("k1");
  });

  it("treats duplicate names and fuzzy multi-hits as ambiguous", () => {
    const dup = [...family, { id: "m5", name: "李娜", relation: "其他" }];
    expect(resolveMember("李娜", dup).status).toBe("ambiguous");
    expect(resolveMember("张", family).status).toBe("not_found");
    const zhang = [...family, { id: "m6", name: "张伟民", relation: "其他" }];
    expect(resolveMember("伟", zhang).status).toBe("not_found");
  });

  it("handles empty input", () => {
    expect(resolveMember("", family).status).toBe("not_found");
    expect(resolveMember(undefined, family).status).toBe("not_found");
  });

  it("maps relation words", () => {
    expect(relationFromWord("我老妈")).toEqual({ relation: "母亲", sex: undefined });
    expect(relationFromWord("女儿")).toEqual({ relation: "子女", sex: "female" });
    expect(relationFromWord("同事")).toBeNull();
  });
});

describe("finding detection", () => {
  it("detects findings with grades", () => {
    const [f] = detectFindings("脂肪肝（中度）");
    expect(f).toMatchObject({ key: "fatty_liver", severity: { grade: 2, gradeText: "中度" } });
    expect(detectFindings("轻-中度脂肪肝")[0].severity.gradeText).toBe("轻中度");
  });

  it("skips negated statements", () => {
    expect(detectFindings("肝脏未见明显异常")).toEqual([]);
    expect(detectFindings("未见脂肪肝")).toEqual([]);
    expect(detectFindings("胆囊未见结石及息肉")).toEqual([]);
  });

  it("parses TI-RADS / BI-RADS and sizes", () => {
    const [t] = detectFindings("甲状腺右叶结节，TI-RADS 3类，大小约 8×6mm");
    expect(t).toMatchObject({ key: "thyroid_nodule", severity: { tirads: 3, sizeMm: 8 } });
    expect(parseSeverity("左乳结节 BI-RADS 4a类 1.2x0.8cm")).toMatchObject({ birads: 4, sizeMm: 12 });
    expect(severityLabel(parseSeverity("甲状腺结节 TI-RADS 3类 8mm"))).toBe("TI-RADS 3类 · 8mm");
  });

  it("detects several findings in one conclusion", () => {
    const keys = detectFindings("1. 双肾囊肿；2. 胆囊息肉 0.6cm；3. 窦性心动过缓").map((f) => f.key);
    expect(keys).toEqual(["renal_cyst", "gallbladder_polyp", "sinus_bradycardia"]);
    expect(detectFindings("右肺上叶磨玻璃结节 6mm")[0].key).toBe("lung_nodule");
    expect(detectFindings("颈动脉内中膜增厚伴斑块形成").map((f) => f.key)).toEqual(
      expect.arrayContaining(["carotid_plaque", "carotid_imt"]),
    );
  });

  it("has unique keys", () => {
    expect(new Set(FINDINGS.map((f) => f.key)).size).toBe(FINDINGS.length);
  });
});

describe("goal panels", () => {
  it("defines the four panels with known indicators and findings", () => {
    expect(GOAL_PANELS.map((p) => p.key)).toEqual(["weight_metabolic", "lipid_cardio", "liver", "senior"]);
    const findingKeys = new Set(FINDINGS.map((f) => f.key));
    for (const p of GOAL_PANELS) {
      for (const it of p.items) expect(getIndicator(it.code), `${p.key}:${it.code}`).toBeDefined();
      for (const f of p.findings) expect(findingKeys.has(f), `${p.key}:${f}`).toBe(true);
    }
  });

  it("includes computed metrics where the spec asks for them", () => {
    expect(panelIndicators("weight_metabolic").map((d) => d.code)).toContain("HOMA_IR");
    expect(panelIndicators("lipid_cardio").map((d) => d.code)).toContain("NON_HDL_C");
    expect(panelIndicators("senior").map((d) => d.code)).toContain("EGFR");
  });

  it("filters sex-specific tumor markers", () => {
    const male = panelIndicators("senior", "male").map((d) => d.code);
    const female = panelIndicators("senior", "female").map((d) => d.code);
    expect(male).toContain("TPSA");
    expect(male).not.toContain("CA125");
    expect(female).toEqual(expect.arrayContaining(["CA125", "CA153"]));
    expect(female).not.toContain("TPSA");
  });

  it("sanitizes goal input", () => {
    expect(sanitizeGoals(["liver", "bogus", "liver", 3])).toEqual(["liver"]);
    expect(sanitizeGoals("liver")).toEqual([]);
  });
});
