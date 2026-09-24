function timeZone(): string | undefined {
  return process.env.ROME_CHROME_TIMEZONE?.trim() || process.env.TZ?.trim() || undefined;
}

function parts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** `2026-09-23` in the guardian's timezone. */
export function localDate(date = new Date()): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `2026-09-23 14:05` in the guardian's timezone. */
export function localStamp(date = new Date()): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
