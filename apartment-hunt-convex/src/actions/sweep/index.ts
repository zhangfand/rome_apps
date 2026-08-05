import {
  createAppLogger,
  defineAction,
  z,
  type Action,
  type ActionConfig,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createApartmentHuntRepository } from "../../lib/store.js";
import {
  ensureSweeperRoutine,
  IMPORT_STALE_MS,
  MAX_RESEARCH_ATTEMPTS,
  RESEARCH_CONCURRENCY_CAP,
  RESEARCH_STALE_MS,
} from "../../lib/pipeline.js";

const log = createAppLogger("apartment_hunt_convex_sweep");

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: z.object({}),
    execute: async () => {
      const repo = createApartmentHuntRepository();
      const now = Date.now();

      try {
        await ensureSweeperRoutine(deps.appContext);
      } catch (err) {
        log.warn("could not ensure sweeper routine", { error: String(err) });
      }

      let requeued = 0;
      let terminallyFailed = 0;

      // 1) Recover stale in-flight research (crashed daemon, lost execution).
      for (const row of await repo.listApartments()) {
        if (row.researchStatus !== "researching") continue;
        const startedAt = row.researchStartedAt ? new Date(row.researchStartedAt).getTime() : 0;
        if (now - startedAt <= RESEARCH_STALE_MS) continue;
        if (row.researchAttempts >= MAX_RESEARCH_ATTEMPTS) {
          await repo.updateApartment(row.id, {
            researchStatus: "failed",
            researchError: `research timed out after ${row.researchAttempts} attempts`,
          });
          terminallyFailed += 1;
        } else {
          await repo.updateApartment(row.id, {
            researchStatus: "pending",
            researchError: "previous attempt timed out; queued for retry",
          });
          requeued += 1;
        }
      }

      // 2) Fan out pending research up to the concurrency cap.
      const rows = await repo.listApartments();
      const inFlight = rows.filter((r) => r.researchStatus === "researching").length;
      const capacity = Math.max(0, RESEARCH_CONCURRENCY_CAP - inFlight);
      const pendingRows = rows
        .filter((r) => r.researchStatus === "pending")
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        .slice(0, capacity);

      const dispatched: string[] = [];
      for (const row of pendingRows) {
        // Claim before dispatch so a concurrent sweep never double-dispatches;
        // if the dispatch is lost, the staleness timeout reclaims the row.
        await repo.updateApartment(row.id, {
          researchStatus: "researching",
          researchStartedAt: new Date(),
          researchAttempts: row.researchAttempts + 1,
        });
        try {
          await deps.appContext.runAction(
            "apartment_hunt_convex_research",
            { apartmentId: row.id, claimed: true },
            { detached: true },
          );
          dispatched.push(row.id);
        } catch (err) {
          log.warn("dispatch failed; requeueing", { apartmentId: row.id, error: String(err) });
          await repo.updateApartment(row.id, {
            researchStatus: "pending",
            researchError: `dispatch failed: ${(err as Error).message}`,
          });
        }
      }

      // 3) Time out stuck imports.
      let importsTimedOut = 0;
      for (const job of await repo.listImports()) {
        if (job.status !== "running" && job.status !== "pending") continue;
        const updatedAt = new Date(job.updatedAt).getTime();
        if (now - updatedAt > IMPORT_STALE_MS) {
          await repo.updateImport(job.id, {
            status: "failed",
            error: "import timed out; submit the list link again to retry",
          });
          importsTimedOut += 1;
        }
      }

      const summary = { requeued, terminallyFailed, dispatched: dispatched.length, inFlight, importsTimedOut };
      if (requeued || terminallyFailed || dispatched.length || importsTimedOut) {
        log.info("sweep acted", summary);
      }
      return { status: "ok", data: summary };
    },
  });
}
