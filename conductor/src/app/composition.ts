import type { CoreComposition } from "../core/lib/composition.js";
import { githubPromptNote } from "../domain/adapters/github/config.js";
import { readPullRequestStatuses } from "../domain/adapters/github/status.js";
import { SOURCE_ADAPTERS } from "./adapters/index.js";
import { parseAppConfig, githubPresentation, mergeAppConfig, setupSchema } from "./config.js";
import { providerFor } from "./workspaces/index.js";

export const APP_COMPOSITION: CoreComposition = {
  parseConfig: parseAppConfig,
  workspaceKinds: ["git-worktree", "none"],
  defaultWorkspaceKind: "git-worktree",
  sourceAdapters: SOURCE_ADAPTERS,
  providerFor,
  setupSchema,
  projectPromptNote: githubPromptNote,
  projectPresentation: githubPresentation,
  mergeConfig: mergeAppConfig,
  taskRoutes: [{
    method: "GET",
    path: ["pull-requests"],
    handle: readPullRequestStatuses,
  }],
};
