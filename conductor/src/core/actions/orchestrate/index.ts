import { createAppLogger, type Action, type ActionConfig, type ActionResult, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import type { CoreComposition } from "../../lib/composition.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, orchestrateLock } from "../../db/repositories/lock.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createTaskSessionRepository } from "../../db/repositories/task-sessions.js";
import { createAgentInstanceRepository } from "../../db/repositories/agent-instances.js";
import { RUNTIME, type NewFact } from "../../lib/facts.js";
import { fold, foldTask, needsAttention } from "../../lib/fold.js";
import { buildOrchestratorPrompt } from "../../lib/prompts.js";
import { isResumeRejection, readSummonOutput } from "../run-worker/index.js";

const log = createAppLogger("conductor:wake_task_coordinator");

/** How long one wake may hold the task. */
const WAKE_LEASE_MS = 15 * 60_000;

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps, composition: CoreComposition): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"], additionalProperties: true },

    async execute(args): Promise<ActionResult> {
      const taskId = String(args.taskId ?? "").trim();
      if (!taskId) return { status: "error", error: "taskId is required" };
      const settings = createSettingsRepository(appContext.db, composition.parseConfig).get();
      if (!settings) return { status: "error", error: "Conductor is not configured. Run conductor:configure_conductor first." };
      const ledger = createLedgerRepository(appContext.db);
      const locks = createLockRepository(appContext.db);
      if (!locks.tryAcquire(orchestrateLock(taskId), WAKE_LEASE_MS)) {
        return { status: "ok", data: { taskId, skipped: "a wake is already in flight" } };
      }
      try {
        const now = new Date();
        const facts = ledger.factsFor(taskId);
        if (!facts.length) return { status: "error", error: `no task ${taskId}` };
        const task = foldTask(facts);
        const attention = needsAttention(task, now);
        if (!attention.wake) return { status: "ok", data: { taskId, skipped: "nothing new" } };

        // Safety valve. Not workflow: a budget, so a loop the Agent policy did not
        // foresee ends with a person being asked rather than with a bill.
        if (task.decisionsSinceLastPersonFact >= settings.maxDecisionsPerTurn) {
          const already = task.facts.some((f) => f.seq > task.lastPersonFactSeq && f.kind === "Event" && f.payload.type === "circuit_breaker");
          if (!already) {
            ledger.append({ taskId, kind: "Event", by: RUNTIME, source: "conductor:wake_task_coordinator",
              payload: { source: "runtime", type: "circuit_breaker",
                summary: `${task.decisionsSinceLastPersonFact} orchestrator decisions since a person last spoke; the runtime will not wake the orchestrator again until a person replies` } });
          }
          return { status: "ok", data: { taskId, skipped: "circuit breaker" } };
        }

        const agentInstances = createAgentInstanceRepository(appContext.db);
        let coordinatorInstance;
        try {
          coordinatorInstance = agentInstances.ensureTaskCoordinator(
            taskId,
            task.replay?.coordinatorAgent ?? task.parent?.coordinatorAgent ?? settings.orchestratorAgent,
          );
        } catch (err) {
          return { status: "error", error: err instanceof Error ? err.message : String(err) };
        }
        if (coordinatorInstance.status !== "active") {
          return { status: "error", error: `Agent Instance ${coordinatorInstance.id} is ${coordinatorInstance.status}; its one Agent Session cannot be resumed` };
        }

        const snapshot = fold(now, ledger.all());
        const children = snapshot.tasks.filter((candidate) => candidate.parent?.taskId === task.id);
        const resumingCoordinator = Boolean(
          coordinatorInstance.sessionId && coordinatorInstance.cursorSeq !== undefined,
        );
        const contracts = !resumingCoordinator && composition.promptContracts
          ? await composition.promptContracts.resolve(task, composition.promptContracts.forCoordinator)
          : [];
        const prompt = buildOrchestratorPrompt({
          task,
          children,
          config: settings,
          now,
          why: attention.why,
          providerFor: composition.providerFor,
          defaultWorkspaceKind: composition.defaultWorkspaceKind,
          projectNote: composition.projectPromptNote?.(task, "orchestrator"),
          sharedContracts: contracts,
          ...(coordinatorInstance.sessionId && coordinatorInstance.cursorSeq !== undefined
            ? { deliveredThroughSeq: coordinatorInstance.cursorSeq }
            : {}),
        });
        log.info("waking orchestrator", {
          taskId,
          agentInstanceId: coordinatorInstance.id,
          agentSessionId: coordinatorInstance.sessionId,
          seenSeq: task.latest.seq,
          why: attention.why,
        });

        const taskSessions = createTaskSessionRepository(appContext.db);
        const rememberSession = (data: unknown, resultSeq?: number) => {
          const session = readSummonOutput(data).romeSession;
          if (session) taskSessions.record({
            taskId,
            sessionId: session.id,
            sessionType: session.type,
            role: "coordinator",
            triggerSeq: task.latest.seq,
            resultSeq,
          });
        };

        const summon = (p: string, sessionId?: string) => appContext.runAction("system:summon", { agentName: coordinatorInstance.agentName, prompt: p, ...(sessionId ? { sessionId } : {}) })
          .catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
        let result = await summon(prompt, coordinatorInstance.sessionId);
        let reply = result.status === "ok" ? readSummonOutput(result.data).reply : "";
        let error = result.status === "ok" ? undefined : result.status === "error" ? result.error : `summon returned ${result.status}`;

        const acceptAgentSession = (data: unknown): string | undefined => {
          const sessionId = readSummonOutput(data).sessionId;
          if (!sessionId) {
            error = "Summoned coordinator did not return a resumable Agent Session id";
            return undefined;
          }
          try {
            agentInstances.bindRuntimeSession(coordinatorInstance.id, sessionId);
            // This cursor advances only through the contiguous facts actually
            // present in the prompt. The coordinator's own new decision is
            // deliberately delivered again on its next turn rather than
            // risking skipping a concurrent fact with a lower seq.
            agentInstances.advanceTaskCursor(coordinatorInstance.id, task.latest.seq);
            return sessionId;
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            agentInstances.markBroken(coordinatorInstance.id);
            return undefined;
          }
        };

        let sessionId = result.status === "ok" ? acceptAgentSession(result.data) : undefined;
        if (error && coordinatorInstance.sessionId && isResumeRejection(error)) {
          agentInstances.markBroken(coordinatorInstance.id);
          error = `Agent Instance ${coordinatorInstance.id} cannot resume its one Agent Session ${coordinatorInstance.sessionId}: ${error}`;
        }

        let after = foldTask(ledger.factsFor(taskId));
        let decided = after.lastDecisionSeq > task.lastDecisionSeq || after.state !== "open";
        if (result.status === "ok" && sessionId) rememberSession(result.data, decided ? after.lastDecisionSeq : undefined);
        if (!decided && !error && sessionId) {
          // It talked instead of acting. Nobody reads its chat; give it one
          // chance, in the same session, to record what it just said.
          log.info("orchestrator recorded no decision; nudging once", { taskId });
          result = await summon([
            "Nothing was recorded. Your chat reply is not visible to anyone; only a decision action reaches the person or a worker.",
            `Record the decision you just described by calling the matching action now, with taskId="${taskId}" and seenSeq=${after.latest.seq}.`,
          ].join("\n"), sessionId);
          reply = result.status === "ok" ? readSummonOutput(result.data).reply || reply : reply;
          error = result.status === "ok" ? undefined : result.status === "error" ? result.error : `summon returned ${result.status}`;
          if (result.status === "ok") sessionId = acceptAgentSession(result.data);
          if (error && isResumeRejection(error)) {
            agentInstances.markBroken(coordinatorInstance.id);
            error = `Agent Instance ${coordinatorInstance.id} cannot resume its one Agent Session ${sessionId}: ${error}`;
          }
          after = foldTask(ledger.factsFor(taskId));
          decided = after.lastDecisionSeq > task.lastDecisionSeq || after.state !== "open";
          if (result.status === "ok" && sessionId) rememberSession(result.data, decided ? after.lastDecisionSeq : undefined);
        }
        if (!decided) {
          // The runtime observed a failed/incomplete wake; it must not turn that
          // observation into an orchestrator-authored decision. Keeping this as
          // an unseen runtime Event also leaves the Task eligible for retry.
          ledger.append(coordinatorWakeMissedFact(taskId, { error, reply }));
        }
        log.info("orchestrator wake finished", { taskId, agentInstanceId: coordinatorInstance.id, agentSessionId: sessionId, decided, error });
        return { status: "ok", data: { taskId, agentInstanceId: coordinatorInstance.id, agentSessionId: sessionId, decided, decision: decided ? after.lastDecision?.kind : undefined, error } };
      } finally {
        locks.release(orchestrateLock(taskId));
      }
    },
  };
}

/** A wake that produced no durable decision is runtime evidence, never an Agent decision. */
export function coordinatorWakeMissedFact(
  taskId: string,
  result: { error?: string; reply?: string },
): NewFact {
  const error = result.error?.trim();
  const reply = result.reply?.trim();
  return {
    taskId,
    kind: "Event",
    by: RUNTIME,
    source: "conductor:wake_task_coordinator",
    payload: error
      ? {
          source: "runtime",
          type: "coordinator_wake_failed",
          summary: `Task coordinator wake failed; runtime will retry. ${clip(error)}`,
          data: { error },
        }
      : {
          source: "runtime",
          type: "coordinator_no_decision",
          summary: `Task coordinator returned without recording a decision; runtime will retry.${reply ? ` Previous reply: ${clip(reply)}` : ""}`,
          ...(reply ? { data: { reply } } : {}),
        },
  };
}

function clip(value: string, max = 600): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
