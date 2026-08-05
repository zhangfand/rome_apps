import {
  createAppLogger,
  defineAction,
  z,
  type Action,
  type ActionConfig,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createApartmentHuntRepository } from "../../lib/store.js";
import { runAgentJson } from "../../lib/agent.js";
import {
  ensureSweeperRoutine,
  MAX_RESEARCH_ATTEMPTS,
  RESEARCH_STALE_MS,
} from "../../lib/pipeline.js";

const log = createAppLogger("apartment_hunt_convex_research");

const inputSchema = z.object({
  apartmentId: z.string().trim().min(1).describe("ID of the apartment row to research"),
  claimed: z
    .boolean()
    .optional()
    .describe("True when the sweeper already claimed the row (set researching + attempts)"),
});

interface ResearchPayload {
  mapsUrl?: string | null;
  address?: string | null;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleRating?: number | null;
  apartmentRatingsUrl?: string | null;
  apartmentRatingsScore?: number | null;
  apartmentRatingsReviewCount?: number | null;
  rentSummary?: string | null;
  promoSummary?: string | null;
  yearBuilt?: number | null;
  yearRenovated?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
}

function asYear(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 1800 && v <= 2100 ? v : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: inputSchema,
    execute: async ({ apartmentId, claimed }) => {
      const repo = createApartmentHuntRepository();
      const apartment = await repo.getApartment(apartmentId);
      if (!apartment) {
        return { status: "error", error: `apartment ${apartmentId} not found` };
      }

      // The sweeper routine is what provides retry/resume; make sure it exists
      // even when research is triggered directly (manual add / re-research).
      try {
        await ensureSweeperRoutine(deps.appContext);
      } catch (err) {
        log.warn("could not ensure sweeper routine", { error: String(err) });
      }

      let attempts = apartment.researchAttempts;
      if (!claimed) {
        // Guard against double-running a fresh in-flight row (e.g. double-click).
        if (apartment.researchStatus === "researching") {
          const startedAt = apartment.researchStartedAt
            ? new Date(apartment.researchStartedAt).getTime()
            : 0;
          if (Date.now() - startedAt <= RESEARCH_STALE_MS) {
            return { status: "ok", data: { skipped: "already researching" } };
          }
        }
        attempts = apartment.researchAttempts + 1;
        await repo.updateApartment(apartmentId, {
          researchStatus: "researching",
          researchStartedAt: new Date(),
          researchAttempts: attempts,
          researchError: null,
        });
      }
      log.info("research started", { apartmentId, name: apartment.name, attempts });

      const locationContext =
        apartment.locationHint ??
        (apartment.address ? `the metro area of: ${apartment.address}` : "(unknown — be conservative; if candidates conflict across metros, return nulls)");
      const prompt = [
        `Apartment name: ${apartment.name}`,
        `Known address: ${apartment.address ?? "(unknown)"}`,
        `Location context (the community MUST be in this metro): ${locationContext}`,
        "",
        "Research this apartment community and reply with the single JSON object described in your instructions.",
      ].join("\n");

      const result = await runAgentJson<ResearchPayload>(
        deps.appContext,
        "apartment-researcher-convex",
        prompt,
      );

      if (!result.ok) {
        const retryable = attempts < MAX_RESEARCH_ATTEMPTS;
        await repo.updateApartment(apartmentId, {
          // `pending` puts the row back in the sweeper's queue for auto-retry.
          researchStatus: retryable ? "pending" : "failed",
          researchError: retryable
            ? `attempt ${attempts} failed (will retry): ${result.error}`
            : `failed after ${attempts} attempts: ${result.error}`,
        });
        log.warn("research failed", { apartmentId, attempts, retryable, error: result.error });
        return { status: "error", error: result.error };
      }

      const p = result.data;
      const updated = await repo.updateApartment(apartmentId, {
        mapsUrl: asStr(p.mapsUrl) ?? apartment.mapsUrl,
        address: asStr(p.address) ?? apartment.address,
        area: asStr(p.area) ?? apartment.area,
        latitude: asNum(p.latitude) ?? apartment.latitude,
        longitude: asNum(p.longitude) ?? apartment.longitude,
        googleRating: asNum(p.googleRating) ?? apartment.googleRating,
        apartmentRatingsUrl: asStr(p.apartmentRatingsUrl),
        apartmentRatingsScore: asNum(p.apartmentRatingsScore),
        apartmentRatingsReviewCount: asNum(p.apartmentRatingsReviewCount),
        rentSummary: asStr(p.rentSummary),
        promoSummary: asStr(p.promoSummary),
        yearBuilt: asYear(p.yearBuilt) ?? apartment.yearBuilt,
        yearRenovated: asYear(p.yearRenovated) ?? apartment.yearRenovated,
        phone: asStr(p.phone) ?? apartment.phone,
        email: asStr(p.email) ?? apartment.email,
        website: asStr(p.website) ?? apartment.website,
        researchNotes: asStr(p.notes),
        researchStatus: "done",
        researchError: null,
      });

      log.info("research done", { apartmentId, attempts });
      return { status: "ok", data: { apartment: updated } };
    },
  });
}
