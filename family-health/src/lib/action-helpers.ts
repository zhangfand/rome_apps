/**
 * Helpers shared by the chat actions: store construction and conversion of
 * UserFacingError into a structured error the chat agent can act on
 * (e.g. ask the user which member they meant).
 */
import type { ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { FamilyHealthStore } from "../db/repositories/store.js";
import { UserFacingError } from "./service.js";
import { syncGuardianTimeZone } from "./timezone.js";

export function storeFrom(deps: AppActionRuntimeDeps): FamilyHealthStore {
  return new FamilyHealthStore(deps.appContext.db);
}

/**
 * Error payload is JSON so the agent can read `code`, `message` and e.g.
 * `candidates` / `suggestions`; the message itself is Chinese and user-ready.
 */
export function actionError(err: unknown): ActionResult {
  if (err instanceof UserFacingError) {
    return { status: "error", error: JSON.stringify({ code: err.code, message: err.message, ...(err.details ?? {}) }) };
  }
  return { status: "error", error: JSON.stringify({ code: "internal_error", message: (err as Error)?.message ?? String(err) }) };
}

export async function run(deps: AppActionRuntimeDeps, fn: () => unknown | Promise<unknown>): Promise<ActionResult> {
  try {
    await syncGuardianTimeZone(deps.appContext);
    return { status: "ok", data: await fn() };
  } catch (err) {
    return actionError(err);
  }
}
