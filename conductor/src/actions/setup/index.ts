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
import { createLockRepository, TICK_LOCK } from "../../db/repositories/lock.js";
import {
  DEFAULT_INTAKE_LABEL,
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_DECISIONS_PER_TURN,
  DEFAULT_MAX_WORKERS,
  DEFAULT_ORCHESTRATOR_AGENT,
  DEFAULT_REUSE_SESSIONS,
  DEFAULT_WORKER_AGENTS,
  type ConductorConfig,
  parseConfig,
  TICK_ROUTINE_KEY,
  TICK_ROUTINE_NAME,
  tickTrigger,
} from "../../lib/config.js";

const log = createAppLogger("conductor:setup");

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
          description: "Named projects. Each has workingDir (absolute, inside a Git repo), optional repo (owner/name; enables issue intake), intakeEnabled, intakeLabel, projectLabel, and sop (project-specific SOP prompt).",
          additionalProperties: {
            type: "object", required: ["workingDir"], additionalProperties: false,
            properties: {
              workingDir: { type: "string" }, repo: { type: "string" },
              intakeEnabled: { type: "boolean" }, intakeLabel: { type: "string" }, projectLabel: { type: "string" },
              sop: { type: "string" },
            },
          },
        },
        defaultProject: { type: "string", description: "Project used when a chat request does not name one and the selection is ambiguous." },
        sop: { type: "string", description: "The global standard operating procedure the orchestrator follows, as prose. Omit to keep the built-in software-development SOP." },
        workerAgents: {
          type: "object", additionalProperties: { type: "string" },
          description: `Agents the orchestrator may dispatch a worker as (agent id → one-line description). Defaults to ${Object.keys(DEFAULT_WORKER_AGENTS).join(", ")}.`,
        },
        orchestratorAgent: { type: "string", description: `Orchestrator agent id. Defaults to ${DEFAULT_ORCHESTRATOR_AGENT}.` },
        maxWorkers: { type: "number", description: `Workers allowed to run at once across every task. Defaults to ${DEFAULT_MAX_WORKERS}.` },
        intervalMinutes: { type: "number", description: `How often the tick routine fires. Defaults to ${DEFAULT_INTERVAL_MINUTES}.` },
        reuseSessions: { type: "boolean", description: `Whether the orchestrator may continue an earlier worker's session. Defaults to ${DEFAULT_REUSE_SESSIONS}.` },
        intakeLabel: { type: "string", description: `Default label an issue must carry to be taken in. Defaults to "${DEFAULT_INTAKE_LABEL}".` },
        maxDecisionsPerTurn: { type: "number", description: `Safety valve: orchestrator decisions allowed on a task since a person last spoke. Defaults to ${DEFAULT_MAX_DECISIONS_PER_TURN}.` },
      },
      required: ["projects"],
      additionalProperties: true,
    },

    async execute(args): Promise<ActionResult> {
      const parsed = parseConfig(args);
      if (!parsed.ok) return { status: "error", error: parsed.error };

      const locks = createLockRepository(appContext.db);
      if (!locks.tryAcquire(TICK_LOCK, 5 * 60_000)) return { status: "error", error: "Conductor is ticking; retry setup shortly. Configuration was not changed." };
      let routine: Awaited<ReturnType<typeof ensureRoutine>>;
      try {
        const settings = createSettingsRepository(appContext.db);
        const ledger = createLedgerRepository(appContext.db);
        if (!ledger.reachable()) return { status: "error", error: "Ledger unavailable; configuration was not changed." };
        settings.put(parsed.config);
        routine = await ensureRoutine(appContext, parsed.config);
      } finally { locks.release(TICK_LOCK); }
      if (!routine.ok) return { status: "error", error: routine.error };

      log.info("setup finished", { projects: Object.keys(parsed.config.projects), routine: routine.outcome });
      return { status: "ok", data: { config: parsed.config, routine: routine.outcome } };
    },
  };
}

async function ensureRoutine(
  appContext: RomeAppContext,
  config: ConductorConfig,
): Promise<{ ok: true; outcome: RoutineOutcome } | { ok: false; error: string }> {
  const trigger = tickTrigger(config.intervalMinutes);
  const existing = (await appContext.listRoutines()).find(
    (routine) => routine.key === TICK_ROUTINE_KEY || routine.name === TICK_ROUTINE_NAME,
  );

  if (existing) {
    const current = existing.trigger as { rrule?: string };
    if (current.rrule === trigger.rrule) return { ok: true, outcome: "unchanged" };
    const deleted = await appContext.runAction("system:delete_routine", { routineId: existing.id });
    if (deleted.status !== "ok") {
      const reason = deleted.status === "error" ? deleted.error : `returned ${deleted.status}`;
      return { ok: false, error: `could not replace the tick routine: ${reason}` };
    }
  }

  const created = await appContext.runAction("system:create_routine", {
    name: TICK_ROUTINE_NAME,
    key: TICK_ROUTINE_KEY,
    trigger,
    actionName: "conductor:tick",
    args: {},
  });
  if (created.status !== "ok") {
    const reason = created.status === "error" ? created.error : `returned ${created.status}`;
    return { ok: false, error: `could not register the tick routine: ${reason}` };
  }
  return { ok: true, outcome: existing ? "replaced" : "created" };
}
