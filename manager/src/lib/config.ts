/** Everything `manager:setup` stores and every action reads back. */
export interface ManagerConfig {
  /** Absolute directory every worker is told to work in. */
  workingDir: string;
  /** Canonical id of the agent a worker runs. */
  workerAgent: string;
  /** Started facts one task may collect since the last person fact before the runtime asks. */
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
  const workingDir = typeof args.workingDir === "string" ? args.workingDir.trim() : "";
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
