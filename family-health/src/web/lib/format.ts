import type { Flag, NumericRange, ReportStatus, Trend } from "./types";

export const DISCLAIMER = "仅供参考，不能替代医生诊断";

export const SEX_ZH: Record<string, string> = { male: "男", female: "女" };

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** 2025年6月10日 */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${y}年${m}月${d}日`;
}

/** Epoch ms of a YYYY-MM-DD at local noon (stable for chart axes). */
export function dateToTs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12).getTime();
}

export function tsToIso(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return tsToIso(Date.now());
}

export function formatNumber(v: number | null | undefined, maxDecimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const f = 10 ** maxDecimals;
  return String(Math.round(v * f) / f);
}

export function formatValue(v: { value?: number | null; valueNum?: number | null; valueText?: string | null } | null | undefined): string {
  if (!v) return "—";
  const n = v.value ?? v.valueNum;
  if (n != null) return formatNumber(n);
  return v.valueText ?? "—";
}

export function formatRange(r: NumericRange | null | undefined): string {
  if (!r) return "";
  if (r.low != null && r.high != null) return `${formatNumber(r.low)}–${formatNumber(r.high)}`;
  if (r.high != null) return `${r.highInclusive === false ? "<" : "≤"}${formatNumber(r.high)}`;
  if (r.low != null) return `${r.lowInclusive === false ? ">" : "≥"}${formatNumber(r.low)}`;
  return "";
}

export const FLAG_LABEL: Record<Flag, string> = { H: "偏高", L: "偏低", abnormal: "异常", normal: "正常" };

type BadgeVariant = "default" | "info" | "success" | "warning" | "brand" | "destructive" | "muted" | "outline";

/** Badge variant for a flag, respecting direction (a high HDL is flagged but not a worry). */
export function flagVariant(flag: Flag | null | undefined, direction?: string | null): BadgeVariant {
  if (!flag || flag === "normal") return "muted";
  if (flag === "abnormal") return direction === "info" ? "muted" : "destructive";
  if (direction === "higher_worse") return flag === "H" ? "destructive" : "info";
  if (direction === "lower_worse") return flag === "L" ? "destructive" : "info";
  if (direction === "info") return "muted";
  return "warning";
}

export const STATUS_LABEL: Record<ReportStatus, string> = {
  uploaded: "已上传",
  extracting: "识别中",
  needs_review: "待审核",
  confirmed: "已确认",
  failed: "失败",
};

export function statusVariant(status: ReportStatus): BadgeVariant {
  switch (status) {
    case "confirmed":
      return "success";
    case "needs_review":
      return "warning";
    case "extracting":
      return "info";
    case "failed":
      return "destructive";
    default:
      return "muted";
  }
}

/** Text color class for a change, by direction semantics. */
export function trendClass(trend: Trend | null | undefined): string {
  if (trend === "better") return "text-success";
  if (trend === "worse") return "text-destructive";
  return "text-muted-foreground";
}

export const TREND_LABEL: Record<Trend, string> = { better: "好转", worse: "变差", flat: "持平", changed: "变化" };

export function formatDelta(delta: number | null | undefined): string {
  if (delta == null) return "";
  const s = formatNumber(Math.abs(delta));
  return delta > 0 ? `↑ ${s}` : delta < 0 ? `↓ ${s}` : "→ 0";
}

export function formatBytes(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export const CREATED_VIA_LABEL: Record<string, string> = { chat: "聊天", ui: "手动", demo: "演示" };
