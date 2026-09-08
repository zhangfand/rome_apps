import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where a run writes its recording, subtitles, and log. The app context carries
 * no data directory, so the path is derived the same way the daemon derives it:
 * profile-scoped, under the guardian's home.
 *
 * Backend only — it reads `HOME` and `ROME_PROFILE`, so never import it from
 * `src/web/`.
 */
export function appDataDir(): string {
  return join(
    process.env.HOME ?? homedir(),
    ".rome",
    process.env.ROME_PROFILE ?? "default",
    "apps",
    "data",
    "feature-video",
  );
}

/** Directory for one run's artifacts. The caller creates it. */
export function runDir(runId: string): string {
  return join(appDataDir(), "runs", runId);
}
