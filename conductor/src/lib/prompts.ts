import type { ConductorConfig } from "./config.js";
import { sopFor } from "./config.js";
import { describeFact } from "./facts.js";
import type { TaskView } from "./fold.js";
import { replyInstructions } from "./worker-reply.js";
import { type WorkerWorkspace, workspaceInstructions } from "./worktree.js";

/**
 * The worker's prompt. The orchestrator writes the instructions; the runtime
 * frames them with what every worker needs regardless of domain: which task
 * it is on, the original request, where to work, and how to reply.
 */
export function buildWorkerPrompt(input: {
  task: TaskView;
  instructions: string;
  workspace: WorkerWorkspace;
  /** True when the worker continues a session that already holds the framing. */
  resuming: boolean;
}): string {
  const { task, instructions, workspace, resuming } = input;
  const lines: string[] = [];
  if (resuming) {
    lines.push(`You are continuing your work on task ${task.id}. New instructions from the orchestrator follow.`, "");
  } else {
    lines.push(
      `You are a worker on task ${task.id}${task.project?.repo ? ` (repository ${task.project.repo})` : ""}.`,
      "An orchestrator coordinates this task; it wrote the instructions below and will read your reply. You do not talk to the requester directly.",
      "",
      "## Original request",
      task.brief,
      "",
    );
  }
  lines.push("## Instructions from the orchestrator", instructions, "");
  lines.push(workspaceInstructions(workspace), "");
  lines.push(replyInstructions());
  return lines.join("\n");
}

/**
 * The orchestrator's prompt for one wake. Everything it can know: the SOP,
 * the task's whole ledger, what agents it may dispatch, how many worker
 * slots are free, and the seq it must cite so a stale decision is refused.
 */
export function buildOrchestratorPrompt(input: {
  task: TaskView;
  config: ConductorConfig;
  now: Date;
  why: string;
  freeSlots: number;
}): string {
  const { task, config, now, why, freeSlots } = input;
  const seenSeq = task.latest.seq;
  const lines: string[] = [];
  lines.push(
    `# Orchestrator wake for task ${task.id}`,
    "",
    `Now: ${now.toISOString()}`,
    `Why you were woken: ${why}`,
    `Project: ${task.projectId ?? "(none)"}${task.project?.repo ? ` (GitHub ${task.project.repo})` : ""}. Workers get their own checkout; you need not tell them where.`,
    `Requested by: ${task.createdBy}`,
    `Live worker: ${task.liveWorker ? `${task.liveWorker.workerId} (${task.liveWorker.agent}, since ${task.liveWorker.startedAt.toISOString()})` : "none"}`,
    `Free worker slots: ${freeSlots} of ${config.maxWorkers}`,
    `Decisions you have made since the person last spoke: ${task.decisionsSinceLastPersonFact}`,
    `seenSeq: ${seenSeq}  ← pass this on every decision action`,
    "",
    "## Agents you may dispatch a worker as",
    ...Object.entries(config.workerAgents).map(([agent, description]) => `- \`${agent}\`: ${description}`),
    "",
    "## SOP",
    sopFor(config, task.projectId),
    "",
    "## Ledger (every fact on this task, oldest first)",
    ...task.facts.map((fact) => describeFact(fact, { full: fact.seq > task.lastDecisionSeq || fact.kind === "Created" })),
    "",
    "## Now",
    task.lastDecision ? `Your last decision was #${task.lastDecisionSeq} (${task.lastDecision.kind}); everything after it is new to you.` : "This is the first time you see this task.",
    `Decide the next step and record it with one decision action, citing taskId="${task.id}" and seenSeq=${seenSeq}.`,
  );
  return lines.join("\n");
}
