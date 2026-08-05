import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server.js";
import { assertAppToken } from "./lib.js";

const MIN_TTL_MS = 60_000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Mint a read-only browser session. Only callable with the server APP_TOKEN
 * (Rome's guardian-auth'd API is the sole caller); the browser never sees
 * APP_TOKEN itself.
 */
export const issue = mutation({
  args: { token: v.optional(v.string()), sessionToken: v.string(), ttlMs: v.number() },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const ttl = Math.min(Math.max(args.ttlMs, MIN_TTL_MS), MAX_TTL_MS);
    const expiresAt = Date.now() + ttl;
    await ctx.db.insert("sessions", { token: args.sessionToken, expiresAt });
    return { expiresAt };
  },
});

/** Delete expired sessions; run hourly by the cron in crons.ts. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(500);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
    return { deleted: expired.length };
  },
});
