import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
  type RomeAppContext,
} from "@rome-os/app-runtime";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, RECONCILE_LOCK } from "../../db/repositories/lock.js";
import { legacyBindingFacts } from "../../lib/projects.js";
import {
  DEFAULT_AGE_CAP_HOURS,
  DEFAULT_CLOSE_ON_ISSUE_CLOSED,
  DEFAULT_INTAKE_LABEL,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_WORKERS,
  DEFAULT_REUSE_SESSIONS,
  DEFAULT_START_CAP,
  DEFAULT_WORKER_AGENT,
  type ManagerConfig,
  parseConfig,
  parseRepoList,
  RECONCILE_ROUTINE_KEY,
  RECONCILE_ROUTINE_NAME,
  reconcileTrigger,
} from "../../lib/config.js";

const log = createAppLogger("manager:setup");

/** What `setup` did to the routine, reported back to the guardian. */
export type RoutineOutcome = "created" | "replaced" | "unchanged";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        projects: {
          type: "object",
          description: "Named projects. Each has workingDir, optional repo (owner/name; enables intake), intakeEnabled, intakeLabel, and projectLabel. Projects sharing a repo require distinct projectLabels. Replaces legacy workingDir/intakeRepos configuration.",
          additionalProperties: {
            type: "object", required: ["workingDir"], additionalProperties: false,
            properties: {
              workingDir: { type: "string" }, repo: { type: "string" },
              intakeEnabled: { type: "boolean" }, intakeLabel: { type: "string" }, projectLabel: { type: "string" },
            },
          },
        },
        defaultProject: { type: "string", description: "Default project id for configuration compatibility. Does not silently route ambiguous human requests. Existing tasks retain their recorded binding." },
        workingDir: {
          type: "string",
          description: "Absolute source project directory inside a Git repository. Workers run in isolated worktrees, preserving this repo-relative path.",
        },
        workerAgent: {
          type: "string",
          description: `Canonical id of the agent a worker runs. Defaults to ${DEFAULT_WORKER_AGENT}.`,
        },
        startCap: {
          type: "number",
          description: `Workers one task may be given since the last thing a person said, before the runtime asks them a question. Defaults to ${DEFAULT_START_CAP}.`,
        },
        maxWorkers: {
          type: "number",
          description: `Workers allowed to run at once across every task. Defaults to ${DEFAULT_MAX_WORKERS}.`,
        },
        ageCapHours: {
          type: "number",
          description: `Hours a worker may be silent before it is declared lost. Defaults to ${DEFAULT_AGE_CAP_HOURS}.`,
        },
        intervalMinutes: {
          type: "number",
          description: `How often the reconcile routine fires. Defaults to ${DEFAULT_INTERVAL_MINUTES}.`,
        },
        reuseSessions: {
          type: "boolean",
          description: `Whether a follow-up worker continues the previous worker's session (keeps context and prompt cache warm) instead of starting cold. Defaults to ${DEFAULT_REUSE_SESSIONS}.`,
        },
        closeOnIssueClosed: {
          type: "boolean",
          description: `Whether an open task ends once the GitHub issue(s) named in its brief are closed — Completed if closed as done, Cancelled if closed as not planned (polled via connector_proxy each pass). Defaults to ${DEFAULT_CLOSE_ON_ISSUE_CLOSED}.`,
        },
        intakeRepos: {
          type: "array",
          items: { type: "string" },
          description:
            "Repositories, as owner/name, whose open issues carrying `intakeLabel` become tasks (polled via connector_proxy each pass). Defaults to none — no GitHub intake.",
        },
        intakeLabel: {
          type: "string",
          description: `The label an issue must carry to be taken in as a task. Defaults to "${DEFAULT_INTAKE_LABEL}".`,
        },
      },
      anyOf: [{ required: ["workingDir"] }, { required: ["projects"] }],
      additionalProperties: true,
    },

    async execute(args): Promise<ActionResult> {
      const repos = parseRepoList(args.intakeRepos);
      if (repos.invalid.length > 0) {
        return {
          status: "error",
          error: `intakeRepos must be owner/name entries; got ${repos.invalid.map((r) => JSON.stringify(r)).join(", ")}`,
        };
      }

      const parsed = parseConfig(args);
      if (!parsed.ok) return { status: "error", error: parsed.error };

      const locks = createLockRepository(appContext.db);
      if (!locks.tryAcquire(RECONCILE_LOCK, 5 * 60_000)) return { status: "error", error: "Manager is reconciling; retry setup shortly. Configuration was not changed." };
      let routine: Awaited<ReturnType<typeof ensureRoutine>>;
      try {
        const settings = createSettingsRepository(appContext.db);
        const ledger = createLedgerRepository(appContext.db);
        if (!ledger.reachable()) return { status: "error", error: "Ledger unavailable; configuration was not changed." };
        // Bind from OLD settings before replacing them. A crash midway is safe to retry.
        for (const fact of legacyBindingFacts(ledger.all(), settings.get() ?? parsed.config)) ledger.append(fact);
        settings.put(parsed.config);
        routine = await ensureRoutine(appContext, parsed.config);
      } finally { locks.release(RECONCILE_LOCK); }
      if (!routine.ok) return { status: "error", error: routine.error };

      log.info("setup finished", { config: parsed.config, routine: routine.outcome });
      return { status: "ok", data: { config: parsed.config, routine: routine.outcome } };
    },
  };
}

/**
 * Register the reconcile routine, once. `create_routine` is not idempotent, so
 * the guard is the routine `key` — Rome enforces it as unique, unlike the
 * display name. A cadence change is a delete and a re-create, because a trigger
 * cannot be edited in place.
 */
async function ensureRoutine(
  appContext: RomeAppContext,
  config: ManagerConfig,
): Promise<{ ok: true; outcome: RoutineOutcome } | { ok: false; error: string }> {
  const trigger = reconcileTrigger(config.intervalMinutes);
  const existing = (await appContext.listRoutines()).find(
    (routine) => routine.key === RECONCILE_ROUTINE_KEY || routine.name === RECONCILE_ROUTINE_NAME,
  );

  if (existing) {
    const current = existing.trigger as { rrule?: string };
    if (current.rrule === trigger.rrule) {
      return { ok: true, outcome: "unchanged" };
    }
    const deleted = await appContext.runAction("system:delete_routine", {
      routineId: existing.id,
    });
    if (deleted.status !== "ok") {
      const reason = deleted.status === "error" ? deleted.error : `returned ${deleted.status}`;
      return { ok: false, error: `could not replace the reconcile routine: ${reason}` };
    }
  }

  const created = await appContext.runAction("system:create_routine", {
    name: RECONCILE_ROUTINE_NAME,
    key: RECONCILE_ROUTINE_KEY,
    trigger,
    actionName: "manager:reconcile",
    args: {},
  });
  if (created.status !== "ok") {
    const reason = created.status === "error" ? created.error : `returned ${created.status}`;
    return { ok: false, error: `could not register the reconcile routine: ${reason}` };
  }

  return { ok: true, outcome: existing ? "replaced" : "created" };
}
