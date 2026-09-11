import path from "node:path";
import { parseHooks, type LifecycleHooks } from "./lifecycle.js";
import type { ProjectConfig } from "./projects.js";

/** Everything `manager:setup` stores and every action reads back. */
export interface ManagerConfig {
  projects?: Record<string, ProjectConfig>;
  /** User-defined optional preparation and assessment, pinned on new tasks. */
  hooks?: LifecycleHooks;
  defaultProject?: string;
  /** Absolute source directory; workers use the same relative path in isolated Git worktrees. */
  workingDir: string;
  /** Canonical id of the agent a worker runs. */
  workerAgent: string;
  /** Failed-run budget: starts since the last person fact or successful deferral before the runtime asks. */
  startCap: number;
  /** Workers allowed to be running at once, across every task. */
  maxWorkers: number;
  /** Hours a worker may be silent before the runtime declares it Lost. */
  ageCapHours: number;
  /** How often the reconcile routine fires. */
  intervalMinutes: number;
  /**
   * Whether a follow-up worker continues the last worker's session instead of
   * starting cold. Keeps the prior context and the provider's prompt cache
   * warm; off restores a fresh session for every start.
   */
  reuseSessions: boolean;
  /**
   * Whether an open task ends when the GitHub issue(s) named in its brief
   * close — Completed if closed as done, Cancelled if closed as not planned.
   * Polled on every reconcile pass through `connector_proxy`; off means only
   * a person ends a task.
   */
  closeOnIssueClosed: boolean;
  /**
   * Repositories (`owner/name`) whose issues become tasks. Every reconcile
   * pass lists each repo's open issues carrying {@link intakeLabel} and opens
   * a task for any that has none yet. Empty means no GitHub intake.
   */
  intakeRepos: string[];
  /** The label an issue must carry to be taken in. */
  intakeLabel: string;
}

export const DEFAULT_WORKER_AGENT = "coding:coding";
export const DEFAULT_START_CAP = 2;
export const DEFAULT_MAX_WORKERS = 3;
export const DEFAULT_AGE_CAP_HOURS = 3;
export const DEFAULT_INTERVAL_MINUTES = 5;
export const DEFAULT_REUSE_SESSIONS = true;
export const DEFAULT_CLOSE_ON_ISSUE_CLOSED = true;
export const DEFAULT_INTAKE_LABEL = "ready-for-agent";

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * Split a repo list — an array, or one comma/whitespace-separated string —
 * into the `owner/name` entries it names and the ones it does not. `setup`
 * refuses the whole call on any invalid entry, so a typo is caught by the
 * person who made it; the stored config only ever holds valid ones.
 */
export function parseRepoList(raw: unknown): { repos: string[]; invalid: string[] } {
  const items = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(/[\s,]+/)
      : [];
  const repos: string[] = [];
  const invalid: string[] = [];
  for (const item of items) {
    const repo = item.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
    if (!repo) continue;
    if (!REPO_RE.test(repo)) {
      invalid.push(item);
      continue;
    }
    if (!repos.includes(repo)) repos.push(repo);
  }
  return { repos, invalid };
}

/** Key the single config row lives under. */
export const CONFIG_KEY = "manager_config";

/** Stable identity of the routine `manager:setup` owns. */
export const RECONCILE_ROUTINE_KEY = "manager-reconcile";
export const RECONCILE_ROUTINE_NAME = "Manager: reconcile";

export type ParseConfigResult = { ok: true; config: ManagerConfig } | { ok: false; error: string };

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * Project a loose object onto {@link ManagerConfig}. Only `workingDir` has no
 * safe default, so it is the only field that can reject the whole config; a
 * nonsense cap degrades to its default rather than stopping the loop, because
 * the routine that reads this fires unattended.
 */
export function parseConfig(raw: unknown): ParseConfigResult {
  const args = (raw ?? {}) as Record<string, unknown>;
  let hooks: LifecycleHooks | undefined;
  try { hooks = parseHooks(args.hooks); } catch (error) { return { ok: false, error: String(error) }; }
  let projects: Record<string, ProjectConfig> | undefined;
  let defaultProject: string | undefined;
  if (args.projects !== undefined) {
    if (!args.projects || typeof args.projects !== "object" || Array.isArray(args.projects) || !Object.keys(args.projects).length) {
      return { ok: false, error: "projects must be a nonempty map of project id to configuration" };
    }
    projects = {};
    for (const [id, rawProject] of Object.entries(args.projects)) {
      if (!/^[a-z][a-z0-9_-]*$/.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) return { ok: false, error: `Invalid project id: ${id}` };
      if (!rawProject || typeof rawProject !== "object" || Array.isArray(rawProject)) return { ok: false, error: `Invalid project: ${id}` };
      const p = rawProject as Record<string, unknown>;
      if (typeof p.workingDir !== "string" || !p.workingDir.trim().startsWith("/") || p.workingDir.includes("\0")) return { ok: false, error: `projects.${id}.workingDir must be an absolute path` };
      const repo = p.repo === undefined ? undefined : parseRepoList([p.repo]);
      if (repo && (repo.invalid.length || repo.repos.length !== 1)) return { ok: false, error: `projects.${id}.repo must be owner/name` };
      for (const field of ["intakeLabel", "projectLabel"] as const) {
        if (p[field] !== undefined && (typeof p[field] !== "string" || !p[field].trim() || p[field].includes(","))) return { ok: false, error: `projects.${id}.${field} must be one nonblank label (no commas)` };
      }
      if (p.intakeEnabled !== undefined && typeof p.intakeEnabled !== "boolean") return { ok: false, error: `projects.${id}.intakeEnabled must be boolean` };
      let projectHooks: LifecycleHooks | undefined;
      try { projectHooks = parseHooks(p.hooks); } catch (error) { return { ok: false, error: `projects.${id}: ${String(error)}` }; }
      projects[id] = { ...(projectHooks !== undefined ? { hooks: projectHooks } : {}), workingDir: path.normalize(p.workingDir.trim()),
        ...(repo ? { repo: repo.repos[0].toLowerCase() } : {}),
        ...(p.intakeEnabled !== undefined ? { intakeEnabled: p.intakeEnabled as boolean } : {}),
        ...(p.intakeLabel ? { intakeLabel: (p.intakeLabel as string).trim() } : {}),
        ...(p.projectLabel ? { projectLabel: (p.projectLabel as string).trim() } : {}),
      };
    }
    defaultProject = typeof args.defaultProject === "string" ? args.defaultProject : Object.keys(projects)[0];
    if (!Object.hasOwn(projects, defaultProject)) return { ok: false, error: `Unknown defaultProject: ${defaultProject}` };
    if (parseRepoList(args.intakeRepos).repos.length) return { ok: false, error: "Use projects.<id>.repo for intake with projects; do not also set intakeRepos" };
    const watched = Object.entries(projects).filter(([, p]) => p.repo && p.intakeEnabled !== false);
    for (const [id, p] of watched) {
      const siblings = watched.filter(([, other]) => other.repo === p.repo);
      if (siblings.length > 1 && (!p.projectLabel || siblings.some(([otherId, other]) => otherId !== id && other.projectLabel?.toLowerCase() === p.projectLabel?.toLowerCase()))) {
        return { ok: false, error: `Projects sharing ${p.repo} must each have a distinct projectLabel` };
      }
    }
  }
  const workingDir = projects ? projects[defaultProject!].workingDir : typeof args.workingDir === "string" ? args.workingDir.trim() : "";
  if (!workingDir.startsWith("/")) {
    return {
      ok: false,
      error: `workingDir must be an absolute path; got ${JSON.stringify(args.workingDir ?? null)}. Run manager:setup first.`,
    };
  }

  const workerAgent =
    typeof args.workerAgent === "string" && args.workerAgent.trim()
      ? args.workerAgent.trim()
      : DEFAULT_WORKER_AGENT;

  return {
    ok: true,
    config: {
      workingDir,
      ...(hooks !== undefined ? { hooks } : {}),
      ...(projects ? { projects, defaultProject } : {}),
      workerAgent,
      startCap: positiveInt(args.startCap, DEFAULT_START_CAP, 20),
      maxWorkers: positiveInt(args.maxWorkers, DEFAULT_MAX_WORKERS, 20),
      ageCapHours: positiveInt(args.ageCapHours, DEFAULT_AGE_CAP_HOURS, 168),
      intervalMinutes: normalizeIntervalMinutes(args.intervalMinutes),
      reuseSessions: typeof args.reuseSessions === "boolean" ? args.reuseSessions : DEFAULT_REUSE_SESSIONS,
      closeOnIssueClosed:
        typeof args.closeOnIssueClosed === "boolean"
          ? args.closeOnIssueClosed
          : DEFAULT_CLOSE_ON_ISSUE_CLOSED,
      intakeRepos: parseRepoList(args.intakeRepos).repos,
      intakeLabel:
        typeof args.intakeLabel === "string" && args.intakeLabel.trim()
          ? args.intakeLabel.trim()
          : DEFAULT_INTAKE_LABEL,
    },
  };
}

/**
 * Minute cadences that survive Rome's RRULE-to-cron conversion unchanged. The
 * scheduler turns `FREQ=MINUTELY;INTERVAL=n` into a cron step field of n, so an
 * interval that does not divide the hour would drift at every hour boundary.
 */
export const INTERVAL_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30] as const;

/** Snap an arbitrary minute count to the nearest cadence cron reproduces exactly. */
export function normalizeIntervalMinutes(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_INTERVAL_MINUTES;
  let best: number = INTERVAL_OPTIONS[0];
  for (const option of INTERVAL_OPTIONS) {
    if (Math.abs(option - n) < Math.abs(best - n)) best = option;
  }
  return best;
}

/** The schedule trigger `manager:setup` registers for `manager:reconcile`. */
export function reconcileTrigger(intervalMinutes: number): Record<string, unknown> {
  return {
    type: "schedule",
    tzid: "UTC",
    // Floating so the routine follows the guardian; for a MINUTELY rule the
    // scheduler ignores localTime anyway, and this keeps the shape uniform.
    tzMode: "floating",
    localTime: "00:00",
    rrule: `FREQ=MINUTELY;INTERVAL=${normalizeIntervalMinutes(intervalMinutes)}`,
  };
}
