import type { ConductorConfig } from "./config.js";
import type { SharedPromptContract } from "./composition.js";
import { describeFact } from "./facts.js";
import type { TaskView } from "./fold.js";
import { coordinatorFacts } from "./ledger-snapshot.js";
import { replyInstructions } from "./worker-reply.js";
import { projectWorkspaceKind, type Workspace, workspaceKind, type WorkspaceProvider } from "./workspaces.js";

/**
 * The worker's prompt. The orchestrator writes the instructions; the runtime
 * frames them with what every worker needs regardless of domain: which task
 * it is on, the original request, where to work, and how to reply.
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
  sharedContracts?: readonly SharedPromptContract[];
}): string {
  const { task, instructions, workspace, resuming, providerFor } = input;
  const lines: string[] = [];
  if (resuming) {
    lines.push(`You are continuing with job ${input.jobId ?? "(legacy)"} on task ${task.id}. New instructions from the task coordinator follow.`, "");
  } else {
    lines.push(
      `You are running job ${input.jobId ?? "(legacy)"} on task ${task.id}${input.projectNote ?? ""}.`,
      "A lead coordinates the durable Task; it created this bounded Job and will read your result. You do not talk to the requester directly.",
      "",
      "## Original request",
      task.brief,
      "",
    );
  }
  if (input.sharedContracts?.length) {
    lines.push("## Shared artifact contracts", "");
    for (const contract of input.sharedContracts) {
      lines.push(`### ${contract.name}`, contract.content.trim(), "");
    }
  }
  lines.push("## Job instructions from the task coordinator", instructions, "");
  // A workspace kind with nothing to say adds no section: a worker on a task
  // that touches no files is never told about checkouts or branches.
  const workspaceBlock = providerFor(workspaceKind(workspace, input.defaultWorkspaceKind)).instructions(workspace);
  if (workspaceBlock) lines.push(workspaceBlock, "");
  lines.push(replyInstructions());
  return lines.join("\n");
}

/** What this project's workspace kind wants the orchestrator to know, if anything. */
function workspaceNote(task: TaskView, providerFor: (kind: string) => WorkspaceProvider, defaultWorkspaceKind: string): string {
  const note = providerFor(projectWorkspaceKind(task.project, defaultWorkspaceKind)).note(task.project);
  return note ? ` ${note}` : "";
}

/**
 * The orchestrator's prompt for one wake. Everything task-specific it can
 * know: bounded ledger context, what agents it may create Jobs for, and the seq it
 * must cite so a stale decision is refused. Its operating policy lives in the
 * configured Agent's system prompt. Worker scheduling is not exposed.
 */
export function buildOrchestratorPrompt(input: {
  task: TaskView;
  /** Tasks this lead materialized; empty for an ordinary execution task. */
  children?: readonly TaskView[];
  config: ConductorConfig;
  now: Date;
  why: string;
  providerFor(kind: string): WorkspaceProvider;
  defaultWorkspaceKind: string;
  projectNote?: string;
  sharedContracts?: readonly SharedPromptContract[];
  /**
   * Last Task fact already delivered to this Agent Instance's one Session.
   * Absent for the first turn, which receives a complete durable snapshot.
   */
  deliveredThroughSeq?: number;
}): string {
  const { task, config, now, why } = input;
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
    `Project: ${task.projectId ?? "(none)"}${input.projectNote ?? ""}.${workspaceNote(task, input.providerFor, input.defaultWorkspaceKind)}`,
    `Requested by: ${task.createdBy}`,
    `Job execution: ${task.liveWorker ? `${task.liveWorker.jobId ?? "legacy job"} is running as ${task.liveWorker.agent} (worker ${task.liveWorker.workerId}, since ${task.liveWorker.startedAt.toISOString()})` : task.pendingJob ? `${task.pendingJob.jobId} is waiting for runtime dispatch as ${task.pendingJob.agent}` : "none"}`,
    `Decisions you have made since the person last spoke: ${task.decisionsSinceLastPersonFact}`,
    `seenSeq: ${seenSeq}  ← pass this on every decision action`,
    "",
    ...(!resumed ? [
      "## Agents you may create a Job for",
      ...Object.entries(config.workerAgents).map(([agent, description]) => `- \`${agent}\`: ${description}`),
      "",
    ] : []),
    ...(!resumed && input.sharedContracts?.length ? [
      "## Shared artifact contracts",
      "",
      ...input.sharedContracts.flatMap((contract) => [
        `### ${contract.name}`,
        contract.content.trim(),
        "",
      ]),
    ] : []),
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
      "This is a fresh execution branch, not a continuation of the source Task's Agent Session.",
      "The source ledger was intentionally not copied because later facts, stale execution state, and secrets must not leak into this run.",
      "Treat the seed below as the complete checkpoint state. Do not read or mutate the source Task, its later production branch, or its canonical technical-spec.md.",
      "Write replay-specific engineering decisions only to the experimental plan path above. Canonical promotion is a separate human decision.",
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
    ...deliveredFacts.map((fact) => describeFact(fact, { full: resumed || fact.seq > task.lastDecisionSeq || fact.kind === "Created" })),
    "",
    "## Now",
    resumed
      ? context.compacted
        ? `This is another turn of the same Agent Instance and Session. Snapshot #${context.snapshot!.seq} replaces its covered raw facts; everything after its covered prefix is included above.`
        : `This is another turn of the same Agent Instance and Session. Earlier Task history remains in your conversation context; only the facts after #${deliveredThroughSeq} are repeated above.`
      : task.lastDecision ? `Your last decision was #${task.lastDecisionSeq} (${task.lastDecision.kind}); everything after it is new to you.` : "This is the first time you see this task.",
    `Decide the next step and record it with one decision action, citing taskId="${task.id}" and seenSeq=${seenSeq}.`,
  );
  return lines.join("\n");
}
