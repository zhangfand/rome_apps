import type { Fact, StartedFact } from "./facts.js";
import type { TaskView, ResumableSession } from "./fold.js";

/** Controller-owned protocol; all business instructions belong to the user. */
export type Phase = "work" | "prepare" | "evaluate";
export type HookPhase = Exclude<Phase, "work">;
export interface LifecycleHook { agent: string; instructions: string }
/** Missing inherits the global default, null explicitly disables a project hook. */
export interface LifecycleHooks { prepare?: LifecycleHook | null; evaluate?: LifecycleHook | null }
export interface AssessmentContext { submissionSeq: number; agreementSeq?: number }
export const HOOK_INSTRUCTIONS_MAX = 16_000;
export const HOOKS_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: Object.fromEntries(["prepare", "evaluate"].map((phase) => [phase, {
    anyOf: [{ type: "null" }, {
      type: "object", additionalProperties: false, required: ["agent", "instructions"],
      properties: {
        agent: { type: "string", pattern: "^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$" },
        instructions: { type: "string", minLength: 1, maxLength: HOOK_INSTRUCTIONS_MAX },
      },
    }],
  }])),
};

export function parseHooks(raw: unknown): LifecycleHooks | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("hooks must be an object");
  const hooks: LifecycleHooks = {};
  for (const [phase, value] of Object.entries(raw)) {
    if (phase !== "prepare" && phase !== "evaluate") throw new Error(`Unknown lifecycle hook: ${phase}`);
    if (value === null) { hooks[phase] = null; continue; }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${phase} must contain agent and instructions, or be null`);
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some((k) => k !== "agent" && k !== "instructions") ||
      typeof row.agent !== "string" || !/^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/.test(row.agent) ||
      typeof row.instructions !== "string" || !row.instructions.trim() || row.instructions.length > HOOK_INSTRUCTIONS_MAX) {
      throw new Error(`${phase} requires an app:agent id and nonblank instructions (at most ${HOOK_INSTRUCTIONS_MAX} characters)`);
    }
    hooks[phase] = { agent: row.agent, instructions: row.instructions.trim() };
  }
  return hooks;
}

export function resolveHooks(defaults?: LifecycleHooks, overrides?: LifecycleHooks): LifecycleHooks {
  return structuredClone({ ...defaults, ...overrides });
}

/** Only the intake snapshot is authoritative. Never retrofit new settings onto old tasks. */
export function hooksOf(task: TaskView): LifecycleHooks { return task.project?.hooks ?? {}; }

export function lastStart(task: TaskView): StartedFact | undefined {
  return task.facts.filter((f): f is StartedFact => f.kind === "Started").at(-1);
}

export function startFor(task: TaskView, workerId: string): StartedFact | undefined {
  return task.facts.find((f): f is StartedFact => f.kind === "Started" && f.payload.workerId === workerId);
}

export function latestAgreement(task: TaskView) {
  return task.facts.filter((f) => f.kind === "Prepared").at(-1);
}

/** Preparation/evaluation sessions must never replace the coding session being resumed. */
export function workSession(task: TaskView): ResumableSession | undefined {
  let session: ResumableSession | undefined;
  for (const fact of task.facts) {
    if (fact.kind === "Restarted" && fact.payload.rejectedSessionId === session?.sessionId) session = undefined;
    if (fact.kind !== "Returned" && fact.kind !== "Failed" && fact.kind !== "Lost") continue;
    if ((startFor(task, fact.payload.workerId)?.payload.phase ?? "work") !== "work") continue;
    if (fact.kind === "Lost") session = undefined;
    else if (fact.payload.sessionId) session = { workerId: fact.payload.workerId, sessionId: fact.payload.sessionId };
  }
  return session;
}

/** A normal prepare -> work -> evaluate transition is not three failed attempts. */
export function phaseAttempts(task: TaskView, phase: Phase, assessment?: AssessmentContext): number {
  let since = task.lastPersonFactSeq;
  for (const fact of task.facts) {
    if (fact.kind === "Deferred" && (startFor(task, fact.payload.workerId)?.payload.phase ?? "work") === phase) since = Math.max(since, fact.seq);
  }
  return task.facts.filter((f) => f.kind === "Started" && f.seq > since &&
    (f.payload.phase ?? "work") === phase &&
    (phase !== "evaluate" || f.payload.assessment?.submissionSeq === assessment?.submissionSeq)).length;
}

/** Match an assessment to the exact durable submission, never a newer worker's output. */
export function assessmentSubmission(task: TaskView, context?: AssessmentContext): Fact | undefined {
  return task.facts.find((f) => f.kind === "Returned" && f.seq === context?.submissionSeq &&
    (startFor(task, f.payload.workerId)?.payload.phase ?? "work") === "work");
}
