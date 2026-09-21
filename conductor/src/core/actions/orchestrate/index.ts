import { createAppLogger, type Action, type ActionConfig, type ActionResult, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import type { CoreComposition } from "../../lib/composition.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createLockRepository, orchestrateLock } from "../../db/repositories/lock.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createTaskSessionRepository } from "../../db/repositories/task-sessions.js";
import { RUNTIME, type NewFact } from "../../lib/facts.js";
import { fold, foldTask, needsAttention } from "../../lib/fold.js";
import { buildOrchestratorPrompt } from "../../lib/prompts.js";
import { readSummonOutput } from "../run-worker/index.js";

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

        const snapshot = fold(now, ledger.all());
        const children = snapshot.tasks.filter((candidate) => candidate.parent?.taskId === task.id);
        const prompt = buildOrchestratorPrompt({ task, children, config: settings, now, why: attention.why, providerFor: composition.providerFor, defaultWorkspaceKind: composition.defaultWorkspaceKind, projectNote: composition.projectPromptNote?.(task, "orchestrator"), sharedContracts: composition.sharedPromptContracts });
        log.info("waking orchestrator", { taskId, seenSeq: task.latest.seq, why: attention.why });

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

        const summon = (p: string, sessionId?: string) => appContext.runAction("system:summon", { agentName: settings.orchestratorAgent, prompt: p, ...(sessionId ? { sessionId } : {}) })
          .catch((error: unknown) => ({ status: "error" as const, error: error instanceof Error ? error.message : String(error) }));
        let result = await summon(prompt);
        let reply = result.status === "ok" ? readSummonOutput(result.data).reply : "";
        let error = result.status === "ok" ? undefined : result.status === "error" ? result.error : `summon returned ${result.status}`;

        let after = foldTask(ledger.factsFor(taskId));
        let decided = after.lastDecisionSeq > task.lastDecisionSeq || after.state !== "open";
        if (result.status === "ok") rememberSession(result.data, decided ? after.lastDecisionSeq : undefined);
        const sessionId = result.status === "ok" ? readSummonOutput(result.data).sessionId : undefined;
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
          after = foldTask(ledger.factsFor(taskId));
          decided = after.lastDecisionSeq > task.lastDecisionSeq || after.state !== "open";
          if (result.status === "ok") rememberSession(result.data, decided ? after.lastDecisionSeq : undefined);
        }
        if (!decided) {
          // The runtime observed a failed/incomplete wake; it must not turn that
          // observation into an orchestrator-authored decision. Keeping this as
          // an unseen runtime Event also leaves the Task eligible for retry.
          ledger.append(coordinatorWakeMissedFact(taskId, { error, reply }));
        }
        log.info("orchestrator wake finished", { taskId, decided, error });
        return { status: "ok", data: { taskId, decided, decision: decided ? after.lastDecision?.kind : undefined, error } };
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
