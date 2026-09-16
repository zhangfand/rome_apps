import { createConfigParser, type ConductorConfig } from "../core/lib/config.js";
import { DEFAULT_SOP } from "../domain/sop.js";
import { DEFAULT_INTAKE_LABEL, githubConfigExtensions, githubProject, githubRepo, githubRoot } from "../domain/adapters/github/config.js";

export const DEFAULT_WORKER_AGENTS: Record<string, string> = {
  "coding:coding": "Writes code in the task's worktree: implements, tests, commits, pushes, opens pull requests. Has a shell and git.",
  "assistant:assistant": "General assistant with web and shell access. Good for research, reading external state (e.g. a PR's review/CI status), reviewing, and writing summaries.",
};

export const parseAppConfig = createConfigParser(
  { sop: DEFAULT_SOP, workerAgents: DEFAULT_WORKER_AGENTS, workspaceKinds: ["git-worktree", "none"], defaultWorkspaceKind: "git-worktree" },
  githubConfigExtensions,
);

export const setupSchema = {
  projectDescription: "Named projects. Each has workingDir, optional workspace, optional github settings, and a project SOP override. Legacy GitHub fields at project level remain accepted for one release.",
  projectProperties: {
    github: {
      type: "object",
      additionalProperties: false,
      properties: {
        repo: { type: "string" },
        intakeLabel: { type: "string" },
        projectLabel: { type: "string" },
        enabled: { type: "boolean" },
      },
    },
    // One-release compatibility input shape.
    repo: { type: "string" },
    intakeEnabled: { type: "boolean" },
    intakeLabel: { type: "string" },
    projectLabel: { type: "string" },
  },
  rootProperties: {
    github: {
      type: "object",
      additionalProperties: false,
      properties: { intakeLabel: { type: "string", description: `Default intake label. Defaults to "${DEFAULT_INTAKE_LABEL}".` } },
    },
    intakeLabel: { type: "string", description: "Legacy default intake label; accepted for one release." },
  },
};

export function githubPresentation(project: Parameters<typeof githubProject>[0], config?: ConductorConfig): { repo?: string; subtitle?: string; sourceEnabled?: boolean; sourceLabel?: string; emptySubtitle?: string } {
  const github = githubProject(project);
  const repo = githubRepo(project);
  if (!repo) return { sourceLabel: "intake", emptySubtitle: "no repository · chat intake only" };
  const labels = [github?.intakeLabel ?? (config ? githubRoot(config).intakeLabel : DEFAULT_INTAKE_LABEL), github?.projectLabel].filter(Boolean);
  return {
    repo,
    subtitle: `${repo} · ${labels.length === 1 ? "label" : "labels"} ${labels.map((label) => `“${label}”`).join(" + ")}`,
    sourceEnabled: github?.enabled !== false,
    sourceLabel: "intake",
    emptySubtitle: "no repository · chat intake only",
  };
}

/** Merge a PATCH while translating one-release GitHub aliases before parsing. */
export function mergeAppConfig(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, ...patch };
  const currentRoot = objectValue(current.github);
  const patchRoot = objectValue(patch.github);
  if (patch.github !== undefined || patch.intakeLabel !== undefined) {
    merged.github = {
      ...currentRoot,
      ...(patch.intakeLabel !== undefined ? { intakeLabel: patch.intakeLabel } : {}),
      ...patchRoot,
    };
  }
  if (patch.projects && typeof patch.projects === "object" && !Array.isArray(patch.projects)) {
    const projects = { ...(current.projects as Record<string, unknown> ?? {}) };
    for (const [id, value] of Object.entries(patch.projects as Record<string, unknown>)) {
      const projectPatch = objectValue(value);
      const projectCurrent = objectValue(projects[id]);
      const githubCurrent = objectValue(projectCurrent.github);
      const githubPatch = objectValue(projectPatch.github);
      const legacy: Record<string, unknown> = {};
      if (projectPatch.repo !== undefined) legacy.repo = projectPatch.repo;
      if (projectPatch.intakeLabel !== undefined) legacy.intakeLabel = projectPatch.intakeLabel;
      if (projectPatch.projectLabel !== undefined) legacy.projectLabel = projectPatch.projectLabel;
      if (projectPatch.intakeEnabled !== undefined) legacy.enabled = projectPatch.intakeEnabled;
      projects[id] = {
        ...projectCurrent,
        ...projectPatch,
        ...((projectPatch.github !== undefined || Object.keys(legacy).length) ? { github: { ...githubCurrent, ...legacy, ...githubPatch } } : {}),
      };
    }
    merged.projects = projects;
  }
  return merged;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
