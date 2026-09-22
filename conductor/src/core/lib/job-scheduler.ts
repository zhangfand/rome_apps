import { createAppLogger, type RomeAppContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository, JOB_SCHEDULER_LOCK } from "../db/repositories/lock.js";
import { createRuntimeControlRepository } from "../db/repositories/runtime-control.js";
import type { CoreComposition } from "./composition.js";
import type { ConductorConfig } from "./config.js";
import { type DispatchedFact, type JobFailedFact, RUNTIME } from "./facts.js";
import { fold, sessionLeftBy, type TaskView } from "./fold.js";
import { buildWorkerPrompt } from "./prompts.js";
import { handedOverWorkspace, projectWorkspaceKind } from "./workspaces.js";

const log = createAppLogger("conductor:job-scheduler");
const SCHEDULER_LEASE_MS = 15 * 60_000;

export interface JobDispatchOutcome {
  dispatched: Array<{ taskId: string; jobId: string; workerId: string }>;
  failed: Array<{ taskId: string; jobId: string; error: string }>;
  pending: Array<{ taskId: string; jobId: string }>;
  skipped?: string;
}

/**
 * Materialize queued Jobs into concrete worker runs. This is deliberately
 * below the coordinator boundary: Jobs name logical agents and instructions;
 * this scheduler owns slots, worker ids, session reuse, workspaces and launch.
 */
export async function dispatchPendingJobs(input: {
  appContext: RomeAppContext;
  composition: CoreComposition;
  config: ConductorConfig;
  /** Limit an eager pass to the task that just created a Job. */
  taskId?: string;
}): Promise<JobDispatchOutcome> {
  const { appContext, composition, config } = input;
  const runtimeControl = createRuntimeControlRepository(appContext.db);
  if (runtimeControl.get().paused) {
    return { dispatched: [], failed: [], pending: pendingJobs(appContext, input.taskId), skipped: "runtime paused" };
  }
  const locks = createLockRepository(appContext.db);
  if (!locks.tryAcquire(JOB_SCHEDULER_LOCK, SCHEDULER_LEASE_MS)) {
    return { dispatched: [], failed: [], pending: [], skipped: "another scheduler pass is running" };
  }

  try {
    const ledger = createLedgerRepository(appContext.db);
    const initial = fold(new Date(), ledger.all());
    let freeSlots = Math.max(0, config.maxWorkers - initial.tasks.filter((task) => task.liveWorker).length);
    const candidates = initial.tasks.filter((task) =>
      task.state === "open" && !task.liveWorker && task.pendingJob && (!input.taskId || task.id === input.taskId),
    );
    const outcome: JobDispatchOutcome = { dispatched: [], failed: [], pending: [] };

    for (const task of candidates) {
      const job = task.pendingJob!;
      if (freeSlots < 1) {
        outcome.pending.push({ taskId: task.id, jobId: job.jobId });
        continue;
      }

      const validationError = !Object.hasOwn(config.workerAgents, job.agent)
        ? `agent ${job.agent} is no longer configured`
        : !task.project
          ? "task has no project binding; runtime cannot prepare a workspace"
          : undefined;
      if (validationError) {
        if (appendJobFailure(ledger, task, validationError)) {
          outcome.failed.push({ taskId: task.id, jobId: job.jobId, error: validationError });
        }
        continue;
      }
      const project = task.project!;

      const contractNames = composition.promptContracts
        ? [...new Set([
            ...composition.promptContracts.defaultForWorker(job.agent),
            ...(job.contracts ?? []),
          ])]
        : [];
      const previousWorkerId = config.reuseSessions
        ? reusableWorkerForAgent(task, job.agent, contractNames)
        : undefined;
      const resumeSessionId = previousWorkerId ? sessionLeftBy(task, previousWorkerId) : undefined;
      const workerId = `w-${crypto.randomUUID().slice(0, 8)}`;
      const workspaceKind = projectWorkspaceKind(project, composition.defaultWorkspaceKind);

      try {
        const workspace = await composition.providerFor(workspaceKind).prepare({
          project,
          taskId: task.id,
          workerId,
          previous: handedOverWorkspace(task.facts),
        });
        // A developer may pause while workspace preparation is in flight. Read
        // the durable switch again before writing Dispatched or starting a run.
        if (runtimeControl.get().paused) {
          outcome.pending.push({ taskId: task.id, jobId: job.jobId });
          break;
        }
        const contracts = !resumeSessionId && contractNames.length
          ? await composition.promptContracts!.resolve(task, contractNames)
          : [];
        const prompt = buildWorkerPrompt({
          task,
          jobId: job.jobId,
          instructions: job.instructions,
          workspace,
          resuming: Boolean(resumeSessionId),
          providerFor: composition.providerFor,
          defaultWorkspaceKind: composition.defaultWorkspaceKind,
          projectNote: composition.projectPromptNote?.(task, "worker"),
          sharedContracts: contracts,
        });
        const payload: DispatchedFact["payload"] = {
          jobId: job.jobId,
          workerId,
          agent: job.agent,
          instructions: job.instructions,
          ...(contractNames.length ? { contracts: contractNames } : {}),
          prompt,
          ...(job.note ? { note: job.note } : {}),
          ...(resumeSessionId && previousWorkerId
            ? { resumeWorkerId: previousWorkerId, resumeSessionId }
            : {}),
          workspace,
          projectId: task.projectId,
          project,
        };
        const write = ledger.compareAndAppend(task.id, job.createdSeq, [{
          taskId: task.id,
          kind: "Dispatched",
          by: RUNTIME,
          source: "conductor:job-scheduler",
          payload,
        }]);
        if (write.status === "conflict") {
          outcome.pending.push({ taskId: task.id, jobId: job.jobId });
          continue;
        }

        freeSlots -= 1;
        const receipt = await appContext.runAction("conductor:run_job", { taskId: task.id, workerId }, { detached: true });
        log.info("job dispatched", {
          taskId: task.id,
          jobId: job.jobId,
          workerId,
          agent: job.agent,
          workspace: workspaceKind,
          resumed: Boolean(resumeSessionId),
          executionId: receipt.executionId,
        });
        outcome.dispatched.push({ taskId: task.id, jobId: job.jobId, workerId });
      } catch (error) {
        const message = `Could not dispatch job: ${error instanceof Error ? error.message : String(error)}`;
        if (appendJobFailure(ledger, task, message)) {
          outcome.failed.push({ taskId: task.id, jobId: job.jobId, error: message });
        }
      }
    }
    return outcome;
  } finally {
    locks.release(JOB_SCHEDULER_LOCK);
  }
}

function pendingJobs(appContext: RomeAppContext, taskId?: string): Array<{ taskId: string; jobId: string }> {
  return fold(new Date(), createLedgerRepository(appContext.db).all()).tasks
    .filter((task) => task.state === "open" && !task.liveWorker && task.pendingJob && (!taskId || task.id === taskId))
    .map((task) => ({ taskId: task.id, jobId: task.pendingJob!.jobId }));
}

function appendJobFailure(
  ledger: ReturnType<typeof createLedgerRepository>,
  task: TaskView,
  error: string,
): boolean {
  const job = task.pendingJob!;
  const payload: JobFailedFact["payload"] = { jobId: job.jobId, agent: job.agent, error };
  return ledger.compareAndAppend(task.id, job.createdSeq, [{
    taskId: task.id,
    kind: "JobFailed",
    by: RUNTIME,
    source: "conductor:job-scheduler",
    payload,
  }]).status === "written";
}

/** The newest cleanly returned session for this logical agent, if one exists. */
export function reusableWorkerForAgent(
  task: TaskView,
  agent: string,
  requiredContracts: readonly string[] = [],
): string | undefined {
  for (const fact of [...task.facts].reverse()) {
    if (fact.kind !== "Returned" || !fact.payload.sessionId) continue;
    const dispatch = task.facts.find((candidate) =>
      candidate.kind === "Dispatched" && candidate.payload.workerId === fact.payload.workerId,
    );
    if (dispatch?.kind === "Dispatched" && dispatch.payload.agent === agent) {
      const available = new Set(dispatch.payload.contracts ?? []);
      const hasContracts = requiredContracts.every((name) =>
        available.has(name) || dispatch.payload.prompt.includes(name),
      );
      if (hasContracts) return fact.payload.workerId;
    }
  }
  return undefined;
}
