import path from "node:path";
import type { ConductorConfig } from "./config.js";
import type { WorkspaceKind } from "./workspaces.js";

/** Domain-neutral project fields plus opaque app-owned extensions. */
export interface ProjectConfig {
  workingDir?: string;
  workspace?: WorkspaceKind;
  sop?: string;
  [extension: string]: unknown;
}

/** A snapshot copied into Created so later config edits do not move a task. */
export interface ProjectBinding {
  projectId: string;
  project: { workingDir?: string; workspace?: WorkspaceKind; [extension: string]: unknown };
}

export function bindProject(config: ConductorConfig, projectId: string): ProjectBinding {
  if (!Object.hasOwn(config.projects, projectId)) {
    throw new Error(`Unknown project ${JSON.stringify(projectId)}. Choose: ${Object.keys(config.projects).join(", ")}`);
  }
  const { sop: _sop, ...project } = config.projects[projectId];
  return { projectId, project };
}

export function resolveHumanProject(config: ConductorConfig, input: {
  projectId?: string; projectPath?: string; projectName?: string;
}): ProjectBinding {
  if (input.projectId) return bindProject(config, input.projectId);
  const entries = Object.entries(config.projects);
  if (input.projectPath) {
    const norm = (p: string) => path.normalize(p).replace(/\/+$/, "");
    const matches = entries.filter(([, p]) => p.workingDir && norm(p.workingDir) === norm(input.projectPath!));
    if (matches.length === 1) return bindProject(config, matches[0][0]);
    if (matches.length > 1) throw new Error("Selected chat directory maps to multiple projects; pass projectId explicitly.");
  }
  if (input.projectName && Object.hasOwn(config.projects, input.projectName)) return bindProject(config, input.projectName);
  if (entries.length === 1) return bindProject(config, entries[0][0]);
  if (config.defaultProject) return bindProject(config, config.defaultProject);
  throw new Error(`Task project is ambiguous. Ask which project, then pass projectId: ${entries.map(([id]) => id).join(", ")}`);
}
