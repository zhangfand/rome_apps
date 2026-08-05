/**
 * Convex-backed storage layer.
 *
 * Drop-in replacement for the original app's SQLite repository: same method
 * names and row shapes, but every method is async and rows use epoch-millis
 * numbers for timestamps (JSON-safe; the original serialized Dates to ISO
 * strings over the API anyway).
 *
 * Function references are built by name (`makeFunctionReference`) so the Rome
 * build does not depend on Convex codegen output (`convex/_generated` is only
 * needed by the Convex CLI when deploying functions).
 */
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { APP_TOKEN, CONVEX_URL } from "./deployment.js";

export type HuntStatus = "to_visit" | "visited" | "rejected" | "applied";
export type ResearchStatus = "pending" | "researching" | "done" | "failed";
export type ImportStatus = "pending" | "running" | "done" | "failed";

export interface ApartmentRow {
  id: string;
  name: string;
  address: string | null;
  locationHint: string | null;
  area: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  googleRating: number | null;
  apartmentRatingsUrl: string | null;
  apartmentRatingsScore: number | null;
  apartmentRatingsReviewCount: number | null;
  rentSummary: string | null;
  promoSummary: string | null;
  yearBuilt: number | null;
  yearRenovated: number | null;
  /** Leasing office contact info (for future automated outreach). */
  phone: string | null;
  email: string | null;
  website: string | null;
  researchNotes: string | null;
  status: string;
  notes: string | null;
  researchStatus: string;
  researchError: string | null;
  researchAttempts: number;
  /** epoch millis */
  researchStartedAt: number | null;
  importId: string | null;
  /** epoch millis */
  createdAt: number;
  /** epoch millis */
  updatedAt: number;
}

export interface ImportRow {
  id: string;
  url: string;
  status: string;
  error: string | null;
  apartmentsFound: number | null;
  /** epoch millis */
  createdAt: number;
  /** epoch millis */
  updatedAt: number;
}

export type ApartmentPatch = Partial<
  Omit<ApartmentRow, "id" | "createdAt" | "updatedAt" | "researchStartedAt">
> & {
  /** Accepts Date for call-site compatibility with the original repository. */
  researchStartedAt?: number | Date | null;
};

type ConvexDoc = Record<string, unknown> & { _id: string; _creationTime: number };

function toRow<T>(doc: ConvexDoc): T {
  const { _id, _creationTime, ...rest } = doc;
  return { id: _id, ...rest } as T;
}

function normalizePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, valueRaw] of Object.entries(patch)) {
    if (valueRaw === undefined) continue;
    out[k] = valueRaw instanceof Date ? valueRaw.getTime() : valueRaw;
  }
  return out;
}

// Function references by name — no codegen import needed on the Rome side.
const fns = {
  apartmentsList: makeFunctionReference<"query">("apartments:list"),
  apartmentsGet: makeFunctionReference<"query">("apartments:get"),
  apartmentsCreate: makeFunctionReference<"mutation">("apartments:create"),
  apartmentsUpdate: makeFunctionReference<"mutation">("apartments:update"),
  apartmentsRemove: makeFunctionReference<"mutation">("apartments:remove"),
  importsList: makeFunctionReference<"query">("imports:list"),
  importsGet: makeFunctionReference<"query">("imports:get"),
  importsCreate: makeFunctionReference<"mutation">("imports:create"),
  importsUpdate: makeFunctionReference<"mutation">("imports:update"),
  settingsGet: makeFunctionReference<"query">("settings:get"),
  settingsSet: makeFunctionReference<"mutation">("settings:set"),
  sessionsIssue: makeFunctionReference<"mutation">("sessions:issue"),
};

export class ApartmentHuntConvexRepository {
  private readonly client: ConvexHttpClient;
  private readonly token: string | undefined;

  constructor(url: string = CONVEX_URL, token: string = APP_TOKEN) {
    if (!url) {
      throw new Error(
        "Convex deployment URL is not configured (src/lib/deployment.ts or APARTMENT_HUNT_CONVEX_URL)",
      );
    }
    this.client = new ConvexHttpClient(url);
    this.token = token || undefined;
  }

  // --- apartments ---

  async listApartments(): Promise<ApartmentRow[]> {
    const docs = (await this.client.query(fns.apartmentsList, { token: this.token })) as ConvexDoc[];
    return docs.map((d) => toRow<ApartmentRow>(d));
  }

  async getApartment(id: string): Promise<ApartmentRow | undefined> {
    const doc = (await this.client.query(fns.apartmentsGet, {
      token: this.token,
      id,
    })) as ConvexDoc | null;
    return doc ? toRow<ApartmentRow>(doc) : undefined;
  }

  async findApartmentByName(name: string): Promise<ApartmentRow | undefined> {
    const target = name.trim().toLowerCase();
    const rows = await this.listApartments();
    return rows.find((a) => a.name.trim().toLowerCase() === target);
  }

  async createApartment(input: {
    name: string;
    address?: string | null;
    locationHint?: string | null;
    importId?: string | null;
  }): Promise<ApartmentRow> {
    const doc = (await this.client.mutation(fns.apartmentsCreate, {
      token: this.token,
      name: input.name,
      address: input.address ?? null,
      locationHint: input.locationHint ?? null,
      importId: input.importId ?? null,
    })) as ConvexDoc;
    return toRow<ApartmentRow>(doc);
  }

  async updateApartment(id: string, patch: ApartmentPatch): Promise<ApartmentRow | undefined> {
    const doc = (await this.client.mutation(fns.apartmentsUpdate, {
      token: this.token,
      id,
      patch: normalizePatch(patch as Record<string, unknown>),
    })) as ConvexDoc | null;
    return doc ? toRow<ApartmentRow>(doc) : undefined;
  }

  async deleteApartment(id: string): Promise<void> {
    await this.client.mutation(fns.apartmentsRemove, { token: this.token, id });
  }

  // --- imports ---

  async listImports(): Promise<ImportRow[]> {
    const docs = (await this.client.query(fns.importsList, {
      token: this.token,
      limit: 20,
    })) as ConvexDoc[];
    return docs.map((d) => toRow<ImportRow>(d));
  }

  async getImport(id: string): Promise<ImportRow | undefined> {
    const doc = (await this.client.query(fns.importsGet, {
      token: this.token,
      id,
    })) as ConvexDoc | null;
    return doc ? toRow<ImportRow>(doc) : undefined;
  }

  async createImport(url: string): Promise<ImportRow> {
    const doc = (await this.client.mutation(fns.importsCreate, {
      token: this.token,
      url,
    })) as ConvexDoc;
    return toRow<ImportRow>(doc);
  }

  async updateImport(
    id: string,
    patch: Partial<Pick<ImportRow, "status" | "error" | "apartmentsFound">>,
  ): Promise<ImportRow | undefined> {
    const doc = (await this.client.mutation(fns.importsUpdate, {
      token: this.token,
      id,
      patch: normalizePatch(patch as Record<string, unknown>),
    })) as ConvexDoc | null;
    return doc ? toRow<ImportRow>(doc) : undefined;
  }

  // --- settings ---

  // --- browser read sessions ---

  /**
   * Mint an ephemeral read-only token for the browser (live subscriptions).
   * Guarded by APP_TOKEN on the Convex side; only Rome can mint.
   */
  async issueSession(sessionToken: string, ttlMs: number): Promise<{ expiresAt: number }> {
    return (await this.client.mutation(fns.sessionsIssue, {
      token: this.token,
      sessionToken,
      ttlMs,
    })) as { expiresAt: number };
  }

  async getSetting(key: string): Promise<string | null> {
    return (await this.client.query(fns.settingsGet, { token: this.token, key })) as string | null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.client.mutation(fns.settingsSet, { token: this.token, key, value });
  }
}

export function createApartmentHuntRepository(): ApartmentHuntConvexRepository {
  return new ApartmentHuntConvexRepository();
}
