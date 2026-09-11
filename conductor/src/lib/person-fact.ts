import type { ActionResult, RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import type { Fact, NewFact } from "./facts.js";
import { foldTask, type TaskView } from "./fold.js";
import { personFromContext } from "./identity.js";

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
  tickNow = true,
): Promise<ActionResult> {
  const ledger = createLedgerRepository(appContext.db);
  if (!ledger.reachable()) {
    return { status: "error", error: "the ledger is unreachable" };
  }

  const fact = ledger.append({ ...unstamped, by: personFromContext() } as NewFact);

  if (tickNow) await appContext.runAction("conductor:tick", {}, { detached: true });

  return { status: "ok", data: summarize(fact, ledger.factsFor(unstamped.taskId)) };
}

export function loadTask(
  appContext: RomeAppContext,
  taskId: string,
): { ok: true; task: TaskView } | { ok: false; error: string } {
  const ledger = createLedgerRepository(appContext.db);
  const facts = ledger.factsFor(taskId);
  if (facts.length === 0) {
    return { ok: false, error: `no task ${taskId}` };
  }
  return { ok: true, task: foldTask(facts) };
}

export function rejectIfClosed(task: TaskView): string | undefined {
  if (task.state !== "open") {
    return `task ${task.id} is already ${task.state}`;
  }
  return undefined;
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
