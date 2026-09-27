/**
 * Re-map an unconfirmed report's rows to dictionary codes WITHOUT re-running
 * the vision extraction (the page images are not read again).
 *
 * - Rows a reviewer edited (`edited = true`) and manually added rows are left
 *   exactly as they are.
 * - Every other row gets the current deterministic mapping (collision guards
 *   included). When that finds nothing, a code previously chosen by the LLM
 *   mapper (confidence 0.75) is kept if it is still allowed; otherwise the
 *   name goes to one LLM mapper call for all still-unknown names.
 * - Rows whose code does not change are not written at all; rows whose code
 *   changes get value/unit/range/flag recomputed from their raw fields. The
 *   lab's printed ↑/↓ is preserved (stored, or inferred from the old flag).
 * - Never deletes or adds rows; running it twice changes nothing the second time.
 */
import { getIndicator } from "../domain/indicators.js";
import { contextAllows, mapIndicator } from "../domain/mapping.js";
import { normalizeRow } from "../domain/normalize.js";
import type { Sex } from "../domain/types.js";
import { isCompatibleUnit } from "../domain/units.js";
import type { FamilyHealthStore, ResultRow } from "../db/repositories/store.js";
import type { AgentCaller } from "./agent.js";
import { CONFIDENCE, MAPPER_AGENT, buildMapperPrompt, isStaleExtraction } from "./extraction.js";
import { parseMapperOutput, type MapperInput } from "./extraction-parse.js";
import { UserFacingError } from "./service.js";

export const MAPPER_CONFIDENCE = CONFIDENCE.forced;

export interface RemapOutcome {
  before: { mapped: number; unmapped: number };
  after: { mapped: number; unmapped: number };
  changed: Array<{ id: string; raw_name: string; from: string | null; to: string | null }>;
  preserved: number;
  mapperCalled: boolean;
}

const counts = (rows: Array<{ indicatorCode: string | null }>) => ({
  mapped: rows.filter((r) => r.indicatorCode).length,
  unmapped: rows.filter((r) => !r.indicatorCode).length,
});

function stillValid(code: string, row: ResultRow): boolean {
  const def = getIndicator(code);
  if (!def) return false;
  if (row.rawUnit && def.valueType === "numeric" && !isCompatibleUnit(row.rawUnit, def)) return false;
  return contextAllows(def, row.rawName, row.section);
}

export async function remapReport(
  reportId: string,
  deps: { store: FamilyHealthStore; callAgent?: AgentCaller; log?: { warn: (m: string, d?: Record<string, unknown>) => void } },
): Promise<RemapOutcome> {
  const { store } = deps;
  const report = store.getReport(reportId);
  if (!report) throw new UserFacingError("报告不存在", "report_not_found");
  if (report.status === "confirmed") throw new UserFacingError("报告已确认，不能重新匹配指标。需要修改请先“重新编辑”。", "report_confirmed");
  if (report.status === "extracting" && !isStaleExtraction(report)) throw new UserFacingError("正在识别中，请识别完成后再重新匹配。", "busy");
  const member = store.getMember(report.memberId);
  const sex: Sex | null = member?.sex === "male" || member?.sex === "female" ? member.sex : null;

  const rows = store.listReportResults(reportId);
  const before = counts(rows);
  const preserve = (r: ResultRow) => r.edited || r.source === "manual";

  // 1. deterministic mapping (+ keep earlier LLM-mapper choices that are still allowed)
  const next = new Map<string, { code: string | null; confidence: number | null }>();
  const unknown: MapperInput[] = [];
  for (const r of rows) {
    if (preserve(r)) continue;
    const hit = mapIndicator(r.rawName, { section: r.section, unit: r.rawUnit, value: r.rawValue });
    if (hit) {
      next.set(r.id, { code: hit.code, confidence: CONFIDENCE[hit.kind] ?? null });
    } else if (r.indicatorCode && r.confidence === MAPPER_CONFIDENCE && stillValid(r.indicatorCode, r)) {
      next.set(r.id, { code: r.indicatorCode, confidence: r.confidence });
    } else {
      next.set(r.id, { code: null, confidence: null });
      if (!unknown.some((u) => u.name === r.rawName)) unknown.push({ name: r.rawName, unit: r.rawUnit || null, section: r.section });
    }
  }

  // 2. one LLM mapper call for names still unknown
  let mapperCalled = false;
  if (unknown.length && deps.callAgent) {
    mapperCalled = true;
    const res = await deps.callAgent(MAPPER_AGENT, buildMapperPrompt(unknown));
    if (res.ok) {
      const mapping = parseMapperOutput(res.data, unknown);
      for (const r of rows) {
        const cur = next.get(r.id);
        if (!cur || cur.code) continue;
        const code = mapping.get(r.rawName);
        if (code && stillValid(code, r)) next.set(r.id, { code, confidence: MAPPER_CONFIDENCE });
      }
    } else {
      deps.log?.warn("remap mapper failed", { reportId, error: res.error });
    }
  }

  // 3. write only rows whose code changed
  const changed: RemapOutcome["changed"] = [];
  for (const r of rows) {
    const n = next.get(r.id);
    if (!n || n.code === r.indicatorCode) continue;
    let arrow = r.printedMarker ?? null;
    if (!arrow && (r.flag === "H" || r.flag === "L")) {
      // Old rows did not store a separate-column ↑/↓: if the old flag cannot be
      // reproduced without one, it was the lab's printed marker — keep it.
      const def = getIndicator(r.indicatorCode);
      const old = normalizeRow({ rawName: def ? r.rawName : "", rawValue: r.rawValue, rawUnit: r.rawUnit, refText: r.refText, section: r.section, indicatorCode: def?.code ?? null }, { sex });
      if (old.flag !== r.flag) arrow = r.flag;
    }
    const norm = normalizeRow(
      { rawName: n.code ? r.rawName : "", rawValue: r.rawValue, rawUnit: r.rawUnit, refText: r.refText, section: r.section, indicatorCode: n.code, arrow },
      { sex },
    );
    store.updateResult(r.id, {
      indicatorCode: n.code,
      valueNum: norm.valueNum,
      valueText: norm.valueText,
      unit: norm.unit,
      refLow: norm.refLow,
      refHigh: norm.refHigh,
      flag: norm.flag,
      confidence: n.confidence,
      printedMarker: arrow,
    });
    changed.push({ id: r.id, raw_name: r.rawName, from: r.indicatorCode, to: n.code });
  }

  return {
    before,
    after: counts(store.listReportResults(reportId)),
    changed,
    preserved: rows.filter(preserve).length,
    mapperCalled,
  };
}
