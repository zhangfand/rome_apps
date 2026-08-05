import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { assertAppToken, assertReadAccess } from "./lib.js";

const token = v.optional(v.string());

export const list = query({
  args: { token, limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await assertReadAccess(ctx, args.token);
    return await ctx.db
      .query("imports")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 20, 1), 100));
  },
});

export const get = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    await assertReadAccess(ctx, args.token);
    const id = ctx.db.normalizeId("imports", args.id);
    if (!id) return null;
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: { token, url: v.string() },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const now = Date.now();
    const id = await ctx.db.insert("imports", {
      url: args.url,
      status: "pending",
      error: null,
      apartmentsFound: null,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    token,
    id: v.string(),
    patch: v.object({
      status: v.optional(v.string()),
      error: v.optional(v.union(v.string(), v.null())),
      apartmentsFound: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const id = ctx.db.normalizeId("imports", args.id);
    if (!id) return null;
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.patch(id, { ...args.patch, updatedAt: Date.now() });
    return await ctx.db.get(id);
  },
});
