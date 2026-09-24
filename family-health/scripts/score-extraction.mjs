#!/usr/bin/env node
/**
 * Score one extracted report against a synthetic ground-truth file
 * (see scripts/gen-synthetic-report.mjs). Reads the report through the live
 * app API (the same endpoint the review page uses) — nothing leaves the machine.
 *
 *   node scripts/score-extraction.mjs <reportId> <ground-truth.json> <variant: pdf|photo> [out.json]
 *
 * Env: FAMILY_HEALTH_API (default http://127.0.0.1:4141/api/apps/family-health)
 */
import { readFileSync, writeFileSync } from "node:fs";

const [reportId, gtPath, variant = "pdf", outPath] = process.argv.slice(2);
if (!reportId || !gtPath) {
  console.error("usage: score-extraction.mjs <reportId> <ground-truth.json> <pdf|photo> [out.json]");
  process.exit(2);
}
const API = process.env.FAMILY_HEALTH_API ?? "http://127.0.0.1:4141/api/apps/family-health";
const gt = JSON.parse(readFileSync(gtPath, "utf8"));
const v = gt.variants[variant];
const detail = await (await fetch(`${API}/reports/${encodeURIComponent(reportId)}`)).json();
if (!detail.report) throw new Error(`report not found: ${JSON.stringify(detail).slice(0, 200)}`);

const normUnit = (u) => String(u ?? "").replace(/µ/g, "μ").replace(/\s+/g, "").replace(/\^2/g, "²").toLowerCase();
const close = (a, b) => {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.005);
};

const extracted = detail.results.map((r) => ({ ...r, used: false }));
const rows = [];
for (const g of v.results) {
  const hit = extracted.find((e) => !e.used && e.indicatorCode === g.code);
  if (hit) hit.used = true;
  // For diagnosis: an unmatched GT row may exist under a different/missing code.
  const byName = hit ? null : extracted.find((e) => !e.used && e.rawName && g.printedName && (e.rawName.includes(g.printedName.split(/[ (（]/)[0]) || g.printedName.includes(e.rawName)));
  const checks = hit
    ? {
        code: true,
        value: g.valueNum != null ? close(hit.valueNum, g.valueNum) : String(hit.valueText ?? "").includes(g.valueText),
        unit: normUnit(hit.unit) === normUnit(g.unit),
        ref: close(hit.refLow, g.refLow) && close(hit.refHigh, g.refHigh),
        flag: hit.flag === g.flag,
        page: hit.page === g.page,
      }
    : { code: false, value: false, unit: false, ref: false, flag: false, page: false };
  rows.push({ g, hit, byName, checks, ok: Object.values(checks).every(Boolean) });
}
const extras = extracted.filter((e) => !e.used);

// ---- findings
const findingRows = [];
const usedF = new Set();
for (const g of v.findings) {
  const hit = detail.findings.find((f) => !usedF.has(f.id) && f.findingKey === g.key);
  if (hit) usedF.add(hit.id);
  const sevOk = hit ? new RegExp(g.severityMatch).test(`${hit.severity ?? ""}`) : false;
  findingRows.push({ g, hit, sevOk, ok: !!hit && sevOk });
}
const extraFindings = detail.findings.filter((f) => !usedF.has(f.id));
const keyedExtra = extraFindings.filter((f) => f.findingKey);
// A duplicate of an expected key (e.g. repeated in 总检) is harmless noise, not a wrong finding.
const dupExtra = keyedExtra.filter((f) => v.findings.some((g) => g.key === f.findingKey));

// ---- skipped pages
const onSkipped = [
  ...detail.results.filter((r) => v.skippedPages.includes(r.page)).map((r) => `result p${r.page}: ${r.rawName}=${r.rawValue}`),
  ...detail.findings.filter((f) => v.skippedPages.includes(f.page)).map((f) => `finding p${f.page}: ${f.rawText}`),
];
const markedSkipped = (detail.report.pages ?? []).filter((p) => p.skipped).map((p) => p.page);

// ---- metrics
const fieldNames = ["code", "value", "unit", "ref", "flag", "page"];
const fieldAcc = Object.fromEntries(fieldNames.map((f) => [f, rows.filter((r) => r.checks[f]).length / rows.length]));
const correct = rows.filter((r) => r.ok).length;
const mapped = rows.filter((r) => r.hit).length;
const metrics = {
  report: { id: reportId, status: detail.report.status, pages: detail.report.pagesTotal, error: detail.report.error },
  examDate: { expected: gt.examDate, got: detail.report.examDate, ok: detail.report.examDate === gt.examDate },
  provider: { expected: gt.provider, got: detail.report.provider, ok: String(detail.report.provider ?? "").includes(gt.provider.slice(0, 4)) },
  rows: {
    groundTruth: v.results.length,
    extracted: detail.results.length,
    fullyCorrect: correct,
    precision: +(correct / Math.max(1, detail.results.length)).toFixed(4),
    recall: +(correct / v.results.length).toFixed(4),
    mappingPrecision: +(mapped / Math.max(1, detail.results.length)).toFixed(4),
    mappingRecall: +(mapped / v.results.length).toFixed(4),
    fieldAccuracy: Object.fromEntries(Object.entries(fieldAcc).map(([k, x]) => [k, +x.toFixed(4)])),
    extraRows: extras.length,
  },
  findings: {
    groundTruth: v.findings.length,
    matched: findingRows.filter((f) => f.hit).length,
    severityOk: findingRows.filter((f) => f.ok).length,
    extraKeyed: keyedExtra.length - dupExtra.length,
    duplicateKeyed: dupExtra.length,
    unkeyed: extraFindings.filter((f) => !f.findingKey).length,
    precision: +(findingRows.filter((f) => f.ok).length / Math.max(1, findingRows.filter((f) => f.hit).length + keyedExtra.length - dupExtra.length)).toFixed(4),
    recall: +(findingRows.filter((f) => f.ok).length / Math.max(1, v.findings.length)).toFixed(4),
  },
  skipped: { expected: v.skippedPages, itemsOnSkippedPages: onSkipped, markedSkipped },
};

// ---- print
const fmt = (x) => (x == null ? "∅" : typeof x === "number" ? String(+x.toFixed(3)) : String(x));
console.log(`\n## ${variant} — report ${reportId}`);
console.log(`exam_date ${metrics.examDate.ok ? "✓" : "✗"} (${fmt(metrics.examDate.got)} vs ${gt.examDate}); provider ${metrics.provider.ok ? "✓" : "✗"} (${fmt(metrics.provider.got)})`);
console.log(`rows: ${correct}/${v.results.length} fully correct; extracted ${detail.results.length}; precision ${metrics.rows.precision}, recall ${metrics.rows.recall}`);
console.log(`field accuracy: ${fieldNames.map((f) => `${f} ${(fieldAcc[f] * 100).toFixed(1)}%`).join(", ")}`);
const bad = rows.filter((r) => !r.ok);
if (bad.length) {
  console.log("\n| GT item | expected | got | wrong fields |");
  console.log("|---|---|---|---|");
  for (const r of bad) {
    const exp = `${r.g.code} ${fmt(r.g.valueNum ?? r.g.valueText)} ${r.g.unit} [${fmt(r.g.refLow)},${fmt(r.g.refHigh)}] ${r.g.flag} p${r.g.page}`;
    const h = r.hit ?? r.byName;
    const got = h ? `${fmt(h.indicatorCode)} ${fmt(h.valueNum ?? h.valueText)} ${h.unit} [${fmt(h.refLow)},${fmt(h.refHigh)}] ${h.flag} p${h.page} (raw “${h.rawName}” “${h.rawValue}” ${h.rawUnit} “${h.refText ?? ""}”)` : "— not found —";
    const wrong = r.hit ? fieldNames.filter((f) => !r.checks[f]).join(",") : r.byName ? "code (mapped wrong/unmapped)" : "missing";
    console.log(`| ${r.g.printedName} | ${exp} | ${got} | ${wrong} |`);
  }
}
if (extras.length) {
  console.log("\nExtra extracted rows (not in ground truth):");
  for (const e of extras) console.log(`  - p${e.page} ${fmt(e.indicatorCode)} “${e.rawName}” = “${e.rawValue}” ${e.rawUnit}`);
}
console.log(`\nfindings: ${metrics.findings.severityOk}/${v.findings.length} correct (key+severity); extra keyed ${metrics.findings.extraKeyed}, duplicate ${metrics.findings.duplicateKeyed}, unkeyed ${metrics.findings.unkeyed}`);
for (const f of findingRows) console.log(`  ${f.ok ? "✓" : "✗"} ${f.g.key} expected “${f.g.severity}” got ${f.hit ? `“${f.hit.severity ?? "∅"}” (${f.hit.rawText})` : "— missing —"}`);
for (const f of extraFindings) console.log(`  + extra: ${fmt(f.findingKey)} “${f.severity ?? ""}” ${f.rawText} (p${f.page})`);
console.log(`skipped pages: expected ${JSON.stringify(v.skippedPages)}, items on them: ${onSkipped.length}${onSkipped.length ? " → " + onSkipped.join("; ") : ""}${markedSkipped.length ? `; marked skipped ${JSON.stringify(markedSkipped)}` : ""}`);
console.log("\nSUMMARY " + JSON.stringify(metrics));
if (outPath) writeFileSync(outPath, JSON.stringify({ metrics, mismatches: bad.map((r) => ({ gt: r.g, got: r.hit ?? r.byName ?? null })), extras, findings: detail.findings }, null, 2));
