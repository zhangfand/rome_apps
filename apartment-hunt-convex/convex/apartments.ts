import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { assertAppToken, assertReadAccess } from "./lib.js";

const token = v.optional(v.string());

/** Patchable fields (everything except id/createdAt; updatedAt is managed here). */
const patchFields = {
  name: v.optional(v.string()),
  address: v.optional(v.union(v.string(), v.null())),
  locationHint: v.optional(v.union(v.string(), v.null())),
  area: v.optional(v.union(v.string(), v.null())),
  mapsUrl: v.optional(v.union(v.string(), v.null())),
  latitude: v.optional(v.union(v.number(), v.null())),
  longitude: v.optional(v.union(v.number(), v.null())),
  googleRating: v.optional(v.union(v.number(), v.null())),
  apartmentRatingsUrl: v.optional(v.union(v.string(), v.null())),
  apartmentRatingsScore: v.optional(v.union(v.number(), v.null())),
  apartmentRatingsReviewCount: v.optional(v.union(v.number(), v.null())),
  rentSummary: v.optional(v.union(v.string(), v.null())),
  promoSummary: v.optional(v.union(v.string(), v.null())),
  yearBuilt: v.optional(v.union(v.number(), v.null())),
  yearRenovated: v.optional(v.union(v.number(), v.null())),
  phone: v.optional(v.union(v.string(), v.null())),
  email: v.optional(v.union(v.string(), v.null())),
  website: v.optional(v.union(v.string(), v.null())),
  researchNotes: v.optional(v.union(v.string(), v.null())),
  status: v.optional(v.string()),
  notes: v.optional(v.union(v.string(), v.null())),
  researchStatus: v.optional(v.string()),
  researchError: v.optional(v.union(v.string(), v.null())),
  researchAttempts: v.optional(v.number()),
  researchStartedAt: v.optional(v.union(v.number(), v.null())),
  importId: v.optional(v.union(v.string(), v.null())),
};

export const list = query({
  args: { token },
  handler: async (ctx, args) => {
    await assertReadAccess(ctx, args.token);
    return await ctx.db.query("apartments").withIndex("by_createdAt").order("desc").collect();
  },
});

export const get = query({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    await assertReadAccess(ctx, args.token);
    const id = ctx.db.normalizeId("apartments", args.id);
    if (!id) return null;
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: {
    token,
    name: v.string(),
    address: v.optional(v.union(v.string(), v.null())),
    locationHint: v.optional(v.union(v.string(), v.null())),
    importId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const now = Date.now();
    const id = await ctx.db.insert("apartments", {
      name: args.name.trim(),
      address: args.address?.trim() || null,
      locationHint: args.locationHint?.trim() || null,
      area: null,
      mapsUrl: null,
      latitude: null,
      longitude: null,
      googleRating: null,
      apartmentRatingsUrl: null,
      apartmentRatingsScore: null,
      apartmentRatingsReviewCount: null,
      rentSummary: null,
      promoSummary: null,
      yearBuilt: null,
      yearRenovated: null,
      phone: null,
      email: null,
      website: null,
      researchNotes: null,
      status: "to_visit",
      notes: null,
      researchStatus: "pending",
      researchError: null,
      researchAttempts: 0,
      researchStartedAt: null,
      importId: args.importId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: { token, id: v.string(), patch: v.object(patchFields) },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const id = ctx.db.normalizeId("apartments", args.id);
    if (!id) return null;
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.patch(id, { ...args.patch, updatedAt: Date.now() });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { token, id: v.string() },
  handler: async (ctx, args) => {
    assertAppToken(args.token);
    const id = ctx.db.normalizeId("apartments", args.id);
    if (!id) return;
    const existing = await ctx.db.get(id);
    if (existing) await ctx.db.delete(id);
  },
});
