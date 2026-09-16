import type { ActionResult, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
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

export function loadOpenTask(appContext: RomeAppContext, taskId: string, seenSeq: number): { ok: true; task: TaskView } | { ok: false; error: string } {
  const ledger = createLedgerRepository(appContext.db);
  const facts = ledger.factsFor(taskId);
  if (!facts.length) return { ok: false, error: `no task ${taskId}` };
  const task = foldTask(facts);
  if (task.state !== "open") return { ok: false, error: `task ${taskId} is already ${task.state}; nothing more can be decided on it` };
  if (task.latest.seq !== seenSeq) return { ok: false, error: staleMessage(task, seenSeq) };
  return { ok: true, task };
}

function staleMessage(task: TaskView, seenSeq: number): string {
  const newer = task.facts.filter((f) => f.seq > seenSeq).map((f) => describeFact(f));
  return `The ledger advanced past #${seenSeq} (now #${task.latest.seq}). Read what is new, then decide again with seenSeq=${task.latest.seq}:\n${newer.join("\n")}`;
}

/** Append one decision, or say why not. */
export function writeDecision(
  appContext: RomeAppContext,
  input: { taskId: string; seenSeq: number; source: string; fact: Omit<NewFact, "taskId" | "by" | "source"> },
): ActionResult {
  const ledger = createLedgerRepository(appContext.db);
  const loaded = loadOpenTask(appContext, input.taskId, input.seenSeq);
  if (!loaded.ok) return { status: "error", error: loaded.error };
  const written = ledger.appendIfLatest(
    { ...input.fact, taskId: input.taskId, by: ORCHESTRATOR, source: input.source } as NewFact,
    input.seenSeq,
  );
  if (!written) {
    const again = loadOpenTask(appContext, input.taskId, input.seenSeq);
    return { status: "error", error: again.ok ? "The ledger changed while writing; decide again." : again.error };
  }
  return { status: "ok", data: { taskId: written.taskId, wrote: written.kind, seq: written.seq } };
}
