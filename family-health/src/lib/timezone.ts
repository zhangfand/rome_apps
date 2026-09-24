/**
 * Resolve the guardian's timezone from Rome's `guardianTimezone` setting so
 * "today" and relative dates follow the user, not the daemon's UTC clock.
 */
import type { RomeAppContext } from "@rome-os/app-runtime";
import { setTimeZone } from "./dates.js";

let checkedAt = 0;
const TTL_MS = 10 * 60 * 1000;

export async function syncGuardianTimeZone(ctx: Pick<RomeAppContext, "repositories">): Promise<void> {
  if (Date.now() - checkedAt < TTL_MS) return;
  checkedAt = Date.now();
  let tz: string | null = null;
  try {
    const raw = await ctx.repositories?.settings?.get<unknown>("guardianTimezone");
    if (typeof raw === "string") tz = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
  } catch {
    tz = null;
  }
  setTimeZone(tz ?? process.env.TZ ?? null);
}
