import type { ProjectConfig } from "./projects.js";
import { DEFAULT_SOP } from "./sop.js";

/** Everything `conductor:setup` stores and every action reads back. */
export interface ConductorConfig {
  /** Named projects. A task is bound to exactly one. */
  projects: Record<string, ProjectConfig>;
  defaultProject?: string;
  /**
   * The standard operating procedure the orchestrator follows for a task, as
   * prose. This is the workflow: which steps a task goes through, when to ask
   * a person, when it is done. Projects may override it.
   */
  sop: string;
  /** Agents the orchestrator may dispatch a worker as, with a line on what each is for. */
  workerAgents: Record<string, string>;
  /** Canonical id of the orchestrator agent. */
  orchestratorAgent: string;
  /** Workers allowed to run at once, across every task. */
  maxWorkers: number;
  /** How often the tick routine fires. */
  intervalMinutes: number;
  /** Whether a follow-up worker may continue an earlier worker's session. */
  reuseSessions: boolean;
  /** Default label an issue must carry to be taken in. */
  intakeLabel: string;
  /**
   * Safety valve, not workflow: how many orchestrator decisions a task may
   * take since a person last spoke before the runtime stops waking it and
   * records an Event asking for a person.
   */
  maxDecisionsPerTurn: number;
}

export const DEFAULT_WORKER_AGENTS: Record<string, string> = {
  "coding:coding": "Writes code in the task's worktree: implements, tests, commits, pushes, opens pull requests. Has a shell and git.",
  "assistant:assistant": "General assistant with web and shell access. Good for research, reading external state (e.g. a PR's review/CI status), reviewing, and writing summaries.",
};
export const DEFAULT_ORCHESTRATOR_AGENT = "conductor:orchestrator";
export const DEFAULT_MAX_WORKERS = 3;
export const DEFAULT_INTERVAL_MINUTES = 5;
export const DEFAULT_REUSE_SESSIONS = true;
export const DEFAULT_INTAKE_LABEL = "conductor";
export const DEFAULT_MAX_DECISIONS_PER_TURN = 25;

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export function parseRepo(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const repo = raw.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
  return REPO_RE.test(repo) ? repo : undefined;
}

export const CONFIG_KEY = "conductor_config";
export const TICK_ROUTINE_KEY = "conductor-tick";
export const TICK_ROUTINE_NAME = "Conductor: tick";

export type ParseConfigResult = { ok: true; config: ConductorConfig } | { ok: false; error: string };

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function parseConfig(raw: unknown): ParseConfigResult {
  const args = (raw ?? {}) as Record<string, unknown>;
  if (!args.projects || typeof args.projects !== "object" || Array.isArray(args.projects) || !Object.keys(args.projects).length) {
    return { ok: false, error: "projects must be a nonempty map of project id to configuration" };
  }
  const projects: Record<string, ProjectConfig> = {};
  for (const [id, rawProject] of Object.entries(args.projects)) {
    if (!/^[a-z][a-z0-9_-]*$/.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) return { ok: false, error: `Invalid project id: ${id}` };
    if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) return { ok: false, error: `Invalid project: ${id}` };
    const p = rawProject as Record<string, unknown>;
    if (typeof p.workingDir !== "string" || !p.workingDir.trim().startsWith("/") || p.workingDir.includes("\0")) return { ok: false, error: `projects.${id}.workingDir must be an absolute path` };
    const repo = p.repo === undefined || p.repo === "" ? undefined : parseRepo(p.repo);
    if (p.repo !== undefined && p.repo !== "" && !repo) return { ok: false, error: `projects.${id}.repo must be owner/name` };
    projects[id] = {
      workingDir: p.workingDir.trim(),
      ...(repo ? { repo } : {}),
      ...(typeof p.intakeEnabled === "boolean" ? { intakeEnabled: p.intakeEnabled } : {}),
      ...(typeof p.intakeLabel === "string" && p.intakeLabel.trim() ? { intakeLabel: p.intakeLabel.trim() } : {}),
      ...(typeof p.projectLabel === "string" && p.projectLabel.trim() ? { projectLabel: p.projectLabel.trim() } : {}),
      ...(typeof p.sop === "string" && p.sop.trim() ? { sop: p.sop } : {}),
    };
  }
  const repoLabels = new Map<string, Set<string>>();
  for (const [id, p] of Object.entries(projects)) {
    if (!p.repo) continue;
    const key = `${p.repo.toLowerCase()}|${p.projectLabel ?? ""}`;
    if (repoLabels.has(key)) return { ok: false, error: `projects sharing repo ${p.repo} need distinct projectLabels (${id})` };
    repoLabels.set(key, new Set());
  }
  const defaultProject = typeof args.defaultProject === "string" && args.defaultProject.trim() ? args.defaultProject.trim() : undefined;
  if (defaultProject && !Object.hasOwn(projects, defaultProject)) return { ok: false, error: `defaultProject ${defaultProject} is not a configured project` };

  let workerAgents = DEFAULT_WORKER_AGENTS;
  if (args.workerAgents !== undefined) {
    if (!args.workerAgents || typeof args.workerAgents !== "object" || Array.isArray(args.workerAgents)) return { ok: false, error: "workerAgents must be a map of agent id to description" };
    workerAgents = {};
    for (const [agent, description] of Object.entries(args.workerAgents)) {
      if (!/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(agent)) return { ok: false, error: `workerAgents: ${agent} is not an app:agent id` };
      workerAgents[agent] = typeof description === "string" ? description : "";
    }
    if (!Object.keys(workerAgents).length) return { ok: false, error: "workerAgents must name at least one agent" };
  }

  return {
    ok: true,
    config: {
      projects,
      ...(defaultProject ? { defaultProject } : {}),
      sop: typeof args.sop === "string" && args.sop.trim() ? args.sop : DEFAULT_SOP,
      workerAgents,
      orchestratorAgent: typeof args.orchestratorAgent === "string" && args.orchestratorAgent.trim() ? args.orchestratorAgent.trim() : DEFAULT_ORCHESTRATOR_AGENT,
      maxWorkers: positiveInt(args.maxWorkers, DEFAULT_MAX_WORKERS, 50),
      intervalMinutes: positiveInt(args.intervalMinutes, DEFAULT_INTERVAL_MINUTES, 24 * 60),
      reuseSessions: typeof args.reuseSessions === "boolean" ? args.reuseSessions : DEFAULT_REUSE_SESSIONS,
      intakeLabel: typeof args.intakeLabel === "string" && args.intakeLabel.trim() ? args.intakeLabel.trim() : DEFAULT_INTAKE_LABEL,
      maxDecisionsPerTurn: positiveInt(args.maxDecisionsPerTurn, DEFAULT_MAX_DECISIONS_PER_TURN, 1000),
    },
  };
}

/** The routine trigger for a given cadence. */
export function tickTrigger(intervalMinutes: number): Record<string, unknown> {
  return { type: "schedule", tzid: "UTC", tzMode: "floating", localTime: "00:00", rrule: `FREQ=MINUTELY;INTERVAL=${intervalMinutes}` };
}

/** The SOP that applies to a task's project. */
export function sopFor(config: ConductorConfig, projectId: string | undefined): string {
  const project = projectId ? config.projects[projectId] : undefined;
  return project?.sop?.trim() ? project.sop : config.sop;
}
