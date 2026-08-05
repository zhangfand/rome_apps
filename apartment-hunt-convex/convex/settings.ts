import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { assertAppToken, assertReadAccess } from "./lib.js";

const token = v.optional(v.string());

export const get = query({
  args: { token, key: v.string() },
  handler: async (ctx, args) => {
    await assertReadAccess(ctx, args.token);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return row?.value ?? null;
  },
});

export const set = mutation({
  args: { token, key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }
  },
});
