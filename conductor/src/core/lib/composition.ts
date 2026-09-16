import type { RomeAppContext } from "@rome-os/app-runtime";
import type { SourceAdapter } from "./adapters.js";
import type { ConfigParser, ConductorConfig } from "./config.js";
import type { TaskView } from "./fold.js";
import type { ProjectConfig } from "./projects.js";
import type { WorkspaceKind, WorkspaceProvider } from "./workspaces.js";

export interface SetupSchemaExtension {
  projectDescription?: string;
  projectProperties?: Record<string, unknown>;
  rootProperties?: Record<string, unknown>;
}

/** An app-owned, guardian-only read attached beneath one task. */
export interface TaskDomainRoute {
  method: "GET";
  path: readonly string[];
  handle(ctx: RomeAppContext, task: TaskView): Promise<unknown>;
}

/** Dependencies supplied by the app composition root to the generic runtime. */
export interface CoreComposition {
  parseConfig: ConfigParser;
  workspaceKinds: readonly WorkspaceKind[];
  defaultWorkspaceKind: WorkspaceKind;
  sourceAdapters: readonly SourceAdapter[];
  providerFor(kind: WorkspaceKind): WorkspaceProvider;
  setupSchema?: SetupSchemaExtension;
  projectPromptNote?(task: TaskView, audience: "worker" | "orchestrator"): string;
  projectPresentation?(project: ProjectConfig | TaskView["project"] | undefined, config?: ConductorConfig): { repo?: string; subtitle?: string; sourceEnabled?: boolean; sourceLabel?: string; emptySubtitle?: string };
  mergeConfig?(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>;
  taskRoutes?: readonly TaskDomainRoute[];
}
