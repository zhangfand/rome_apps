import type { ProjectConfig } from "./projects.js";
import type { WorkspaceKind } from "./workspaces.js";

/** Core configuration plus opaque, app-owned extension fields. */
export interface ConductorConfig {
  projects: Record<string, ProjectConfig>;
  defaultProject?: string;
  workerAgents: Record<string, string>;
  orchestratorAgent: string;
  maxWorkers: number;
  intervalMinutes: number;
  reuseSessions: boolean;
  maxDecisionsPerTurn: number;
  /** Minutes without a wrapper heartbeat before a worker run is declared Lost. */
  heartbeatLeaseMinutes: number;
  [extension: string]: unknown;
}

export interface ConfigDefaults {
  workerAgents: Record<string, string>;
  workspaceKinds: readonly WorkspaceKind[];
  defaultWorkspaceKind: WorkspaceKind;
}

export type ExtensionResult =
  | { ok: true; values?: Record<string, unknown> }
  | { ok: false; error: string };

/** App/domain hook for validating and normalizing opaque extension fields. */
export interface ConfigExtensions {
  project?(id: string, rawProject: Record<string, unknown>, rawConfig: Record<string, unknown>): ExtensionResult;
  root?(rawConfig: Record<string, unknown>): ExtensionResult;
  validate?(config: ConductorConfig): string | undefined;
}

export type ParseConfigResult = { ok: true; config: ConductorConfig } | { ok: false; error: string };
export type ConfigParser = (raw: unknown) => ParseConfigResult;

export const DEFAULT_ORCHESTRATOR_AGENT = "conductor:engineer-lead";
export const DEFAULT_MAX_WORKERS = 3;
export const DEFAULT_INTERVAL_MINUTES = 5;
export const DEFAULT_REUSE_SESSIONS = true;
export const DEFAULT_MAX_DECISIONS_PER_TURN = 25;
export const DEFAULT_HEARTBEAT_LEASE_MINUTES = 3;
export const CONFIG_KEY = "conductor_config";
export const TICK_ROUTINE_KEY = "conductor-tick";
export const TICK_ROUTINE_NAME = "Conductor: reconcile tasks";

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function createConfigParser(defaults: ConfigDefaults, extensions: ConfigExtensions = {}): ConfigParser {
  return (raw) => parseConfig(raw, defaults, extensions);
}

/** Parse the domain-neutral runtime fields, delegating all app fields. */
export function parseConfig(raw: unknown, defaults: ConfigDefaults, extensions: ConfigExtensions = {}): ParseConfigResult {
  const args = (raw ?? {}) as Record<string, unknown>;
  if (!args.projects || typeof args.projects !== "object" || Array.isArray(args.projects) || !Object.keys(args.projects).length) {
    return { ok: false, error: "projects must be a nonempty map of project id to configuration" };
  }
  const projects: Record<string, ProjectConfig> = {};
  for (const [id, rawProject] of Object.entries(args.projects)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) return { ok: false, error: `Invalid project id: ${id}` };
    if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) return { ok: false, error: `Invalid project: ${id}` };
    const p = rawProject as Record<string, unknown>;
    const workspace = p.workspace === undefined || p.workspace === ""
      ? defaults.defaultWorkspaceKind
      : defaults.workspaceKinds.includes(String(p.workspace)) ? String(p.workspace) as WorkspaceKind : undefined;
    if (!workspace) return { ok: false, error: `projects.${id}.workspace must be one of: ${defaults.workspaceKinds.join(", ")}` };
    const hasDir = typeof p.workingDir === "string" && p.workingDir.trim() !== "";
    if (hasDir && (!(p.workingDir as string).trim().startsWith("/") || (p.workingDir as string).includes("\0"))) {
      return { ok: false, error: `projects.${id}.workingDir must be an absolute path` };
    }
    if (!hasDir && workspace !== "none") {
      return { ok: false, error: `projects.${id}.workingDir must be an absolute path (omit it only when workspace is "none")` };
    }
    const extension = extensions.project?.(id, p, args) ?? { ok: true as const };
    if (!extension.ok) return extension;
    projects[id] = {
      ...(hasDir ? { workingDir: (p.workingDir as string).trim() } : {}),
      workspace,
      ...(extension.values ?? {}),
    };
  }

  const defaultProject = typeof args.defaultProject === "string" && args.defaultProject.trim() ? args.defaultProject.trim() : undefined;
  if (defaultProject && !Object.hasOwn(projects, defaultProject)) return { ok: false, error: `defaultProject ${defaultProject} is not a configured project` };

  let workerAgents = { ...defaults.workerAgents };
  if (args.workerAgents !== undefined) {
    if (!args.workerAgents || typeof args.workerAgents !== "object" || Array.isArray(args.workerAgents)) return { ok: false, error: "workerAgents must be a map of agent id to description" };
    workerAgents = {};
    for (const [agent, description] of Object.entries(args.workerAgents)) {
      if (!/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(agent)) return { ok: false, error: `workerAgents: ${agent} is not an app:agent id` };
      workerAgents[agent] = typeof description === "string" ? description : "";
    }
    if (!Object.keys(workerAgents).length) return { ok: false, error: "workerAgents must name at least one agent" };
  }

  const rootExtension = extensions.root?.(args) ?? { ok: true as const };
  if (!rootExtension.ok) return rootExtension;
  const config: ConductorConfig = {
    projects,
    ...(defaultProject ? { defaultProject } : {}),
    workerAgents,
    orchestratorAgent: typeof args.orchestratorAgent === "string" && args.orchestratorAgent.trim() ? args.orchestratorAgent.trim() : DEFAULT_ORCHESTRATOR_AGENT,
    maxWorkers: positiveInt(args.maxWorkers, DEFAULT_MAX_WORKERS, 50),
    intervalMinutes: positiveInt(args.intervalMinutes, DEFAULT_INTERVAL_MINUTES, 24 * 60),
    reuseSessions: typeof args.reuseSessions === "boolean" ? args.reuseSessions : DEFAULT_REUSE_SESSIONS,
    maxDecisionsPerTurn: positiveInt(args.maxDecisionsPerTurn, DEFAULT_MAX_DECISIONS_PER_TURN, 1000),
    heartbeatLeaseMinutes: positiveInt(args.heartbeatLeaseMinutes, DEFAULT_HEARTBEAT_LEASE_MINUTES, 24 * 60),
    ...(rootExtension.values ?? {}),
  };
  const extensionError = extensions.validate?.(config);
  return extensionError ? { ok: false, error: extensionError } : { ok: true, config };
}

export function tickTrigger(intervalMinutes: number): Record<string, unknown> {
  return { type: "schedule", tzid: "UTC", tzMode: "floating", localTime: "00:00", rrule: `FREQ=MINUTELY;INTERVAL=${intervalMinutes}` };
}
