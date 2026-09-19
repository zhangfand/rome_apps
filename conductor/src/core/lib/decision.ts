import type { ActionResult, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository, type CompareAndAppendResult } from "../db/repositories/ledger.js";
import { describeFact, type NewFact, ORCHESTRATOR } from "./facts.js";
import { foldTask, type TaskView } from "./fold.js";

/**
 * The orchestrator's decisions all go through here. A decision is one fact,
 * stamped {@link ORCHESTRATOR}, appended only if the ledger still ends at
 * the seq the orchestrator cited when it decided. If a person or a worker
 * wrote something in between, the decision is refused and the orchestrator
 * re-reads — that is the only concurrency rule, and it is the same for every
 * kind of decision.
 */

export type DecisionInput = Record<string, unknown>;

export function readDecisionInput(args: DecisionInput): { ok: true; taskId: string; seenSeq: number } | { ok: false; error: string } {
  const taskId = String(args.taskId ?? "").trim();
  const seenSeq = Number(args.seenSeq);
  if (!taskId) return { ok: false, error: "taskId is required" };
  if (!Number.isInteger(seenSeq)) return { ok: false, error: "seenSeq is required: the seq of the newest ledger fact you read" };
  return { ok: true, taskId, seenSeq };
}

export function loadOpenTask(
  appContext: RomeAppContext,
  taskId: string,
  seenSeq: number,
): { ok: true; task: TaskView } | { ok: false; result: ActionResult } {
  const ledger = createLedgerRepository(appContext.db);
  const facts = ledger.factsFor(taskId);
  if (!facts.length) return { ok: false, result: { status: "error", error: `no task ${taskId}` } };
  const task = foldTask(facts);
  if (task.latest.seq !== seenSeq) return { ok: false, result: conflictActionResult({
    status: "conflict",
    taskId,
    expectedSeq: seenSeq,
    currentSeq: task.latest.seq,
    delta: task.facts.filter((fact) => fact.seq > seenSeq),
  }) };
  if (task.state !== "open") return { ok: false, result: { status: "error", error: `task ${taskId} is already ${task.state}; nothing more can be decided on it` } };
  return { ok: true, task };
}

export function conflictActionResult(conflict: Extract<CompareAndAppendResult, { status: "conflict" }>): ActionResult {
  return {
    status: "ok",
    data: {
      status: "conflict",
      scope: `task:${conflict.taskId}`,
      taskId: conflict.taskId,
      expectedSeq: conflict.expectedSeq,
      currentSeq: conflict.currentSeq,
      delta: conflict.delta.map((fact) => ({
        seq: fact.seq,
        kind: fact.kind,
        by: fact.by,
        source: fact.source,
        payload: fact.payload,
        createdAt: fact.createdAt.toISOString(),
        description: describeFact(fact, { full: true }),
      })),
    },
  };
}

/** Append one decision, or say why not. */
export function writeDecision(
  appContext: RomeAppContext,
  input: { taskId: string; seenSeq: number; source: string; fact: Omit<NewFact, "taskId" | "by" | "source"> },
): ActionResult {
  const ledger = createLedgerRepository(appContext.db);
  const loaded = loadOpenTask(appContext, input.taskId, input.seenSeq);
  if (!loaded.ok) return loaded.result;
  const result = ledger.compareAndAppend(input.taskId, input.seenSeq, [
    { ...input.fact, taskId: input.taskId, by: ORCHESTRATOR, source: input.source } as NewFact,
  ]);
  if (result.status === "conflict") return conflictActionResult(result);
  const written = result.facts[0];
  return { status: "ok", data: { taskId: written.taskId, wrote: written.kind, seq: written.seq } };
}
