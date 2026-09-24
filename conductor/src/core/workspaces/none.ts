import { stat } from "node:fs/promises";
import type { Workspace, WorkspaceProvider } from "../lib/workspaces.js";

/**
 * No workspace. Nothing is created, nothing is validated, and the worker's
 * prompt says nothing about where to work — for a task whose work is not
 * files: reading, researching, reviewing, writing an answer back through the
 * ledger.
 *
 * It is recorded on the Dispatched fact as `{ kind: "none" }` rather than left
 * absent, so a worker with no workspace by design never looks like a worker
 * whose workspace went missing. The runtime still refuses the second case.
 */
export const noWorkspaceProvider: WorkspaceProvider = {
  kind: "none",
  async inspect(workingDir) {
    if (!workingDir) return { exists: false, isRepository: false };
    try {
      const entry = await stat(workingDir);
      return { exists: true, isRepository: false, problem: entry.isDirectory() ? undefined : "Path is not a directory." };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
      return code === "ENOENT"
        ? { exists: false, isRepository: false }
        : { exists: false, isRepository: false, problem: error instanceof Error ? error.message : String(error) };
    }
  },
  async prepare(): Promise<Workspace> {
    return { kind: "none" };
  },
  async validate(): Promise<void> {
    // Nothing was prepared, so nothing can have drifted.
  },
  instructions(): string {
    return "";
  },
};
