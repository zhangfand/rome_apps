import {
  createConfigParser,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_DECISIONS_PER_TURN,
  DEFAULT_MAX_WORKERS,
  DEFAULT_ORCHESTRATOR_AGENT,
  DEFAULT_REUSE_SESSIONS,
  type ConductorConfig,
} from "../core/lib/config.js";
import { DEFAULT_INTAKE_LABEL, DEFAULT_REVIEW_AUTHORS, githubConfigExtensions, githubProject, githubRepo, githubRoot } from "../domain/adapters/github/config.js";
import { defaultWorkRepo, workRepoFor } from "../domain/work-repo.js";
import type { ConfigExtensions } from "../core/lib/config.js";

const PM_AGENT_DESCRIPTION = "Product manager for broad or ambiguous feature requests. Researches the codebase and product precedents, decides defaults, and writes a bounded, implementation-ready spec in the project's agent work repo. Use before coding when scope or user-visible behavior is not clear; if it returns questions, ask the person and resume the same worker.";
const LEGACY_ORCHESTRATOR_AGENT = "conductor:orchestrator";

export interface FrontdeskShadowConfig {
  enabled: boolean;
  model: string;
}

export const DEFAULT_FRONTDESK_SHADOW: FrontdeskShadowConfig = {
  enabled: true,
  model: "jev-latest",
};

const LEGACY_DEFAULT_WORKER_AGENTS: Record<string, string> = {
  "coding:coding": "Writes code in the task's worktree: implements, tests, commits, pushes, opens pull requests. Has a shell and git.",
  "assistant:assistant": "General assistant with web and shell access. Good for research, reading external state (e.g. a PR's review/CI status), reviewing, and writing summaries.",
};

export const DEFAULT_WORKER_AGENTS: Record<string, string> = {
  "conductor:pm": PM_AGENT_DESCRIPTION,
  ...LEGACY_DEFAULT_WORKER_AGENTS,
  "assistant:assistant": "General assistant with web and shell access. Good for research, reading external state (e.g. a PR's review/CI status), handling production review feedback through the repository's respond-to-review skill, and writing summaries. It does not independently review code or process prototype review feedback.",
};

const parseConfig = createConfigParser(
  { workerAgents: DEFAULT_WORKER_AGENTS, workspaceKinds: ["git-worktree", "none"], defaultWorkspaceKind: "git-worktree" },
  appConfigExtensions(),
);

/** Add the PM worker to installs that still carry the exact pre-PM defaults. */
export function parseAppConfig(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return parseConfig(raw);
  const value = raw as Record<string, unknown>;
  const workers = value.workerAgents;
  const migrated = { ...value };
  if (workers && typeof workers === "object" && !Array.isArray(workers) && sameRecord(workers as Record<string, unknown>, LEGACY_DEFAULT_WORKER_AGENTS)) {
    migrated.workerAgents = DEFAULT_WORKER_AGENTS;
  }
  if (migrated.orchestratorAgent === LEGACY_ORCHESTRATOR_AGENT) {
    migrated.orchestratorAgent = DEFAULT_ORCHESTRATOR_AGENT;
  }
  return parseConfig(migrated);
}

/** UI-only defaults for an install that has not persisted settings yet. */
export const initialAppConfig: ConductorConfig = {
  projects: {},
  workerAgents: DEFAULT_WORKER_AGENTS,
  orchestratorAgent: DEFAULT_ORCHESTRATOR_AGENT,
  maxWorkers: DEFAULT_MAX_WORKERS,
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  reuseSessions: DEFAULT_REUSE_SESSIONS,
  maxDecisionsPerTurn: DEFAULT_MAX_DECISIONS_PER_TURN,
  frontdeskShadow: DEFAULT_FRONTDESK_SHADOW,
  github: { intakeLabel: DEFAULT_INTAKE_LABEL, reviewAuthors: [...DEFAULT_REVIEW_AUTHORS] },
};

export const setupSchema = {
  projectDescription: "Named projects. Each has workingDir, optional workspace, and optional GitHub settings. Legacy GitHub fields at project level remain accepted for one release.",
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
    workRepo: {
      type: "object",
      additionalProperties: false,
      properties: {
        repo: { type: "string" },
        workingDir: { type: "string" },
      },
    },
    // One-release compatibility input shape.
    repo: { type: "string" },
    intakeEnabled: { type: "boolean" },
    intakeLabel: { type: "string" },
    projectLabel: { type: "string" },
  },
  rootProperties: {
    workRepoOwner: {
      type: "string",
      description: "Default GitHub owner for per-project agent work repositories (for example, zhangfand).",
    },
    github: {
      type: "object",
      additionalProperties: false,
      properties: {
        intakeLabel: { type: "string", description: `Default intake label. Defaults to "${DEFAULT_INTAKE_LABEL}".` },
        reviewAuthors: {
          type: "array",
          minItems: 1,
          items: { type: "string" },
          description: "Only code-review events authored by these GitHub logins enter the task ledger.",
        },
      },
    },
    intakeLabel: { type: "string", description: "Legacy default intake label; accepted for one release." },
    frontdeskShadow: {
      type: "object",
      additionalProperties: false,
      description: "Compare Jev's front-desk routing decision with the existing LLM without changing behavior. Add TYPESAFE_API_KEY from Conductor's Shadow page or the Rome process environment.",
      properties: {
        enabled: { type: "boolean" },
        model: { type: "string" },
      },
    },
  },
};

export function githubPresentation(project: Parameters<typeof githubProject>[0], config?: ConductorConfig): { repo?: string; subtitle?: string; workRepo?: { repo: string; url: string }; sourceEnabled?: boolean; sourceLabel?: string; sourceValue?: string; emptySubtitle?: string } {
  const github = githubProject(project);
  const repo = githubRepo(project);
  const workRepo = workRepoFor(project);
  const workRepoLink = workRepo ? { repo: workRepo.repo, url: `https://github.com/${workRepo.repo}` } : undefined;
  if (!repo) return { workRepo: workRepoLink, sourceLabel: "intake", emptySubtitle: "no repository · chat intake only" };
  const labels = [github?.intakeLabel ?? (config ? githubRoot(config).intakeLabel : DEFAULT_INTAKE_LABEL), github?.projectLabel].filter(Boolean);
  return {
    repo,
    subtitle: `${repo} · ${labels.length === 1 ? "label" : "labels"} ${labels.map((label) => `“${label}”`).join(" + ")}`,
    workRepo: workRepoLink,
    sourceEnabled: github?.enabled !== false,
    sourceLabel: "intake",
    sourceValue: labels.join(" + "),
    emptySubtitle: "no repository · chat intake only",
  };
}

function appConfigExtensions(): ConfigExtensions {
  return {
    project(id, raw, root) {
      const github = githubConfigExtensions.project?.(id, raw, root) ?? { ok: true as const };
      if (!github.ok) return github;

      const nested = raw.workRepo;
      if (nested !== undefined && (!nested || typeof nested !== "object" || Array.isArray(nested))) {
        return { ok: false, error: `projects.${id}.workRepo must be an object` };
      }
      const supplied = (nested ?? {}) as Record<string, unknown>;
      const parsedGithub = github.values?.github as { repo?: string } | undefined;
      const owner = parseWorkRepoOwner(root.workRepoOwner);
      const derived = defaultWorkRepo(id, parsedGithub?.repo, typeof raw.workingDir === "string" ? raw.workingDir : undefined, owner);
      const repoRaw = supplied.repo ?? derived?.repo;
      const workingDirRaw = supplied.workingDir ?? derived?.workingDir;
      const candidate = workRepoFor({ workRepo: { repo: repoRaw, workingDir: workingDirRaw } });
      if ((repoRaw !== undefined || workingDirRaw !== undefined) && !candidate) {
        return { ok: false, error: `projects.${id}.workRepo requires an owner/name repo and an absolute workingDir` };
      }
      return { ok: true, values: { ...(github.values ?? {}), ...(candidate ? { workRepo: candidate } : {}) } };
    },
    root(raw) {
      const github = githubConfigExtensions.root?.(raw) ?? { ok: true as const };
      if (!github.ok) return github;
      const owner = raw.workRepoOwner;
      if (owner !== undefined && !parseWorkRepoOwner(owner)) {
        return { ok: false, error: "workRepoOwner must be a GitHub owner name" };
      }
      const frontdeskShadow = parseFrontdeskShadow(raw.frontdeskShadow);
      if (!frontdeskShadow.ok) return frontdeskShadow;
      return {
        ok: true,
        values: {
          ...(github.values ?? {}),
          ...(owner !== undefined ? { workRepoOwner: parseWorkRepoOwner(owner) } : {}),
          frontdeskShadow: frontdeskShadow.value,
        },
      };
    },
    validate: githubConfigExtensions.validate,
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
      if (value === null) {
        delete projects[id];
        continue;
      }
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
        ...(projectPatch.workRepo !== undefined ? {
          workRepo: projectPatch.workRepo && typeof projectPatch.workRepo === "object" && !Array.isArray(projectPatch.workRepo)
            ? { ...objectValue(projectCurrent.workRepo), ...projectPatch.workRepo as Record<string, unknown> }
            : projectPatch.workRepo,
        } : {}),
      };
    }
    merged.projects = projects;
    if (typeof merged.defaultProject === "string" && !Object.hasOwn(projects, merged.defaultProject)) delete merged.defaultProject;
  }
  return merged;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sameRecord(actual: Record<string, unknown>, expected: Record<string, string>): boolean {
  const keys = Object.keys(actual);
  return keys.length === Object.keys(expected).length && keys.every((key) => actual[key] === expected[key]);
}

function parseWorkRepoOwner(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const owner = value.trim();
  return owner && /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/.test(owner) ? owner : undefined;
}

function parseFrontdeskShadow(value: unknown): { ok: true; value: FrontdeskShadowConfig } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: DEFAULT_FRONTDESK_SHADOW };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "frontdeskShadow must be an object" };
  }
  const raw = value as Record<string, unknown>;
  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") {
    return { ok: false, error: "frontdeskShadow.enabled must be a boolean" };
  }
  if (raw.model !== undefined && (typeof raw.model !== "string" || !/^[A-Za-z0-9._-]+$/.test(raw.model))) {
    return { ok: false, error: "frontdeskShadow.model must be a model id using letters, numbers, dots, underscores, or hyphens" };
  }
  return {
    ok: true,
    value: {
      enabled: raw.enabled ?? DEFAULT_FRONTDESK_SHADOW.enabled,
      model: typeof raw.model === "string" ? raw.model : DEFAULT_FRONTDESK_SHADOW.model,
    },
  };
}
