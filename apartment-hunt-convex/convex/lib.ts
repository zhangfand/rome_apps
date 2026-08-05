/**
 * Shared guard for all public functions.
 *
 * Convex Cloud functions are publicly callable by anyone who knows the
 * deployment URL. The Rome app authenticates with a shared secret stored as
 * the `APP_TOKEN` env var on the Convex deployment (`npx convex env set
 * APP_TOKEN <value>`). When `APP_TOKEN` is unset (fresh dev deployment) the
 * guard is a no-op so local iteration stays frictionless.
 */
import type { QueryCtx } from "./_generated/server.js";

// The Convex runtime provides process.env; avoid needing @types/node here.
declare const process: { env: Record<string, string | undefined> };

export function assertAppToken(token: string | undefined | null): void {
  const expected = process.env.APP_TOKEN;
  if (!expected) return; // dev mode — no token configured yet
  if (token !== expected) {
    throw new Error("unauthorized: bad or missing app token");
  }
}

/**
 * Read guard: accepts either the server APP_TOKEN or a valid (unexpired)
 * browser read session minted by `sessions:issue`. Used by queries only —
 * mutations always require the APP_TOKEN.
 */
export async function assertReadAccess(
  ctx: QueryCtx,
  token: string | undefined | null,
): Promise<void> {
  const expected = process.env.APP_TOKEN;
  if (!expected) return; // dev mode — no token configured yet
  if (token === expected) return;
  if (token) {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session && session.expiresAt > Date.now()) return;
  }
  throw new Error("unauthorized: bad, missing, or expired read token");
}
