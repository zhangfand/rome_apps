/**
 * On-disk locations for uploaded reports and rendered page images.
 *
 * Non-DB app data lives under `~/.rome/<profile>/apps/data/family-health/`
 * (see the Rome apps reference); `purge` uninstall removes it. Nothing here is
 * ever written inside the source repository. `FAMILY_HEALTH_DATA_DIR`
 * overrides the root for tests and local scripts.
 */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

export const APP_ID = "family-health";

export function appDataDir(): string {
  const override = process.env.FAMILY_HEALTH_DATA_DIR;
  const dir = override
    ? resolve(override)
    : join(homedir(), ".rome", process.env.ROME_PROFILE ?? "default", "apps", "data", APP_ID);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Directory holding everything for one report: originals + rendered pages. */
export function reportDir(reportId: string): string {
  const safe = basename(reportId);
  const dir = join(appDataDir(), "reports", safe);
  mkdirSync(join(dir, "sources"), { recursive: true });
  mkdirSync(join(dir, "pages"), { recursive: true });
  return dir;
}

/** Resolve a stored file path, refusing anything outside the app data dir. */
export function resolveStoredPath(absPath: string): string | null {
  const root = appDataDir();
  const full = resolve(absPath);
  return full === root || full.startsWith(root + sep) ? full : null;
}
