import type { CoreComposition } from "../core/lib/composition.js";
import { githubPromptNote } from "../domain/adapters/github/config.js";
import { readPullRequestStatuses } from "../domain/adapters/github/status.js";
import { SOURCE_ADAPTERS } from "./adapters/index.js";
import { initialAppConfig, parseAppConfig, githubPresentation, mergeAppConfig, setupSchema } from "./config.js";
import { providerFor } from "./workspaces/index.js";
import { cloneConfigRoute } from "../domain/config/clone.js";

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
  initialConfig: initialAppConfig,
  taskRoutes: [{
    method: "GET",
    path: ["pull-requests"],
    handle: readPullRequestStatuses,
  }],
  configRoutes: [{ method: "POST", path: ["clone"], handle: cloneConfigRoute }],
};
