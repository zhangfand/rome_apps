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
  async prepare(): Promise<Workspace> {
    return { kind: "none" };
  },
  async validate(): Promise<void> {
    // Nothing was prepared, so nothing can have drifted.
  },
  instructions(): string {
    return "";
  },
  note(): string {
    return "";
  },
};
