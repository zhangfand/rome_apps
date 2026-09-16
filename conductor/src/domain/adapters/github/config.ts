import type { ConfigExtensions, ConductorConfig } from "../../../core/lib/config.js";
import { bindProject, type ProjectBinding, type ProjectConfig } from "../../../core/lib/projects.js";
import type { TaskView } from "../../../core/lib/fold.js";

export const DEFAULT_INTAKE_LABEL = "conductor";

export interface GitHubProjectConfig {
  repo: string;
  intakeLabel?: string;
  projectLabel?: string;
  enabled?: boolean;
}

export interface GitHubRootConfig {
  intakeLabel: string;
}

const REPO_RE = /^(?!\.{1,2}\/)(?!.*\/\.{1,2}$)[\w.-]+\/[\w.-]+$/;

export function parseRepo(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const repo = raw.trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^ssh:\/\/git@github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  return REPO_RE.test(repo) ? repo : undefined;
}

export function githubProject(project: ProjectConfig | ProjectBinding["project"] | undefined): GitHubProjectConfig | undefined {
  const value = project?.github;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as unknown as GitHubProjectConfig;
}

/** Repository for current bindings, with old Created.project.repo compatibility. */
export function githubRepo(project: ProjectConfig | ProjectBinding["project"] | undefined): string | undefined {
  return githubProject(project)?.repo ?? parseRepo(project?.repo);
}

/** Domain-owned repository note injected into otherwise generic core prompts. */
export function githubPromptNote(task: TaskView, audience: "worker" | "orchestrator"): string {
  const repo = githubRepo(task.project);
  if (!repo) return "";
  return audience === "worker" ? ` (repository ${repo})` : ` (GitHub ${repo})`;
}

export function githubRoot(config: ConductorConfig): GitHubRootConfig {
  const value = config.github;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as unknown as GitHubRootConfig
    : { intakeLabel: DEFAULT_INTAKE_LABEL };
}

/** New shape wins field-by-field; legacy fields remain accepted for one release. */
export const githubConfigExtensions: ConfigExtensions = {
  project(id, raw) {
    const nested = raw.github;
    if (nested !== undefined && (!nested || typeof nested !== "object" || Array.isArray(nested))) {
      return { ok: false, error: `projects.${id}.github must be an object` };
    }
    const g = (nested ?? {}) as Record<string, unknown>;
    const rawRepo = g.repo ?? raw.repo;
    if (rawRepo === undefined || rawRepo === "") return { ok: true };
    const repo = parseRepo(rawRepo);
    if (!repo) return { ok: false, error: `projects.${id}.github.repo must be owner/name` };
    const intakeLabel = stringValue(g.intakeLabel ?? raw.intakeLabel);
    const projectLabel = stringValue(g.projectLabel ?? raw.projectLabel);
    const enabledRaw = g.enabled ?? raw.intakeEnabled;
    if (enabledRaw !== undefined && typeof enabledRaw !== "boolean") {
      return { ok: false, error: `projects.${id}.github.enabled must be a boolean` };
    }
    return {
      ok: true,
      values: {
        github: {
          repo,
          ...(intakeLabel ? { intakeLabel } : {}),
          ...(projectLabel ? { projectLabel } : {}),
          ...(typeof enabledRaw === "boolean" ? { enabled: enabledRaw } : {}),
        } satisfies GitHubProjectConfig,
      },
    };
  },
  root(raw) {
    const nested = raw.github;
    if (nested !== undefined && (!nested || typeof nested !== "object" || Array.isArray(nested))) {
      return { ok: false, error: "github must be an object" };
    }
    const g = (nested ?? {}) as Record<string, unknown>;
    return { ok: true, values: { github: { intakeLabel: stringValue(g.intakeLabel ?? raw.intakeLabel) ?? DEFAULT_INTAKE_LABEL } satisfies GitHubRootConfig } };
  },
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export interface IntakeRoute extends ProjectBinding { repo: string; labels: string[] }

export function intakeRoutes(config: ConductorConfig): IntakeRoute[] {
  const defaultLabel = githubRoot(config).intakeLabel;
  return Object.entries(config.projects).flatMap(([id, project]) => {
    const github = githubProject(project);
    return github && github.enabled !== false ? [{
      ...bindProject(config, id),
      repo: github.repo.toLowerCase(),
      labels: [github.intakeLabel ?? defaultLabel, ...(github.projectLabel ? [github.projectLabel] : [])],
    }] : [];
  });
}

export function routeIssue(routes: readonly IntakeRoute[], repo: string, labels: readonly string[]): IntakeRoute | undefined {
  const have = new Set(labels.map((label) => label.toLowerCase()));
  const matches = routes.filter((route) => route.repo.toLowerCase() === repo.toLowerCase() && route.labels.every((label) => have.has(label.toLowerCase())));
  return matches.length === 1 ? matches[0] : undefined;
}

export function githubPerson(login: string): string {
  return `github:${login}`;
}
