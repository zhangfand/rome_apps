/**
 * Convex deployment wiring, baked at build time.
 *
 * `CONVEX_URL` is the public deployment URL (not a secret). `APP_TOKEN` is the
 * shared secret the Convex functions check via their `APP_TOKEN` env var
 * (`npx convex env set APP_TOKEN <value>`); Convex Cloud functions are
 * otherwise publicly callable by anyone who discovers the URL.
 *
 * Both can be overridden at runtime via env vars, which also lets you point
 * the app at a different deployment (e.g. a local `convex dev` one) without
 * rebuilding.
 */
// Avoid a hard dependency on Node types — this module is compiled with the
// browser-targeted app tsconfig but only ever runs server-side.
const env: Record<string, string | undefined> =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const CONVEX_URL = env.APARTMENT_HUNT_CONVEX_URL ?? "https://hardy-oriole-243.convex.cloud";

export const APP_TOKEN = env.APARTMENT_HUNT_CONVEX_TOKEN ?? "8d55daaffe41eb8665cbbafce485e63a89e8b9f20d53d4e9";
