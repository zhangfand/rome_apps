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

const log = createAppLogger("apartment_hunt_convex_import_list");

const inputSchema = z.object({
  importId: z.string().trim().min(1).describe("ID of the import job row to run"),
});

interface ImportPayload {
  listLocation?: unknown;
  apartments?: Array<{ name?: unknown; address?: unknown }>;
  error?: unknown;
}

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: inputSchema,
    execute: async ({ importId }) => {
      const repo = createApartmentHuntRepository();
      const job = await repo.getImport(importId);
      if (!job) {
        return { status: "error", error: `import ${importId} not found` };
      }

      await repo.updateImport(importId, { status: "running", error: null });
      log.info("import started", { importId, url: job.url });

      const prompt = [
        `Google Maps list share URL: ${job.url}`,
        "",
        "Extract the saved places and reply with the single JSON object described in your instructions.",
      ].join("\n");

      const result = await runAgentJson<ImportPayload>(
        deps.appContext,
        "apartment-importer-convex",
        prompt,
      );

      if (!result.ok) {
        await repo.updateImport(importId, { status: "failed", error: result.error });
        return { status: "error", error: result.error };
      }

      const listLocation =
        typeof result.data.listLocation === "string" ? result.data.listLocation.trim() : "";
      const entries = Array.isArray(result.data.apartments) ? result.data.apartments : [];
      const parsed = entries
        .map((e) => ({
          name: typeof e.name === "string" ? e.name.trim() : "",
          address: typeof e.address === "string" ? e.address.trim() : "",
        }))
        .filter((e) => e.name.length > 0);

      if (parsed.length === 0) {
        const reason =
          typeof result.data.error === "string" && result.data.error
            ? result.data.error
            : "no apartments found in the list";
        await repo.updateImport(importId, { status: "failed", error: reason, apartmentsFound: 0 });
        return { status: "error", error: reason };
      }

      const newIds: string[] = [];
      for (const entry of parsed) {
        const existing = await repo.findApartmentByName(entry.name);
        if (existing) {
          log.info("skipping duplicate", { name: entry.name });
          continue;
        }
        const row = await repo.createApartment({
          name: entry.name,
          address: entry.address || null,
          locationHint: listLocation || null,
          importId,
        });
        newIds.push(row.id);
      }

      await repo.updateImport(importId, { status: "done", apartmentsFound: parsed.length });
      log.info("import done", { importId, found: parsed.length, added: newIds.length });

      // New rows sit in `pending`; the sweep fans them out as parallel
      // detached research executions up to the concurrency cap, and its
      // recurring routine retries/resumes anything that fails or stalls.
      try {
        await deps.appContext.runAction("apartment_hunt_convex_sweep", {});
      } catch (err) {
        // Non-fatal: the recurring sweeper routine will pick the rows up.
        log.warn("post-import sweep failed", { error: String(err) });
      }

      return {
        status: "ok",
        data: { importId, found: parsed.length, added: newIds.length, apartmentIds: newIds },
      };
    },
  });
}
