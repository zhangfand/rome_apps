/**
 * Date helpers. All dates are stored as local calendar dates `YYYY-MM-DD`.
 * `resolveDate` accepts ISO dates plus the handful of relative Chinese
 * phrases a chat agent might pass through verbatim (今天 / 昨天 / 上周 …).
 */
import { normalizeWidth } from "../domain/text.js";

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const CN_NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5 };

function parseCount(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  if (s in CN_NUM) return CN_NUM[s];
  const m = s.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + CN_NUM[m[1]];
  return null;
}

/**
 * Resolve a date expression to `YYYY-MM-DD`, or null when it cannot be
 * understood. Month/day without a year means the most recent such date that
 * is not in the future.
 */
export function resolveDate(input: string | null | undefined, now: Date = new Date()): string | null {
  if (input == null) return null;
  const s = normalizeWidth(String(input)).trim().replace(/\s+/g, "");
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[T\s].*)?$/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{4})[-/.年](\d{1,2})月?$/);
  if (m) return valid(Number(m[1]), Number(m[2]), 1);
  m = s.match(/^(\d{1,2})[-/.月](\d{1,2})[日号]?$/);
  if (m) {
    let y = now.getFullYear();
    let iso = valid(y, Number(m[1]), Number(m[2]));
    if (iso && iso > todayIso(now)) iso = valid(--y, Number(m[1]), Number(m[2]));
    return iso;
  }

  const rel: Record<string, number> = { 今天: 0, 今日: 0, 昨天: -1, 昨日: -1, 前天: -2, 大前天: -3, 上周: -7, 上星期: -7, 上个星期: -7, 上礼拜: -7 };
  if (s in rel) return toIsoDate(addDays(now, rel[s]));
  if (/^(上个?月)$/.test(s)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28));
    return toIsoDate(d);
  }
  if (/^去年$/.test(s)) return toIsoDate(new Date(now.getFullYear() - 1, now.getMonth(), Math.min(now.getDate(), 28)));

  m = s.match(/^(\d+|[一两二三四五六七八九十半]|十[一二三四五六七八九])(天|日|周|个?星期|个?礼拜|个?月|年)(前|之前|以前)$/);
  if (m) {
    const n = parseCount(m[1]);
    if (n == null) return null;
    const unit = m[2];
    if (unit === "天" || unit === "日") return toIsoDate(addDays(now, -Math.round(n)));
    if (/周|星期|礼拜/.test(unit)) return toIsoDate(addDays(now, -Math.round(n * 7)));
    if (/月/.test(unit)) return toIsoDate(addDays(now, -Math.round(n * 30)));
    return toIsoDate(addDays(now, -Math.round(n * 365)));
  }
  return null;
}

/** Normalize an exam date from a report (`2024年3月5日`, `2024/03/05`); rejects implausible dates. */
export function normalizeExamDate(input: string | null | undefined, now: Date = new Date()): string | null {
  const iso = resolveDate(input, now);
  if (!iso) return null;
  if (iso < "1990-01-01" || iso > todayIso(addDays(now, 1))) return null;
  return iso;
}

/** Whole days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}
