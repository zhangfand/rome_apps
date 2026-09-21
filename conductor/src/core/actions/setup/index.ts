import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
  type RomeAppContext,
} from "@rome-os/app-runtime";
import type { CoreComposition } from "../../lib/composition.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, TICK_LOCK } from "../../db/repositories/lock.js";
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_MAX_DECISIONS_PER_TURN,
  DEFAULT_MAX_WORKERS,
  DEFAULT_ORCHESTRATOR_AGENT,
  DEFAULT_REUSE_SESSIONS,
  type ConductorConfig,
  TICK_ROUTINE_KEY,
  TICK_ROUTINE_NAME,
  tickTrigger,
} from "../../lib/config.js";

const log = createAppLogger("conductor:configure_conductor");
const RECONCILE_ACTION_NAME = "conductor:reconcile_tasks";

export type RoutineOutcome = "created" | "replaced" | "unchanged";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps, composition: CoreComposition): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        projects: {
          type: "object",
          description: composition.setupSchema?.projectDescription ?? "Named projects with a workspace.",
          additionalProperties: {
            type: "object", additionalProperties: false,
            properties: {
              workingDir: { type: "string" },
              workspace: { type: "string", enum: [...composition.workspaceKinds], description: `What a worker on this project works in. Defaults to ${composition.defaultWorkspaceKind}.` },
              ...(composition.setupSchema?.projectProperties ?? {}),
            },
          },
        },
        defaultProject: { type: "string", description: "Project used when a chat request does not name one and the selection is ambiguous." },
        workerAgents: {
          type: "object", additionalProperties: { type: "string" },
          description: "Logical agents the coordinator may create Jobs for (agent id → one-line description). Uses the app defaults when omitted.",
        },
        orchestratorAgent: { type: "string", description: `Orchestrator agent id. Defaults to ${DEFAULT_ORCHESTRATOR_AGENT}.` },
        maxWorkers: { type: "number", description: `Workers allowed to run at once across every task. Defaults to ${DEFAULT_MAX_WORKERS}.` },
        intervalMinutes: { type: "number", description: `How often the tick routine fires. Defaults to ${DEFAULT_INTERVAL_MINUTES}.` },
        reuseSessions: { type: "boolean", description: `Whether runtime may continue an earlier compatible worker session. Defaults to ${DEFAULT_REUSE_SESSIONS}.` },
        ...(composition.setupSchema?.rootProperties ?? {}),
        maxDecisionsPerTurn: { type: "number", description: `Safety valve: orchestrator decisions allowed on a task since a person last spoke. Defaults to ${DEFAULT_MAX_DECISIONS_PER_TURN}.` },
      },
      required: ["projects"],
      additionalProperties: true,
    },

    async execute(args): Promise<ActionResult> {
      const parsed = composition.parseConfig(args);
      if (!parsed.ok) return { status: "error", error: parsed.error };

      const routine = await persistConfiguration(appContext, composition, parsed.config);
      if (!routine.ok) return { status: "error", error: routine.error };

      log.info("setup finished", { projects: Object.keys(parsed.config.projects), routine: routine.outcome });
      return { status: "ok", data: { config: parsed.config, routine: routine.outcome } };
    },
  };
}

/** The single setup path used by both the action and first Configuration PATCH. */
export async function persistConfiguration(
  appContext: RomeAppContext,
  composition: CoreComposition,
  config: ConductorConfig,
): Promise<{ ok: true; outcome: RoutineOutcome } | { ok: false; error: string }> {
  const locks = createLockRepository(appContext.db);
  if (!locks.tryAcquire(TICK_LOCK, 5 * 60_000)) {
    return { ok: false, error: "Conductor is ticking; retry setup shortly. Configuration was not changed." };
  }
  try {
    const settings = createSettingsRepository(appContext.db, composition.parseConfig);
    const ledger = createLedgerRepository(appContext.db);
    if (!ledger.reachable()) return { ok: false, error: "Ledger unavailable; configuration was not changed." };
    settings.put(config);
    return await ensureRoutine(appContext, config);
  } finally {
    locks.release(TICK_LOCK);
  }
}

export async function ensureRoutine(
  appContext: RomeAppContext,
  config: ConductorConfig,
): Promise<{ ok: true; outcome: RoutineOutcome } | { ok: false; error: string }> {
  const trigger = tickTrigger(config.intervalMinutes);
  const existing = (await appContext.listRoutines()).find(
    (routine) => routine.key === TICK_ROUTINE_KEY || routine.name === TICK_ROUTINE_NAME,
  );

  if (existing) {
    const current = existing.trigger as { rrule?: string };
    if (current.rrule === trigger.rrule && existing.actionName === RECONCILE_ACTION_NAME) {
      return { ok: true, outcome: "unchanged" };
    }
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
    actionName: RECONCILE_ACTION_NAME,
    args: {},
  });
  if (created.status !== "ok") {
    const reason = created.status === "error" ? created.error : `returned ${created.status}`;
    return { ok: false, error: `could not register the tick routine: ${reason}` };
  }
  return { ok: true, outcome: existing ? "replaced" : "created" };
}
