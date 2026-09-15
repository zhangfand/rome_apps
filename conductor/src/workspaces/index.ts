import { type WorkspaceKind, type WorkspaceProvider } from "../lib/workspaces.js";
import { gitWorktreeProvider } from "./git-worktree.js";
import { noWorkspaceProvider } from "./none.js";

/**
 * Every kind of workspace a project may ask for. Adding one is a file here and
 * a line below; the loop, the ledger and the prompts do not change.
 */
const PROVIDERS: Record<WorkspaceKind, WorkspaceProvider> = {
  "git-worktree": gitWorktreeProvider,
  none: noWorkspaceProvider,
};

export function providerFor(kind: WorkspaceKind): WorkspaceProvider {
  return PROVIDERS[kind] ?? gitWorktreeProvider;
}
