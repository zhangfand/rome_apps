import { type WorkspaceKind, type WorkspaceProvider } from "../../core/lib/workspaces.js";
import { gitWorktreeProvider } from "../../domain/workspaces/git-worktree.js";
import { noWorkspaceProvider } from "../../core/workspaces/none.js";

const PROVIDERS: Record<WorkspaceKind, WorkspaceProvider> = {
  "git-worktree": gitWorktreeProvider,
  none: noWorkspaceProvider,
};

export function providerFor(kind: WorkspaceKind): WorkspaceProvider {
  return PROVIDERS[kind] ?? gitWorktreeProvider;
}
