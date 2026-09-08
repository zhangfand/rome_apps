import path from "node:path";
import type { ManagerConfig } from "./config.js";
import type { Fact, NewFact } from "./facts.js";
import { fold, type TaskView } from "./fold.js";

export interface ProjectConfig {
  workingDir: string;
  repo?: string;
  intakeEnabled?: boolean;
  intakeLabel?: string;
  projectLabel?: string;
}

/** Copied into the ledger, not a pointer to mutable settings. */
export interface ProjectBinding {
  projectId: string;
  project: { workingDir: string; repo?: string };
}

export function configuredProjects(config: ManagerConfig): Record<string, ProjectConfig> {
  return config.projects ?? { default: { workingDir: config.workingDir } };
}

export function bindProject(config: ManagerConfig, projectId: string): ProjectBinding {
  const projects = configuredProjects(config);
  if (!Object.hasOwn(projects, projectId)) throw new Error(`Unknown project ${JSON.stringify(projectId)}. Choose: ${Object.keys(projects).join(", ")}`);
  const { workingDir, repo } = projects[projectId];
  return { projectId, project: { workingDir, ...(repo ? { repo } : {}) } };
}

/** Explicit choice wins. A selected chat path must map exactly; never fuzzy-match a repo. */
export function resolveHumanProject(config: ManagerConfig, input: {
  projectId?: string; projectPath?: string; projectName?: string;
}): ProjectBinding {
  if (input.projectId) return bindProject(config, input.projectId);
  const projects = configuredProjects(config);
  const entries = Object.entries(projects);
  if (input.projectPath) {
    const matches = entries.filter(([, p]) => path.normalize(p.workingDir) === path.normalize(input.projectPath!));
    if (matches.length === 1) return bindProject(config, matches[0][0]);
    if (matches.length > 1) throw new Error("Selected chat directory maps to multiple projects; pass projectId explicitly.");
    // A selected but unmapped directory must not silently fall through to a different repo.
    throw new Error("Selected chat project is not mapped; pass a configured projectId explicitly.");
  }
  if (input.projectName && Object.hasOwn(projects, input.projectName)) return bindProject(config, input.projectName);
  if (entries.length === 1) return bindProject(config, entries[0][0]);
  throw new Error(`Task project is ambiguous. Ask which project, then pass projectId: ${entries.map(([id]) => id).join(", ")}`);
}

export interface IntakeRoute extends ProjectBinding { repo: string; labels: string[] }
export function intakeRoutes(config: ManagerConfig): IntakeRoute[] {
  if (!config.projects) return config.intakeRepos.map((repo) => ({
    ...bindProject(config, "default"), repo: repo.toLowerCase(), labels: [config.intakeLabel],
  }));
  return Object.entries(config.projects).flatMap(([id, p]) => p.repo && p.intakeEnabled !== false ? [{
    ...bindProject(config, id), repo: p.repo.toLowerCase(),
    labels: [p.intakeLabel ?? config.intakeLabel, ...(p.projectLabel ? [p.projectLabel] : [])],
  }] : []);
}

export function routeIssue(routes: readonly IntakeRoute[], repo: string, labels: readonly string[]): IntakeRoute | undefined {
  const have = new Set(labels.map((label) => label.toLowerCase()));
  const matches = routes.filter((r) => r.repo.toLowerCase() === repo.toLowerCase() &&
    r.labels.every((label) => have.has(label.toLowerCase())));
  // Both no match and multiple matches are fail-closed. Re-labeling can resolve either next tick.
  return matches.length === 1 ? matches[0] : undefined;
}

/** Called under the reconcile lock, before changing settings or taking in work. */
export function legacyBindingFacts(facts: readonly Fact[], config: ManagerConfig): NewFact[] {
  const fallback = () => bindProject(config, config.defaultProject ?? Object.keys(configuredProjects(config))[0]);
  return fold(new Date(), facts).tasks.flatMap((task) => {
    if (task.projectId && task.project) return [];
    // Legacy tasks all used the old global directory, even when their issue belonged elsewhere.
    // If a partial binding exists, resolve that id, never a new default.
    const binding = task.projectId ? bindProject(config, task.projectId) : fallback();
    return [{ taskId: task.id, kind: "Bound", by: "runtime",
      source: "manager: migrating legacy task to a durable project binding", payload: binding }];
  });
}

export function configForTask(config: ManagerConfig, task: Pick<TaskView, "projectId" | "project">): ManagerConfig {
  if (task.project) return { ...config, workingDir: task.project.workingDir };
  // Compatibility for pure legacy callers/tests. Runtime migrates before scheduling.
  if (config.projects) throw new Error("Task has no durable project binding; refusing to choose a repository at launch");
  return config;
}
