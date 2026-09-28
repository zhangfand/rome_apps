import { safeText } from "./facts.js";

export type WorkerPlanStepStatus = "pending" | "in_progress" | "completed";

export interface WorkerPlanStep {
  text: string;
  /** Present-tense wording the agent gave for the step while it is running. */
  activeText?: string;
  status: WorkerPlanStepStatus;
}

export interface WorkerPlan {
  steps: WorkerPlanStep[];
  done: number;
  total: number;
  /** What the worker says it is doing now; absent when no step is in progress. */
  current?: string;
}

/**
 * A live worker's own todo list, read from the Rome session it runs in.
 *
 * Rome turns each agent's todo tool into a `plan_update` trace block and keeps
 * the newest one in that turn's trace summary. `GET /api/sessions/:id/messages`
 * returns every turn's trace row with that summary as soon as the turn has
 * started, so one read shows the current list without downloading the trace.
 * This is display only: nothing here is written to the task or read by an agent.
 */
export async function fetchWorkerPlan(sessionId: string, fetchImpl: typeof fetch = fetch): Promise<WorkerPlan | undefined> {
  const response = await fetchImpl(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, { credentials: "include" });
  if (!response.ok) throw new Error(`session messages returned ${response.status}`);
  return latestWorkerPlan(await response.json());
}

/**
 * The todo list of the session's newest turn. An earlier turn's list belongs to
 * an earlier Job, so it is never carried forward: a resumed worker shows no
 * progress until it writes a list of its own.
 */
export function latestWorkerPlan(messages: unknown): WorkerPlan | undefined {
  if (!Array.isArray(messages)) return undefined;
  const rows = messages.filter(isRecord);
  // Rome orders messages by turn start, so the last turn id is the newest turn.
  const turnId = [...rows].reverse().map((row) => row.turnId).find((id): id is string => typeof id === "string" && id.length > 0);
  if (!turnId) return undefined;
  for (const row of [...rows].reverse()) {
    if (row.turnId !== turnId || row.role !== "trace") continue;
    const summary = isRecord(row.traceSummary) ? row.traceSummary : undefined;
    const plan = summary && isRecord(summary.plan) ? summary.plan : undefined;
    const steps = plan ? normalizeSteps(plan.steps) : [];
    if (steps.length) return summarizePlan(steps);
  }
  return undefined;
}

export function summarizePlan(steps: WorkerPlanStep[]): WorkerPlan {
  const running = steps.find((step) => step.status === "in_progress");
  return {
    steps,
    done: steps.filter((step) => step.status === "completed").length,
    total: steps.length,
    ...(running ? { current: running.activeText ?? running.text } : {}),
  };
}

function normalizeSteps(input: unknown): WorkerPlanStep[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((step): WorkerPlanStep[] => {
    if (!isRecord(step) || !isStatus(step.status)) return [];
    const text = typeof step.text === "string" ? safeText(step.text.trim()) : "";
    if (!text) return [];
    const activeText = typeof step.activeText === "string" ? safeText(step.activeText.trim()) : "";
    return [{ text, ...(activeText ? { activeText } : {}), status: step.status }];
  });
}

function isStatus(value: unknown): value is WorkerPlanStepStatus {
  return value === "pending" || value === "in_progress" || value === "completed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
