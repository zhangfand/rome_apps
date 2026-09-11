import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createLedgerRepository, type LedgerRepository } from "../../db/repositories/ledger.js";
import { createWorkerHealthRepository } from "../../db/repositories/worker-health.js";
import { startHeartbeatTimer } from "../../lib/worker-health.js";
import { type DispatchedFact, isWorkerTerminalKind } from "../../lib/facts.js";
import { parseWorkerReply } from "../../lib/worker-reply.js";
import { validateWorkspace } from "../../lib/worktree.js";

interface SummonSessionStartedEvent {
  type: "rome_session_started";
  agentName: string;
  romeSession: { _romeSessionId: string; _type: string };
}

const log = createAppLogger("conductor:run_worker");

/**
 * A worker. `system:summon` runs an agent to completion and returns its
 * reply, so the detachment lives one level up: dispatch runs *this action*
 * detached and the action holds the blocking summon. It writes the worker's
 * own facts — Opened, Returned, Failed — because the worker agent has no
 * tools on this ledger and should not need any. It interprets nothing: the
 * reply is parsed into status + summary + detail and handed to the ledger for
 * the orchestrator to read.
 */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        workerId: { type: "string" },
      },
      required: ["taskId", "workerId"],
      additionalProperties: true,
    },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "");
      const workerId = String(args.workerId ?? "");
      if (!taskId || !workerId) return { status: "error", error: "taskId and workerId are required" };

      const ledger = createLedgerRepository(appContext.db);
      const dispatched = ledger.factsFor(taskId).find((f): f is DispatchedFact => f.kind === "Dispatched" && f.payload.workerId === workerId);
      if (!dispatched) return { status: "error", error: `no Dispatched fact for worker ${workerId} on task ${taskId}` };
      if (ledger.factsFor(taskId).some((f) => isWorkerTerminalKind(f.kind) && (f.payload as { workerId?: string }).workerId === workerId)) {
        return { status: "ok", data: { taskId, workerId, outcome: "skipped (worker already closed)" } };
      }
      const source = "conductor:run_worker, on the worker's behalf";

      const health = createWorkerHealthRepository(appContext.db);
      const ownerId = crypto.randomUUID();
      if (!health.claim(dispatched, ownerId)) {
        return { status: "ok", data: { taskId, workerId, outcome: "skipped (heartbeat lease unavailable)" } };
      }
      const stopHeartbeat = startHeartbeatTimer(
        () => health.renew(taskId, workerId, ownerId),
        (error) => log.warn("worker heartbeat write failed", { taskId, workerId, error: String(error) }),
      );

      log.info("worker starting", { taskId, workerId, agent: dispatched.payload.agent, resumeSessionId: dispatched.payload.resumeSessionId });
      let outcome: string;
      let sessionId: string | undefined;
      let restarted = false;
      try {
        const run = await summonWithFallback({ appContext, ledger, dispatched, source });
        sessionId = run.sessionId;
        restarted = run.restarted;
        if (run.ok) {
          const parsed = parseWorkerReply(run.reply);
          const written = ledger.appendWorkerOutcome({
            taskId, kind: "Returned", by: workerId, source,
            payload: { workerId, ...parsed, sessionId: run.sessionId, ...(restarted ? { restarted } : {}) },
          });
          outcome = written ? `Returned(${parsed.status})` : "dropped (worker already closed)";
        } else {
          const written = ledger.appendWorkerOutcome({
            taskId, kind: "Failed", by: workerId, source,
            payload: { workerId, error: run.error, sessionId: run.sessionId, ...(restarted ? { restarted } : {}) },
          });
          outcome = written ? "Failed" : "dropped (worker already closed)";
        }
        log.info("worker finished", { taskId, workerId, outcome, sessionId, restarted });
      } catch (error) {
        const written = ledger.appendWorkerOutcome({
          taskId, kind: "Failed", by: workerId, source,
          payload: { workerId, error: error instanceof Error ? error.message : String(error) },
        });
        outcome = written ? "Failed" : "dropped (worker already closed)";
      } finally {
        stopHeartbeat();
      }

      // A new fact exists: wake the orchestrator now rather than on the next tick.
      await appContext.runAction("conductor:tick", {});
      return { status: "ok", data: { taskId, workerId, outcome, sessionId, restarted } };
    },
  };
}

type SummonRun =
  | { ok: true; reply: string; sessionId?: string; restarted: boolean }
  | { ok: false; error: string; sessionId?: string; restarted: boolean };

async function summonWithFallback(input: {
  appContext: AppActionRuntimeDeps["appContext"];
  ledger: Pick<LedgerRepository, "append" | "factsFor">;
  dispatched: DispatchedFact;
  source: string;
}): Promise<SummonRun> {
  const { appContext, ledger, dispatched, source } = input;
  const { taskId } = dispatched;
  const { workerId, resumeSessionId, agent, prompt, workspace } = dispatched.payload;

  try {
    if (!workspace) throw new Error("Worker has no isolated worktree; refusing shared-checkout launch");
    await validateWorkspace(workspace);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), restarted: false };
  }

  const onSession = (session: { id: string; type: string }) => {
    ledger.append({ taskId, kind: "Opened", by: workerId, source, payload: { workerId, romeSessionId: session.id, sessionType: session.type } });
  };

  const first = await summon(appContext, agent, prompt, resumeSessionId, onSession);
  if (first.ok || !resumeSessionId || !isResumeRejection(first.error)) return { ...first, restarted: false };

  log.warn("resume rejected; worker restarted in a fresh session", { taskId, workerId, rejectedSessionId: resumeSessionId, error: first.error });
  const second = await summon(appContext, agent, prompt, undefined, onSession);
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
    const invocation = appContext.invokeAction<SummonSessionStartedEvent | { type: string }>("system:summon", {
      agentName, prompt, ...(sessionId ? { sessionId } : {}),
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

export function isResumeRejection(error: string): boolean {
  return (
    /was not found or cannot be resumed/i.test(error) ||
    /does not match this session key/i.test(error) ||
    /cannot resume by (explicit )?session id/i.test(error) ||
    /did not provide a durable Rome session/i.test(error)
  );
}

export function readSummonOutput(data: unknown): { reply: string; sessionId?: string } {
  if (typeof data === "object" && data !== null) {
    const { result, sessionId } = data as { result?: unknown; sessionId?: unknown };
    return { reply: typeof result === "string" ? result : "", sessionId: typeof sessionId === "string" && sessionId ? sessionId : undefined };
  }
  return { reply: "" };
}
