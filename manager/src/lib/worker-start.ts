import type { LedgerRepository } from "../db/repositories/ledger.js";
import type { ManagerConfig } from "./config.js";
import type { NewFact, StartedFact } from "./facts.js";
import { workSession } from "./lifecycle.js";
import { foldTask } from "./fold.js";
import { buildWorkerPrompt } from "./prompt.js";
import { bindWorkspacePrompt, prepareWorkspace, reusableWorkspace } from "./worktree.js";
import { configForTask } from "./projects.js";

/** The I/O boundary: prepare -> record the exact workspace/brief -> launch. */
export async function prepareWorkerStart(
  fact: NewFact,
  ledger: Pick<LedgerRepository, "factsFor" | "append" | "appendWorkerOutcome">,
  config: ManagerConfig,
): Promise<string> {
  const payload = fact.payload as StartedFact["payload"];
  const history = ledger.factsFor(fact.taskId);
  const task = foldTask(history);
  const previous = reusableWorkspace(history);
  let prepared: NewFact;
  try {
    config = configForTask(config, task);
    const workspace = await prepareWorkspace({
      workingDir: config.workingDir,
      taskId: fact.taskId,
      workerId: payload.workerId,
      previous,
    });
    // A legacy session remembers the shared checkout. Migrating it requires a
    // fresh session/full brief, not a delta pretending its filesystem survived.
    const sessionWorker = workSession(task);
    const sessionStart = history.find((f) => f.kind === "Started" && f.payload.workerId === sessionWorker?.workerId);
    const canResume = !payload.resumeSessionId || (sessionWorker?.sessionId === payload.resumeSessionId && sessionStart?.kind === "Started" &&
      sessionStart.payload.workspace?.root === workspace.root);
    const prompt = canResume ? payload.prompt : buildWorkerPrompt({
      task: foldTask(history), config, phase: payload.phase, hook: payload.hook, assessment: payload.assessment,
      reason: "moving from a legacy shared checkout to an isolated worktree; recover prior work from the task history as needed",
    });
    prepared = { ...fact, payload: {
      ...payload,
      projectId: task.projectId,
      project: task.project,
      resumeSessionId: canResume ? payload.resumeSessionId : undefined,
      workspace,
      prompt: bindWorkspacePrompt(prompt, workspace, config.workingDir),
    } };
  } catch (err) {
    // Normal failure accounting/caps, never a silent shared-checkout fallback.
    ledger.append({ ...fact, payload: { ...payload, workspace: previous } });
    const error = `Could not prepare isolated worker worktree: ${err instanceof Error ? err.message : String(err)}`;
    ledger.appendWorkerOutcome({ taskId: fact.taskId, kind: "Failed", by: payload.workerId,
      source: "manager:reconcile, preparing worker worktree", payload: { workerId: payload.workerId, error } });
    return `Failed(${payload.workerId}): ${error}`;
  }
  ledger.append(prepared);
  return `Started(${fact.taskId}) in ${(prepared.payload as StartedFact["payload"]).workspace!.workingDir}`;
}
