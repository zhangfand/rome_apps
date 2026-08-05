import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { CONVEX_URL } from "../lib/deployment.js";
import { createApartmentHuntRepository, type ApartmentPatch } from "../lib/store.js";

/** Browser read-session lifetime; the UI renews ~5 minutes before expiry. */
const SESSION_TTL_MS = 60 * 60 * 1000;

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function readJsonBody(request: RomeAppApiRequest): unknown {
  if (!request.body || request.body.byteLength === 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(request.body));
  } catch {
    return undefined; // malformed JSON
  }
}

const HUNT_STATUSES = new Set(["to_visit", "visited", "rejected", "applied"]);

class ApartmentHuntApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  private repo() {
    return createApartmentHuntRepository();
  }

  async handle(request: RomeAppApiRequest): Promise<Response> {
    if (request.caller.kind !== "guardian") {
      return json({ error: "forbidden" }, { status: 401 });
    }

    const route = request.path.join("/");
    const repo = this.repo();

    // GET /state — everything the UI needs.
    if (request.method === "GET" && route === "state") {
      const [apartments, imports, mapsApiKey] = await Promise.all([
        repo.listApartments(),
        repo.listImports(),
        repo.getSetting("mapsApiKey"),
      ]);
      return json({ apartments, imports, settings: { mapsApiKey } });
    }

    // GET /session — mint an ephemeral read-only Convex token so the browser
    // can subscribe to queries directly (live updates). Guardian-auth'd like
    // every route here; the long-lived APP_TOKEN never leaves the server.
    if (request.method === "GET" && route === "session") {
      const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
      const { expiresAt } = await repo.issueSession(sessionToken, SESSION_TTL_MS);
      return json({ url: CONVEX_URL, token: sessionToken, expiresAt });
    }

    // POST /settings — { mapsApiKey } store the Google Maps JS API key.
    if (request.method === "POST" && route === "settings") {
      const body = readJsonBody(request);
      if (body === undefined || body === null) {
        return json({ error: "invalid JSON body" }, { status: 400 });
      }
      const { mapsApiKey } = body as { mapsApiKey?: unknown };
      if (typeof mapsApiKey !== "string" || !mapsApiKey.trim()) {
        return json({ error: "mapsApiKey is required" }, { status: 400 });
      }
      await repo.setSetting("mapsApiKey", mapsApiKey.trim());
      return json({ ok: true });
    }

    // POST /imports — { url } start a Google Maps list import.
    if (request.method === "POST" && route === "imports") {
      const body = readJsonBody(request);
      if (body === undefined) return json({ error: "invalid JSON body" }, { status: 400 });
      const url = typeof (body as { url?: unknown })?.url === "string"
        ? ((body as { url: string }).url).trim()
        : "";
      if (!/^https?:\/\//i.test(url)) {
        return json({ error: "a valid http(s) Google Maps list URL is required" }, { status: 400 });
      }
      const job = await repo.createImport(url);
      await this.ctx.runAction(
        "apartment_hunt_convex_import_list",
        { importId: job.id },
        { detached: true },
      );
      return json({ import: job }, { status: 201 });
    }

    // POST /apartments — { name, address? } add one apartment manually.
    if (request.method === "POST" && route === "apartments") {
      const body = readJsonBody(request);
      if (body === undefined) return json({ error: "invalid JSON body" }, { status: 400 });
      const { name, address } = (body ?? {}) as { name?: unknown; address?: unknown };
      if (typeof name !== "string" || !name.trim()) {
        return json({ error: "name is required" }, { status: 400 });
      }
      if (await repo.findApartmentByName(name)) {
        return json({ error: "an apartment with this name already exists" }, { status: 409 });
      }
      const row = await repo.createApartment({
        name,
        address: typeof address === "string" ? address : null,
      });
      // The sweep claims the row and dispatches detached research, respecting
      // the concurrency cap; the recurring sweeper retries/resumes it later.
      await this.ctx.runAction("apartment_hunt_convex_sweep", {});
      return json({ apartment: await repo.getApartment(row.id) }, { status: 201 });
    }

    // Routes under /apartments/:id
    if (request.path[0] === "apartments" && request.path.length >= 2) {
      const id = request.path[1];
      const existing = await repo.getApartment(id);
      if (!existing) return json({ error: "apartment not found" }, { status: 404 });

      // POST /apartments/:id/research — re-run auto-research (fresh attempt
      // budget), queued through the sweep so the concurrency cap holds.
      if (request.method === "POST" && request.path[2] === "research") {
        await repo.updateApartment(id, {
          researchStatus: "pending",
          researchError: null,
          researchAttempts: 0,
        });
        await this.ctx.runAction("apartment_hunt_convex_sweep", {});
        return json({ apartment: await repo.getApartment(id) });
      }

      // PATCH /apartments/:id — edit tracked fields.
      if (request.method === "PATCH" && request.path.length === 2) {
        const body = readJsonBody(request);
        if (body === undefined || body === null) {
          return json({ error: "invalid JSON body" }, { status: 400 });
        }
        const b = body as Record<string, unknown>;
        const patch: ApartmentPatch = {};
        if (typeof b.status === "string") {
          if (!HUNT_STATUSES.has(b.status)) {
            return json({ error: "invalid status" }, { status: 400 });
          }
          patch.status = b.status;
        }
        if (typeof b.name === "string") {
          if (!b.name.trim()) return json({ error: "name cannot be empty" }, { status: 400 });
          patch.name = b.name.trim();
        }
        for (const key of [
          "address",
          "locationHint",
          "area",
          "notes",
          "rentSummary",
          "promoSummary",
          "mapsUrl",
          "apartmentRatingsUrl",
          "phone",
          "email",
          "website",
        ] as const) {
          if (typeof b[key] === "string") {
            patch[key] = (b[key] as string).trim() || null;
          }
        }
        for (const key of ["yearBuilt", "yearRenovated"] as const) {
          if (b[key] === null) patch[key] = null;
          else if (typeof b[key] === "number") {
            const y = b[key] as number;
            if (!Number.isInteger(y) || y < 1800 || y > 2100) {
              return json({ error: `invalid ${key}` }, { status: 400 });
            }
            patch[key] = y;
          }
        }
        const updated = await repo.updateApartment(id, patch);
        return json({ apartment: updated });
      }

      // DELETE /apartments/:id
      if (request.method === "DELETE" && request.path.length === 2) {
        await repo.deleteApartment(id);
        return json({ ok: true });
      }
    }

    return json({ error: "not_found", message: `Unknown route: /${route}` }, { status: 404 });
  }
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new ApartmentHuntApiHandler(ctx);
}
