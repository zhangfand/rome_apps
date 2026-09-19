import type { ActionResult, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import type { Fact, NewFact } from "./facts.js";
import { foldTask } from "./fold.js";
import { personFromContext } from "./identity.js";
import { conflictActionResult } from "./decision.js";

/** A person's fact, minus the author — the runtime fills that in. */
export type UnstampedFact = Omit<NewFact, "by"> & { source: string };

/**
 * The person-facing actions all do the same three things: stamp the person,
 * append one fact, and tick so the orchestrator is woken for it now rather
 * than on the next scheduled pass. The words and the task are the agent's
 * choice; `by` is not.
 */
export async function writePersonFact(
  appContext: RomeAppContext,
  unstamped: UnstampedFact,
  expectedSeq?: number,
  tickNow = true,
): Promise<ActionResult> {
  const ledger = createLedgerRepository(appContext.db);
  if (!ledger.reachable()) {
    return { status: "error", error: "the ledger is unreachable" };
  }

  const next = { ...unstamped, by: personFromContext() } as NewFact;
  let fact: Fact;
  if (expectedSeq === undefined) {
    fact = ledger.append(next);
  } else {
    const result = ledger.compareAndAppend(unstamped.taskId, expectedSeq, [next]);
    if (result.status === "conflict") return conflictActionResult(result);
    fact = result.facts[0];
  }

  if (tickNow) await appContext.runAction("conductor:reconcile_tasks", {}, { detached: true });

  return { status: "ok", data: summarize(fact, ledger.factsFor(unstamped.taskId)) };
}

function summarize(fact: Fact, facts: readonly Fact[]) {
  const task = foldTask(facts);
  return {
    taskId: fact.taskId,
    wrote: fact.kind,
    seq: fact.seq,
    by: fact.by,
    state: task.state,
    liveWorker: task.liveWorker?.workerId,
  };
}
