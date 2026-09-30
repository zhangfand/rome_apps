#!/usr/bin/env node
/**
 * One-shot importer: research JSON (verified extracts, see BRIEF.md in the
 * research folder) -> src/data/verified.ts. It only COPIES numbers, units,
 * locators and verbatim quotes; every editorial choice (which codes, which
 * source ids, unit aliases) is listed in the config below so a reviewer can
 * audit it. Re-run after new research:  node scripts/import-research.mjs <dir>
 */
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "/home/rome/.rome/default/projects/default/family-health-research";
const out = new URL("../src/data/verified.ts", import.meta.url);
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

const FILES = {
  "r1a_wst404_liver_protein_bili.json": "2026-09-26",
  "r1b_wst404_electrolyte_kidney_mineral.json": "2026-09-26",
  "r1c_wst405_blood_cells.json": "2026-09-26",
  "r2a_cn_thresholds_body_glucose_ua.json": "2026-09-24",
  "r2b_cn_thresholds_bp_pwv_abi.json": "2026-09-24",
  "r6_new_items_cn.json": "2026-09-24",
  "r7_cn_lipid_guideline_2023.json": "2026-09-26",
};

/** Same source under two research ids -> one id. */
const SOURCE_ALIAS = {
  src_cn_lead_2012: "src_cn_elderly_extremity_as_2012",
  src_ws_404_7_2015: "src_wst404_7_2015",
  src_ws_404_8_2015: "src_wst404_8_2015",
};

/**
 * Corrections to the research's own labels, with the reason:
 * src_cra_gout_2023 was marked "primary" but its notes say the text came from
 * a third-party mirror of the journal PDF and the official page was not opened.
 */
const VERIFIED_VIA_OVERRIDE = { src_cra_gout_2023: "secondary" };

/** Reference-interval items imported as `ranges` (research code -> app code). */
const RANGE_CODES = {
  ALT: "ALT", AST: "AST", ALP: "ALP", GGT: "GGT", TP: "TP", ALB: "ALB", GLB: "GLB", AG_RATIO: "AG_RATIO", TBIL: "TBIL", DBIL: "DBIL",
  K: "K", NA: "NA", CL: "CL", UREA: "UREA", CREA: "CREA", CA: "CA", MG: "MG", P: "P",
  WBC: "WBC", NEUT: "NEUT", NEUT_PCT: "NEUT_PCT", LYMPH: "LYMPH", LYMPH_PCT: "LYMPH_PCT", MONO: "MONO", MONO_PCT: "MONO_PCT",
  EO: "EO", EO_PCT: "EO_PCT", BASO: "BASO", BASO_PCT: "BASO_PCT", RBC: "RBC", HGB: "HGB", HCT: "HCT", MCV: "MCV", MCH: "MCH", MCHC: "MCHC", PLT: "PLT",
  APOA1: "APOA1", APOB: "APOB",
  // r6 (new items): only rows with kind "reference"
  CK: "CK", AMY: "AMY", ECHO_AO: "ECHO_AO", ECHO_LA: "ECHO_LA", ECHO_LVDD: "ECHO_LVDD", ECHO_LVDS: "ECHO_LVDS", ECHO_IVS: "ECHO_IVS", ECHO_LVPW: "ECHO_LVPW", ECHO_LVEF: "ECHO_LVEF",
};
/**
 * Deliberately NOT imported as ranges (reason recorded in SOURCES/UI via notes):
 * ABI_* 1.00–1.40 (老年人专家建议, imported as a condition-specific threshold instead),
 * VA_* ≥5.0 (5分记录; reports may use decimal notation), HP_C13 ≥4.0 (secondary, kit-dependent 2~6).
 */

/** Printed unit -> the app's unit spelling (same unit, different typography). */
const UNIT_ALIAS = { "×10^9/L": "10^9/L", "×10^12/L": "10^12/L", "ratio": "" };
const unitFor = (code, u) => {
  if (code === "AG_RATIO") return "";
  return UNIT_ALIAS[u] ?? u;
};


/**
 * Decision thresholds imported from research (research id -> options).
 * condition: restricted to people with a diagnosis the app does not track ->
 *            never applied automatically, listed in 指标库 only.
 * complement: add the category that the source implies but does not name
 *            (e.g. HbA1c < 6.5 = 未达诊断切点), labelled as such.
 * disjoint:  the source lists nested categories (理想 <2.6 inside 合适 <3.4);
 *            the importer turns them into adjacent bands so one value falls
 *            in exactly one band.
 * Skipped on purpose: bp_drug_initiation_cn (treatment decision, not a
 * classification), bp_office_primary_care_cn (same cut-points as the 2024
 * guideline, diagnostic procedure), thr_nonhdlc_targets_by_risk (numbers are
 * LDL-C target + 0.8 computed by the researcher, not printed in the guideline).
 */
const THRESHOLDS = {
  bmi_cn: {},
  bmi_obesity_grade_cn: {},
  waist_cn_male: {},
  waist_cn_female: {},
  whr_cn_male: {},
  whr_cn_female: {},
  glu_fpg_cn: {},
  glu_2h_cn: {},
  glu_random_cn: { condition: "有典型糖尿病症状时" },
  hba1c_dx_cn: { complement: { label_zh: "未达糖尿病诊断切点", severity: "normal", below: true } },
  ua_hua_cn_cra2023: {},
  ua_hua_cn: {},
  ua_target_ahu_cn: { kind: "target", condition: "无症状高尿酸血症、已在降尿酸治疗" },
  ua_target_gout_cn: { kind: "target", condition: "痛风患者" },
  bp_office_cn: { bp: true, drop: ["高血压", "单纯收缩期高血压", "单纯舒张期高血压"] },
  bp_home_cn: { bp: true, condition: "家庭自测血压（连续5~7天规范测量的平均值）" },
  bp_abpm_24h_cn: { bp: true, condition: "24小时动态血压平均值" },
  bp_abpm_day_cn: { bp: true, condition: "动态血压白天平均值" },
  bp_abpm_night_cn: { bp: true, condition: "动态血压夜间平均值" },
  abi_pad_htn2024: {},
  abi_tod_htn2024: { condition: "高血压患者" },
  abi_consensus2025: { condition: "高血压患者" },
  abi_elderly_2012: { condition: "老年人（专家建议的适用对象）" },
  bapwv_tod_htn2024: { condition: "高血压患者" },
  bapwv_tod_consensus2025: { condition: "高血压患者" },
  hr_resting_risk_htn2024: { condition: "高血压患者" },
  thr_tc_primary_low_risk: { locatorNote: "原文为表格，下方原文按行压平，列依次为 TC、LDL-C、HDL-C、TG、非HDL-C、Lp(a)" },
  thr_ldlc_primary_low_risk: { disjoint: true, locatorNote: "原文为表格，下方原文按行压平，列依次为 TC、LDL-C、HDL-C、TG、非HDL-C、Lp(a)" },
  thr_hdlc_primary_low_risk: { locatorNote: "原文为表格，下方原文按行压平，列依次为 TC、LDL-C、HDL-C、TG、非HDL-C、Lp(a)", complement: { label_zh: "未降低（未达“降低”切点）", severity: "normal", below: false } },
  thr_tg_primary_low_risk: { locatorNote: "原文为表格，下方原文按行压平，列依次为 TC、LDL-C、HDL-C、TG、非HDL-C、Lp(a)" },
  thr_tg_severe_pancreatitis: {},
  thr_nonhdlc_primary_low_risk: { disjoint: true, locatorNote: "原文为表格，下方原文按行压平，列依次为 TC、LDL-C、HDL-C、TG、非HDL-C、Lp(a)" },
  thr_lpa_cutpoint: {},
  thr_ldlc_targets_by_risk: { kind: "target", condition: "需由医生评估的 ASCVD 风险等级" },
};
const SEVERITY = { normal: "normal", borderline: "mild", low: "mild", high: "moderate", very_high: "severe", critical: "severe" };
const incl = (lowInc, highInc) => `${lowInc === false ? "(" : "["}${highInc === true ? "]" : ")"}`;
const bnd = (b) => (b ? { ...(b.low != null ? { low: b.low } : {}), ...(b.high != null ? { high: b.high } : {}), inclusivity: incl(b.lowInclusive, b.highInclusive) } : undefined);
function thrPopulation(p, condition) {
  const out = {};
  if (p?.sex === "male" || p?.sex === "female") out.sex = p.sex;
  const a = String(p?.age ?? "");
  if (/^(≥\s*18|18岁(及)?以上)/.test(a)) out.age = { min: 18 };
  const ageText = /^adults?$/i.test(a) ? "成年人" : a;
  const notes = [ageText && !out.age && !/^any$/i.test(ageText) ? ageText : null, p?.note].filter(Boolean);
  if (notes.length) out.note = notes.join("；");
  if (condition) out.condition = condition;
  return out;
}
function convertThreshold(t, opt, sourcesMap) {
  const sid = SOURCE_ALIAS[t.source_id] ?? t.source_id;
  let cats = t.categories.filter((c) => !(opt.drop ?? []).includes(c.label_zh));
  if (opt.bp) {
    cats = cats.map((c) => ({
      label_zh: c.label_zh,
      bounds: Object.fromEntries([["SBP", bnd(c.sbp)], ["DBP", bnd(c.dbp)]].filter(([, v]) => v)),
      severity: SEVERITY[c.severity] ?? "info",
    }));
  } else {
    cats = cats.map((c) => ({
      label_zh: c.label_zh,
      ...(c.low != null ? { low: c.low } : {}),
      ...(c.high != null ? { high: c.high } : {}),
      inclusivity: incl(c.lowInclusive, c.highInclusive),
      severity: SEVERITY[c.severity] ?? "info",
    }));
    if (opt.disjoint) {
      for (let i = 1; i < cats.length; i++) {
        const prev = cats[i - 1];
        if (cats[i].low == null && prev.high != null && cats[i].high != null && prev.high < cats[i].high) {
          cats[i] = { ...cats[i], low: prev.high, inclusivity: `[${cats[i].inclusivity[1]}`, note_zh: `原文为“${cats[i].label_zh} <${cats[i].high}”，其中 <${prev.high} 属于“${prev.label_zh}”` };
        }
      }
    }
    if (opt.complement) {
      const c0 = cats[0];
      const comp = opt.complement.below
        ? { label_zh: opt.complement.label_zh, high: c0.low, inclusivity: c0.inclusivity[0] === "[" ? "[)" : "[]", severity: opt.complement.severity }
        : { label_zh: opt.complement.label_zh, low: c0.high, inclusivity: c0.inclusivity[1] === ")" ? "[)" : "()", severity: opt.complement.severity };
      comp.note_zh = "原文只给出异常切点，此类为切点以外的范围";
      cats = opt.complement.below ? [comp, ...cats] : [comp, ...cats];
    }
  }
  const unit = UNIT_ALIAS[t.unit] ?? t.unit;
  return {
    id: t.id,
    indicatorCodes: t.indicator_codes,
    name_zh: t.name_zh,
    kind: opt.kind ?? t.kind ?? "category",
    unit: unit === "次/min" ? "次/分" : unit,
    population: thrPopulation(t.population, opt.condition),
    categories: cats,
    sourceId: sid,
    ...(t.locator ? { locator: t.locator + (opt.locatorNote ? `（${opt.locatorNote}）` : "") } : {}),
    level: sourcesMap.get(sid)?.level,
    ...(t.evidence_quote ? { evidenceQuote: t.evidence_quote } : {}),
  };
}

function age(a) {
  if (!a || typeof a !== "string") return undefined;
  const m = a.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  return undefined; // "adult (…)" etc: no numeric age bound stated
}
function population(p) {
  const out = {};
  if (p?.sex === "male" || p?.sex === "female") out.sex = p.sex;
  const ag = age(p?.age);
  if (ag) out.age = ag;
  else if (p?.age && !/^any$/i.test(p.age)) out.note = String(p.age).replace(/^adult\s*/i, "成年人 ").trim();
  return out;
}

const sources = new Map();
const ranges = {};
const unverified = [];
const thresholds = [];
for (const [f, retrieved] of Object.entries(FILES)) {
  const j = load(f);
  for (const s of j.sources ?? []) {
    const id = SOURCE_ALIAS[s.id] ?? s.id;
    if (sources.has(id)) continue;
    sources.set(id, {
      id,
      org: s.org,
      title: s.title,
      identifier: s.identifier ?? s.citation ?? s.title,
      ...(s.url ? { url: s.url } : {}),
      level: s.level,
      verifiedVia: VERIFIED_VIA_OVERRIDE[id] ?? s.verified_via ?? s.verifiedVia,
      retrieved: j.retrieved && /^\d{4}-\d{2}-\d{2}$/.test(j.retrieved) ? j.retrieved : retrieved,
      ...(s.status ? { status: s.status } : {}),
      ...(s.notes ? { notes: s.notes } : {}),
      research: f,
    });
  }
  for (const it of j.items ?? []) {
    const rc = it.code ?? it.proposed_code;
    const code = RANGE_CODES[rc];
    if (!code) continue;
    for (const [i, r] of (it.ranges ?? []).entries()) {
      if (r.kind && r.kind !== "reference") continue;
      if (r.low == null && r.high == null) continue;
      const sid = SOURCE_ALIAS[r.source_id] ?? r.source_id;
      (ranges[code] ??= []).push({
        id: `${sid.replace(/^src_/, "")}-${(ranges[code]?.length ?? 0) + 1}`,
        kind: "reference",
        level: sources.get(sid)?.level,
        population: population(r.population),
        ...(r.low != null ? { low: r.low } : {}),
        ...(r.high != null ? { high: r.high } : {}),
        ...(r.low != null ? { lowInclusive: r.lowInclusive !== false } : {}),
        ...(r.high != null ? { highInclusive: r.highInclusive !== false } : {}),
        unit: unitFor(code, r.unit),
        sourceId: sid,
        ...(r.locator ? { locator: r.locator } : {}),
        ...(r.conditions ? { conditions: r.conditions } : {}),
        ...(r.evidence_quote ? { evidenceQuote: r.evidence_quote } : {}),
      });
    }
  }
  for (const t of j.thresholds ?? []) {
    const opt = THRESHOLDS[t.id];
    if (opt) thresholds.push(convertThreshold(t, opt, sources));
  }
  for (const u of j.unverified ?? []) unverified.push({ research: f, what: u.what, tried: u.tried });
}

const header = `/**
 * GENERATED by scripts/import-research.mjs from verified research extracts
 * (JSON with verbatim evidence quotes; research folder BRIEF.md). Do not edit
 * numbers by hand: fix the research JSON and re-run the importer.
 *
 * VERIFIED_SOURCES   every source cited by a verified range or threshold
 * VERIFIED_RANGES    reference-interval candidates by indicator code
 * VERIFIED_THRESHOLDS decision thresholds (categories / targets)
 * RESEARCH_GAPS      what the research could not verify (shown in 指标库)
 */
import type { RangeCandidateInput, Source, ThresholdInput } from "./schema.js";
`;
const missing = Object.keys(THRESHOLDS).filter((id) => !thresholds.some((t) => t.id === id));
if (missing.length) throw new Error(`thresholds not found in research: ${missing.join(", ")}`);
const used = new Set([...Object.values(ranges).flat().map((r) => r.sourceId), ...thresholds.map((t) => t.sourceId)]);
const usedSources = [...sources.values()].filter((s) => used.has(s.id)).map(({ research, ...s }) => ({ ...s, scope: [...new Set([
  ...(Object.values(ranges).flat().some((r) => r.sourceId === s.id) ? ["reference_range"] : []),
  ...(thresholds.some((t) => t.sourceId === s.id) ? ["decision_threshold"] : []),
])] }));
const body =
  header +
  `\nexport const VERIFIED_SOURCES: Source[] = ${JSON.stringify(usedSources, null, 2)};\n` +
  `\nexport const VERIFIED_RANGES: Record<string, RangeCandidateInput[]> = ${JSON.stringify(ranges, null, 2)};\n` +
  `\nexport const VERIFIED_THRESHOLDS: ThresholdInput[] = ${JSON.stringify(thresholds, null, 2)};\n` +
  `\nexport const RESEARCH_GAPS: Array<{ research: string; what: string; tried: string }> = ${JSON.stringify(unverified, null, 2)};\n`;
fs.writeFileSync(out, body);
console.log(`thresholds ${thresholds.length}, used sources ${usedSources.length}/${sources.size}, range codes ${Object.keys(ranges).length}, ranges ${Object.values(ranges).flat().length}, gaps ${unverified.length}`);
