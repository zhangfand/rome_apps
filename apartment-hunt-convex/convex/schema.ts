import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema for the Apartment Hunt clone.
 *
 * Mirrors the SQLite schema of the original app 1:1 so the Rome-side
 * repository can keep the same row shapes. Timestamps are epoch millis.
 * Documents use the Convex `_id` as the row id.
 */
export default defineSchema({
  apartments: defineTable({
    name: v.string(),
    address: v.union(v.string(), v.null()),
    /** Metro/city context the apartment must be in (e.g. "Austin, TX"). */
    locationHint: v.union(v.string(), v.null()),
    /** Neighborhood/area within the metro (e.g. "North Austin", "Mueller"). */
    area: v.union(v.string(), v.null()),
    mapsUrl: v.union(v.string(), v.null()),
    latitude: v.union(v.number(), v.null()),
    longitude: v.union(v.number(), v.null()),
    googleRating: v.union(v.number(), v.null()),
    apartmentRatingsUrl: v.union(v.string(), v.null()),
    apartmentRatingsScore: v.union(v.number(), v.null()),
    apartmentRatingsReviewCount: v.union(v.number(), v.null()),
    rentSummary: v.union(v.string(), v.null()),
    promoSummary: v.union(v.string(), v.null()),
    yearBuilt: v.union(v.number(), v.null()),
    yearRenovated: v.union(v.number(), v.null()),
    /**
     * Leasing office contact info (for future automated outreach).
     * Optional (not just nullable): added after launch, so pre-existing docs
     * lack the keys — Convex schema evolution without a migration file.
     */
    phone: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    website: v.optional(v.union(v.string(), v.null())),
    researchNotes: v.union(v.string(), v.null()),
    /** Hunt workflow status: to_visit | visited | rejected | applied */
    status: v.string(),
    notes: v.union(v.string(), v.null()),
    /** Auto-research lifecycle: pending | researching | done | failed */
    researchStatus: v.string(),
    researchError: v.union(v.string(), v.null()),
    researchAttempts: v.number(),
    researchStartedAt: v.union(v.number(), v.null()),
    importId: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  imports: defineTable({
    url: v.string(),
    /** pending | running | done | failed */
    status: v.string(),
    error: v.union(v.string(), v.null()),
    apartmentsFound: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  /**
   * Ephemeral read-only sessions for the browser UI. Rome's guardian-auth'd
   * API mints a token and registers it here; queries accept it as an
   * alternative to the server-side APP_TOKEN. A cron prunes expired rows.
   */
  sessions: defineTable({
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),
});
