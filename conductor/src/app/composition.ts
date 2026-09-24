import type { CoreComposition } from "../core/lib/composition.js";
import { githubPromptNote } from "../domain/adapters/github/config.js";
import { readPullRequestStatuses } from "../domain/adapters/github/status.js";
import { SOURCE_ADAPTERS } from "./adapters/index.js";
import { initialAppConfig, parseAppConfig, githubPresentation, mergeAppConfig, setupSchema } from "./config.js";
import { providerFor } from "./workspaces/index.js";
import { cloneConfigRoute } from "../domain/config/clone.js";
import { workRepoPromptNote } from "../domain/work-repo.js";
import { createWorkRepoConfigRoute, setupWorkRepoConfigRoute } from "../domain/config/work-repo.js";
import { githubRepositoriesConfigRoute } from "../domain/config/github-repositories.js";
import { archiveTaskSnapshot, readArchivedTaskSnapshot } from "../domain/task-snapshot-artifact.js";
import { archiveWorkerReport } from "../domain/worker-report-artifact.js";

export const APP_COMPOSITION: CoreComposition = {
  parseConfig: parseAppConfig,
  workspaceKinds: ["git-worktree", "none"],
  defaultWorkspaceKind: "git-worktree",
  sourceAdapters: SOURCE_ADAPTERS,
  providerFor,
  setupSchema,
  projectPromptNote: (task, audience) => `${githubPromptNote(task, audience)}${workRepoPromptNote(task, audience)}`,
  archiveTaskSnapshot,
  readTaskSnapshot: readArchivedTaskSnapshot,
  archiveWorkerReport,
  projectPresentation: githubPresentation,
  mergeConfig: mergeAppConfig,
  initialConfig: initialAppConfig,
  taskRoutes: [{
    method: "GET",
    path: ["pull-requests"],
    handle: readPullRequestStatuses,
  }],
  configRoutes: [
    { method: "POST", path: ["clone"], handle: cloneConfigRoute },
    { method: "GET", path: ["github", "repositories"], handle: githubRepositoriesConfigRoute },
    { method: "POST", path: ["work-repo", "create"], handle: createWorkRepoConfigRoute },
    { method: "POST", path: ["work-repo", "setup"], handle: setupWorkRepoConfigRoute },
  ],
};
