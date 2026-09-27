/**
 * Read-time provenance for stored rows: rebuild the verdict (which range
 * decided, from which source, lab vs standard) for a result row or a home
 * measurement, plus the decision-threshold categories for its value.
 */
import { getIndicator } from "../domain/indicators.js";
import { normalizeRow } from "../domain/normalize.js";
import type { Source } from "../data/schema.js";
import { LOINC_ATTRIBUTION } from "../data/sources.js";
import { getSource, verdict, type PersonCtx, type ReportContext, type Verdict } from "../domain/provenance.js";
import { categorize, type Categorisation } from "../domain/thresholds.js";
import { normalizeUnit } from "../domain/units.js";
import { parseResultValue } from "../domain/values.js";

export interface RowForVerdict {
  rawName: string;
  rawValue: string;
  rawUnit: string;
  refText: string | null;
  section?: string | null;
  indicatorCode: string | null;
  flag: string | null;
  printedMarker?: string | null;
  page?: number | null;
}

export interface Provenance extends Verdict {
  thresholds: Categorisation;
  /** LOINC code of the indicator (only when verified) and the required attribution text. */
  loinc: { code: string; longName: string; zhName?: string; source: Source | null } | null;
  loincAttribution: string | null;
}

function loincOf(code: string | null | undefined): Pick<Provenance, "loinc" | "loincAttribution"> {
  const def = getIndicator(code);
  if (!def?.loinc) return { loinc: null, loincAttribution: null };
  return { loinc: { ...def.loinc, source: getSource(def.loinc.sourceId) ?? null }, loincAttribution: LOINC_ATTRIBUTION };
}

/**
 * Verdict for a stored result row. Rows extracted before the printed marker
 * was stored may have lost a separate-column ↑/↓: when the stored flag is H/L
 * but the recomputed one differs, the stored flag is taken as that marker.
 */
export function resultVerdict(
  row: RowForVerdict,
  who: PersonCtx,
  report: Omit<ReportContext, "page"> | null,
  siblings: Record<string, number> = {},
): Provenance {
  const def = getIndicator(row.indicatorCode);
  const build = (arrow: string | null) =>
    normalizeRow(
      // An unmapped row stays unmapped: blank name so nothing is re-mapped here.
      { rawName: def ? row.rawName : "", rawValue: row.rawValue, rawUnit: row.rawUnit, refText: row.refText, section: row.section, indicatorCode: def?.code ?? null, arrow },
      { sex: who.sex ?? null },
    );
  let arrow = row.printedMarker ?? null;
  let norm = build(arrow);
  if (!arrow && (row.flag === "H" || row.flag === "L") && norm.flag !== row.flag) {
    arrow = row.flag;
    norm = build(arrow);
  }
  const v = verdict({
    value: norm.parsed,
    valueNum: norm.valueNum,
    unit: norm.unit,
    reportRange: norm.reportRange,
    reportRangeText: norm.refText,
    rawUnit: row.rawUnit,
    def,
    who,
    report: report ? { ...report, page: row.page ?? null } : null,
  });
  const canCategorize = !!def && norm.valueNum != null && normalizeUnit(norm.unit) === normalizeUnit(def.unit);
  return {
    ...v,
    thresholds: canCategorize ? categorize(def!.code, norm.valueNum, who, { siblings }) : { primary: null, alternatives: [], targets: [] },
    ...loincOf(def?.code),
  };
}

/** Verdict for a home measurement (canonical value, no printed range). */
export function measurementVerdict(code: string, value: number, who: PersonCtx, siblings: Record<string, number> = {}): Provenance {
  const def = getIndicator(code);
  const v = verdict({
    value: parseResultValue(value),
    valueNum: value,
    unit: def?.unit ?? "",
    reportRange: null,
    reportRangeText: null,
    def,
    who,
    report: null,
  });
  return { ...v, thresholds: def ? categorize(code, value, who, { siblings }) : { primary: null, alternatives: [], targets: [] }, ...loincOf(code) };
}

/** Numeric canonical values of a set of rows, for combined thresholds (BP) and siblings. */
export function siblingValues(rows: Array<{ indicatorCode: string | null; valueNum: number | null; unit: string }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const def = getIndicator(r.indicatorCode);
    if (!def || r.valueNum == null || normalizeUnit(r.unit) !== normalizeUnit(def.unit)) continue;
    if (!(def.code in out)) out[def.code] = r.valueNum;
  }
  return out;
}
