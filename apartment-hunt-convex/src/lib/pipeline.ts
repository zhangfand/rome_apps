import type { RomeAppContext } from "@rome-os/app-runtime";

/** Max concurrent research executions dispatched by the sweeper. */
export const RESEARCH_CONCURRENCY_CAP = 3;
/** Max research attempts before a row is marked terminally failed. */
export const MAX_RESEARCH_ATTEMPTS = 3;
/** A `researching` row older than this is considered stale (crashed/lost). */
export const RESEARCH_STALE_MS = 15 * 60 * 1000;
/** A `running` import older than this is considered stale. */
export const IMPORT_STALE_MS = 30 * 60 * 1000;

export const SWEEP_ROUTINE_NAME = "apartment-hunt-convex-sweep";

/**
 * Ensure the recurring sweeper routine exists (every 5 minutes). The sweeper
 * is what gives the pipeline retry + resume: it re-queues stale work, applies
 * capped auto-retry, and tops up the research fan-out to the concurrency cap.
 * Deduped by routine name; safe to call from any action.
 */
export async function ensureSweeperRoutine(appContext: RomeAppContext): Promise<boolean> {
  const existing = await appContext.listRoutines();
  if (existing.some((r) => r.name === SWEEP_ROUTINE_NAME)) return false;
  const result = await appContext.runAction("create_routine", {
    name: SWEEP_ROUTINE_NAME,
    trigger: {
      type: "schedule",
      tzid: "UTC",
      tzMode: "fixed",
      localTime: "00:00",
      rrule: "FREQ=MINUTELY;INTERVAL=5",
    },
    actionName: "apartment_hunt_convex_sweep",
    args: {},
  });
  if (result.status !== "ok") {
    const reason = result.status === "error" ? result.error : `create_routine returned ${result.status}`;
    throw new Error(reason);
  }
  return true;
}
