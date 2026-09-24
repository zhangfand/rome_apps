import type { ConductorConfig } from "./config.js";
import { describeFact } from "./facts.js";
import type { TaskView } from "./fold.js";
import { coordinatorFacts } from "./ledger-snapshot.js";
import { type Workspace, workspaceKind, type WorkspaceProvider } from "./workspaces.js";

/**
 * The worker's prompt carries only what is specific to this Job: its identity,
 * the coordinator's instructions, and where to work. The worker protocol (its
 * role, how to read cited artifacts, workspace rules, and the reply block) is
 * part of each worker Agent's system prompt, not repeated here.
 */
export function buildWorkerPrompt(input: {
  task: TaskView;
  /** Absent only for legacy Dispatched facts. */
  jobId?: string;
  instructions: string;
  workspace: Workspace;
  /** True when the worker continues a session that already holds the framing. */
  resuming: boolean;
  providerFor(kind: string): WorkspaceProvider;
  defaultWorkspaceKind: string;
  projectNote?: string;
}): string {
  const { task, instructions, workspace, resuming, providerFor } = input;
  const lines: string[] = [];
  lines.push(
    resuming
      ? `Continuing job ${input.jobId ?? "(legacy)"} on task ${task.id} with new instructions.`
      : `Job ${input.jobId ?? "(legacy)"} on task ${task.id}${input.projectNote ?? ""}.`,
    "",
    "## Instructions",
    instructions,
    "",
  );
  // A workspace kind with nothing to say adds no section: a worker on a task
  // that touches no files is never told about checkouts or branches.
  const workspaceBlock = providerFor(workspaceKind(workspace, input.defaultWorkspaceKind)).instructions(workspace);
  if (workspaceBlock) lines.push(workspaceBlock);
  return lines.join("\n").trimEnd();
}

/**
 * The orchestrator's prompt for one wake: only what is new or specific to this
 * wake. Task-level identity is sent on the Session's first turn; operating
 * policy, the worker roster, and the decision protocol live in the configured
 * Agent's system prompt. Worker scheduling is not exposed.
 */
export function buildOrchestratorPrompt(input: {
  task: TaskView;
  /** Tasks this lead materialized; empty for an ordinary execution task. */
  children?: readonly TaskView[];
  now: Date;
  why: string;
  projectNote?: string;
  /**
   * Last Task fact already delivered to this Agent Instance's one Session.
   * Absent for the first turn, which receives a complete durable snapshot.
   */
  deliveredThroughSeq?: number;
}): string {
  const { task, now, why } = input;
  const seenSeq = task.latest.seq;
  const resumed = input.deliveredThroughSeq !== undefined;
  const deliveredThroughSeq = input.deliveredThroughSeq ?? 0;
  const context = coordinatorFacts(task, input.deliveredThroughSeq);
  const deliveredFacts = context.facts;
  const lines: string[] = [];
  lines.push(
    `# Orchestrator wake for task ${task.id}`,
    "",
    `Now: ${now.toISOString()}`,
    `Why you were woken: ${why}`,
    ...(!resumed ? [
      `Project: ${task.projectId ?? "(none)"}${input.projectNote ?? ""}.`,
      `Requested by: ${task.createdBy}`,
    ] : []),
    `Job execution: ${task.liveWorker ? `${task.liveWorker.jobId ?? "legacy job"} is running as ${task.liveWorker.agent} (worker ${task.liveWorker.workerId}, since ${task.liveWorker.startedAt.toISOString()})` : task.pendingJob ? `${task.pendingJob.jobId} is waiting for runtime dispatch as ${task.pendingJob.agent}` : "none"}`,
    `Decisions you have made since the person last spoke: ${task.decisionsSinceLastPersonFact}`,
    `seenSeq: ${seenSeq}`,
    "",
    ...(!resumed && input.task.parent ? [
      "## Delivery lineage",
      `Parent task: ${input.task.parent.taskId}`,
      `Engineering-plan item: ${input.task.parent.planItemId}`,
      ...(input.task.parent.specRef ? [`Spec: ${input.task.parent.specRef}`] : []),
      ...(input.task.parent.planRef ? [`Engineering plan: ${input.task.parent.planRef}`] : []),
      "",
    ] : []),
    ...(!resumed && input.task.replay ? [
      "## Replay fork",
      `Source checkpoint: ${input.task.replay.sourceTaskId} through ledger #${input.task.replay.sourceThroughSeq}`,
      `Pinned coordinator: ${input.task.replay.coordinatorAgent}`,
      `Experimental engineering plan: ${input.task.replay.workRepoPath}`,
      "",
      "### Sanitized checkpoint seed",
      input.task.replay.seed,
      "",
    ] : []),
    ...((input.children?.length ?? 0) > 0 ? [
      "## Materialized tasks",
      ...input.children!.map((child) => {
        const result = child.state === "open"
          ? child.liveWorker ? `running as ${child.liveWorker.agent}` : child.lastDecision ? `open; last decision ${child.lastDecision.kind}#${child.lastDecisionSeq}` : "open; not picked up yet"
          : child.state;
        return `- ${child.parent!.planItemId}: ${child.id} — ${result} — ${child.brief}`;
      }),
      "",
    ] : []),
    context.compacted
      ? `## Ledger context (latest Snapshot #${context.snapshot!.seq} plus uncovered facts)`
      : resumed
        ? `## New ledger facts after #${deliveredThroughSeq} (oldest first)`
        : "## Ledger (every fact on this task, oldest first)",
    ...(context.compacted && !context.snapshot!.payload.summary ? [
      `Snapshot #${context.snapshot!.seq} has an externalized body. Fetch its pinned commit if needed and read that exact Snapshot artifact before deciding; the commit-pinned file, not the work repository's current branch, replaces the covered facts.`,
      "",
    ] : []),
    ...deliveredFacts.map((fact) => describeFact(fact, { full: resumed || fact.seq > task.lastProcessedSeq || fact.kind === "Created" })),
    "",
    "## Now",
    resumed
      ? context.compacted
        ? `This is another turn of the same Agent Instance and Session. Snapshot #${context.snapshot!.seq} replaces its covered raw facts; everything after its covered prefix is included above.`
        : `This is another turn of the same Agent Instance and Session. Earlier Task history remains in your conversation context; only the facts after #${deliveredThroughSeq} are repeated above.`
      : task.lastProcessedSeq > 0
        ? `You last handled this task through #${task.lastProcessedSeq}${task.lastDecision ? ` (last workflow decision #${task.lastDecisionSeq} ${task.lastDecision.kind})` : ""}; everything after it is new to you.`
        : "This is the first time you see this task.",
  );
  return lines.join("\n");
}

