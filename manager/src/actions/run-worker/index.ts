import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import type { ManagerConfig } from "../../lib/config.js";
import { isWorkerTerminalKind, type StartedFact } from "../../lib/facts.js";

/** What `system:summon` publishes the moment the summoned agent's Rome session exists. */
interface SummonSessionStartedEvent {
  type: "rome_session_started";
  agentName: string;
  romeSession: { _romeSessionId: string; _type: string };
}
import { foldTask } from "../../lib/fold.js";
import { buildWorkerPrompt } from "../../lib/prompt.js";

import { bindWorkspacePrompt, validateWorkspace } from "../../lib/worktree.js";

const log = createAppLogger("manager:run_worker");

/**
 * A worker, as this app can build one on today's platform.
 *
 * `system:summon` runs an agent to completion and returns its reply — there is
 * no detached mode and no way to stop a run. So the detachment lives one level
 * up: the runtime dispatches *this action* detached, and the action holds the
 * blocking summon for as long as it takes. The worker is a Rome execution the
 * runtime does not wait for, which is what the model asks for, even though the
 * summon inside it is ordinary and synchronous.
 *
 * The action writes the worker's own facts — Restarted, Returned, Failed —
 * because the coding agent has no tools on this ledger and should not need any.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task the worker is working on." },
        workerId: { type: "string", description: "Worker id from the task's Started fact." },
      },
      required: ["taskId", "workerId"],
      additionalProperties: true,
    },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "");
      const workerId = String(args.workerId ?? "");
      if (!taskId || !workerId) {
        return { status: "error", error: "taskId and workerId are required" };
      }

      const settings = createSettingsRepository(appContext.db);
      const ledger = createLedgerRepository(appContext.db);

      const managerConfig = settings.get();
      if (!managerConfig) {
        return { status: "error", error: "manager is not configured. Run manager:setup first." };
      }

      // The prompt lives on the Started fact, so the worker reads its brief
      // from the ledger like everything else — this action carries no context
      // of its own from the pass that launched it.
      const started = ledger
        .factsFor(taskId)
        .find((fact) => fact.kind === "Started" && fact.payload.workerId === workerId);
      if (!started || started.kind !== "Started") {
        return {
          status: "error",
          error: `no Started fact for worker ${workerId} on task ${taskId}`,
        };
      }

      if (ledger.factsFor(taskId).some((fact) => isWorkerTerminalKind(fact.kind) &&
          (fact.payload as { workerId?: string }).workerId === workerId)) {
        return { status: "ok", data: { taskId, workerId, outcome: "skipped (worker already closed)" } };
      }
      const source = "manager:run_worker, on the worker's behalf";
      const resumeSessionId = started.payload.resumeSessionId;
      log.info("worker starting", {
        taskId,
        workerId,
        agent: managerConfig.workerAgent,
        resumeSessionId,
      });

      const run = await summonWithFallback({
        appContext,
        ledger,
        managerConfig,
        started,
        source,
      });

      let outcome: string;
      if (run.ok) {
        const written = ledger.appendWorkerOutcome({
          taskId,
          kind: "Returned",
          by: workerId,
          source,
          payload: { workerId, reply: run.reply, sessionId: run.sessionId },
        });
        outcome = written ? "Returned" : "dropped (worker already closed)";
      } else {
        const written = ledger.appendWorkerOutcome({
          taskId,
          kind: "Failed",
          by: workerId,
          source,
          payload: { workerId, error: run.error, sessionId: run.sessionId },
        });
        outcome = written ? "Failed" : "dropped (worker already closed)";
      }

      log.info("worker finished", {
        taskId,
        workerId,
        outcome,
        sessionId: run.sessionId,
        restarted: run.restarted,
      });

      // A new fact exists, so the runtime reconciles now rather than waiting
      // for the next tick.
      await appContext.runAction("manager:reconcile", {});

      return {
        status: "ok",
        data: { taskId, workerId, outcome, sessionId: run.sessionId, restarted: run.restarted },
      };
    },
  };
}

type SummonRun =
  | { ok: true; reply: string; sessionId?: string; restarted: boolean }
  | { ok: false; error: string; sessionId?: string; restarted: boolean };

/**
 * Summon the worker, resuming when its Started asks to. If the runner refuses
 * the resume, fall back once — explicitly: a Restarted fact records the
 * rejected session, the error, and the full brief the fresh session gets, so
 * the ledger says what happened the moment it happens rather than when the
 * worker returns hours later. A second failure, or any error that is not a
 * resume rejection, is the worker's real outcome.
 */
export async function summonWithFallback(input: {
  appContext: AppActionRuntimeDeps["appContext"];
  ledger: Pick<LedgerRepository, "append" | "factsFor">;
  managerConfig: ManagerConfig;
  started: StartedFact;
  source: string;
}): Promise<SummonRun> {
  const { appContext, ledger, managerConfig, started, source } = input;
  const { taskId } = started;
  const { workerId, resumeSessionId } = started.payload;

  try {
    if (!started.payload.workspace) throw new Error("Worker has no isolated worktree; refusing shared-checkout launch");
    await validateWorkspace(started.payload.workspace);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), restarted: false };
  }

  const onSession = (session: { id: string; type: string }) => {
    ledger.append({
      taskId,
      kind: "Opened",
      by: workerId,
      source,
      payload: { workerId, romeSessionId: session.id, sessionType: session.type },
    });
    log.info("worker session opened", { taskId, workerId, romeSessionId: session.id });
  };

  const first = await summon(appContext, managerConfig.workerAgent, started.payload.prompt, resumeSessionId, onSession);
  if (first.ok || !resumeSessionId || !isResumeRejection(first.error)) {
    return { ...first, restarted: false };
  }

  // The delta brief on the Started assumed a session that holds the history.
  // The fresh session holds nothing, so it gets the full brief instead.
  const task = foldTask(ledger.factsFor(taskId));
  const prompt = bindWorkspacePrompt(buildWorkerPrompt({
    task,
    config: managerConfig,
    reason: `resuming session ${resumeSessionId} was rejected: ${first.error}`,
  }), started.payload.workspace, managerConfig.workingDir);

  ledger.append({
    taskId,
    kind: "Restarted",
    by: workerId,
    source,
    payload: { workerId, rejectedSessionId: resumeSessionId, error: first.error, prompt },
  });
  log.warn("resume rejected; worker restarted in a fresh session", {
    taskId,
    workerId,
    rejectedSessionId: resumeSessionId,
    error: first.error,
  });

  const second = await summon(appContext, managerConfig.workerAgent, prompt, undefined, onSession);
  return { ...second, restarted: true };
}

async function summon(
  appContext: AppActionRuntimeDeps["appContext"],
  agentName: string,
  prompt: string,
  sessionId: string | undefined,
  onSession?: (session: { id: string; type: string }) => void,
): Promise<{ ok: true; reply: string; sessionId?: string } | { ok: false; error: string; sessionId?: string }> {
  try {
    // invokeAction rather than runAction: summon publishes the Rome session as
    // an event long before it returns, and that is when a person wants the link.
    const invocation = appContext.invokeAction<SummonSessionStartedEvent | { type: string }>("system:summon", {
      agentName,
      prompt,
      ...(sessionId ? { sessionId } : {}),
    });
    const listen = (async () => {
      try {
        for await (const event of invocation.events) {
          if (event.type === "rome_session_started" && "romeSession" in event) {
            const { romeSession } = event as SummonSessionStartedEvent;
            onSession?.({ id: romeSession._romeSessionId, type: romeSession._type });
          }
        }
      } catch (err) {
        // Losing the event stream must not lose the worker's result.
        log.warn("summon event stream ended early", { error: err instanceof Error ? err.message : String(err) });
      }
    })();
    const result = await invocation.result;
    await listen;
    if (result.status === "ok") {
      const { reply, sessionId: ran } = readSummonOutput(result.data);
      return { ok: true, reply, sessionId: ran };
    }
    const error = result.status === "error" ? result.error : `summon returned ${result.status}`;
    return { ok: false, error, sessionId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), sessionId };
  }
}

/**
 * Whether an error says the runner would not open the session at all, as
 * opposed to an agent that ran in it and then failed. The first three are the
 * session manager's own phrasings. The last is what `system:summon` actually
 * surfaces for a bad session id today — the manager's error is swallowed and
 * the summon ends without a session_init, so summon reports that no durable
 * session was provided. It is only consulted when a resume was asked for, so
 * it cannot mistake a fresh worker's failure for a rejection.
 */
export function isResumeRejection(error: string): boolean {
  return (
    /was not found or cannot be resumed/i.test(error) ||
    /does not match this session key/i.test(error) ||
    /cannot resume by (explicit )?session id/i.test(error) ||
    /did not provide a durable Rome session/i.test(error)
  );
}

/** `system:summon` returns `{ result, sessionId, romeSession }`. */
function readSummonOutput(data: unknown): { reply: string; sessionId?: string } {
  if (typeof data === "object" && data !== null) {
    const { result, sessionId } = data as { result?: unknown; sessionId?: unknown };
    return {
      reply: typeof result === "string" ? result : "",
      sessionId: typeof sessionId === "string" && sessionId ? sessionId : undefined,
    };
  }
  return { reply: "" };
}
