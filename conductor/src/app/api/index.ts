import type { RomeAppApiHandler, RomeAppContext } from "@rome-os/app-runtime";
import { createApiHandler as createCoreApiHandler } from "../../core/api/index.js";
import { APP_COMPOSITION } from "../composition.js";

/**
 * App-owned API routes supplied through APP_COMPOSITION:
 *   GET tasks/:id/pull-requests  read-only status for mentioned pull requests
 */
export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return createCoreApiHandler(ctx, APP_COMPOSITION);
}
