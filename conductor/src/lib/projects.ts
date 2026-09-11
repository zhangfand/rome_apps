import path from "node:path";
import type { ConductorConfig } from "./config.js";

export interface ProjectConfig {
  workingDir: string;
  repo?: string;
  intakeEnabled?: boolean;
  intakeLabel?: string;
  projectLabel?: string;
  /** Project-specific SOP; overrides the global one. */
  sop?: string;
}

/** Copied into the ledger at Created, not a pointer to mutable settings. */
export interface ProjectBinding {
  projectId: string;
  project: { workingDir: string; repo?: string };
}

export function bindProject(config: ConductorConfig, projectId: string): ProjectBinding {
  if (!Object.hasOwn(config.projects, projectId)) {
    throw new Error(`Unknown project ${JSON.stringify(projectId)}. Choose: ${Object.keys(config.projects).join(", ")}`);
  }
  const { workingDir, repo } = config.projects[projectId];
  return { projectId, project: { workingDir, ...(repo ? { repo } : {}) } };
}

/** Explicit choice wins. A selected chat path must map exactly; never fuzzy-match. */
export function resolveHumanProject(config: ConductorConfig, input: {
  projectId?: string; projectPath?: string; projectName?: string;
}): ProjectBinding {
  if (input.projectId) return bindProject(config, input.projectId);
  const entries = Object.entries(config.projects);
  if (input.projectPath) {
    const norm = (p: string) => path.normalize(p).replace(/\/+$/, "");
    const matches = entries.filter(([, p]) => norm(p.workingDir) === norm(input.projectPath!));
    if (matches.length === 1) return bindProject(config, matches[0][0]);
    if (matches.length > 1) throw new Error("Selected chat directory maps to multiple projects; pass projectId explicitly.");
  }
  if (input.projectName && Object.hasOwn(config.projects, input.projectName)) return bindProject(config, input.projectName);
  if (entries.length === 1) return bindProject(config, entries[0][0]);
  if (config.defaultProject) return bindProject(config, config.defaultProject);
  throw new Error(`Task project is ambiguous. Ask which project, then pass projectId: ${entries.map(([id]) => id).join(", ")}`);
}

export interface IntakeRoute extends ProjectBinding { repo: string; labels: string[] }

export function intakeRoutes(config: ConductorConfig): IntakeRoute[] {
  return Object.entries(config.projects).flatMap(([id, p]) => p.repo && p.intakeEnabled !== false ? [{
    ...bindProject(config, id), repo: p.repo.toLowerCase(),
    labels: [p.intakeLabel ?? config.intakeLabel, ...(p.projectLabel ? [p.projectLabel] : [])],
  }] : []);
}

export function routeIssue(routes: readonly IntakeRoute[], repo: string, labels: readonly string[]): IntakeRoute | undefined {
  const have = new Set(labels.map((label) => label.toLowerCase()));
  const matches = routes.filter((r) => r.repo.toLowerCase() === repo.toLowerCase() && r.labels.every((label) => have.has(label.toLowerCase())));
  return matches.length === 1 ? matches[0] : undefined;
}
