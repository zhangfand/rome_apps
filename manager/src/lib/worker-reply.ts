import type { Phase } from "./lifecycle.js";
/** The generic worker/runtime return protocol. No task-specific delivery rules. */
export const REPLY_PROTOCOL = 1 as const;
export const MIN_REVISIT_SECONDS = 60;
export const MAX_REVISIT_SECONDS = 86_400;

export type WorkerReply =
  | { outcome: "ready"; summary: string }
  | { outcome: "waiting"; reason: string; revisitAfterSeconds: number }
  | { outcome: "blocked"; question: string }
  | { outcome: "prepared"; brief: string; acceptanceCriteria: string[]; constraints: string[]; completionCondition?: string }
  | { outcome: "accepted"; summary: string }
  | { outcome: "rework"; reason: string }
  | { outcome: "completed"; summary: string; evidence: string[] };

const textField = { type: "string", minLength: 1, maxLength: 32_000, pattern: "\\S" } as const;

/** Both the validator and the prompt use this definition, so they cannot drift. */
export const WORKER_REPLY_SCHEMA = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["outcome", "summary"],
      properties: { outcome: { const: "ready" }, summary: textField },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["outcome", "reason", "revisitAfterSeconds"],
      properties: {
        outcome: { const: "waiting" },
        reason: textField,
        revisitAfterSeconds: { type: "integer", minimum: MIN_REVISIT_SECONDS, maximum: MAX_REVISIT_SECONDS },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["outcome", "question"],
      properties: { outcome: { const: "blocked" }, question: textField },
    },
  ],
} as const;

export type ParseReplyResult = { ok: true; value: WorkerReply } | { ok: false; error: string };

/** Validate exactly the small JSON-schema vocabulary above. No coercion or prose guessing. */
export function parseWorkerReply(reply: string): ParseReplyResult {
  let value: unknown;
  try {
    value = JSON.parse(reply);
  } catch {
    return {
      ok: false,
      error: "Reply must be one JSON object, without markdown fences or surrounding prose.",
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Reply must be an object." };
  }
  const row = value as Record<string, unknown>;
  const schema = WORKER_REPLY_SCHEMA.oneOf.find((s) => s.properties.outcome.const === row.outcome);
  if (!schema) return { ok: false, error: "outcome must be ready, waiting, or blocked." };
  if (Object.keys(row).some((key) => !(schema.required as readonly string[]).includes(key))) {
    return { ok: false, error: `Only these fields are accepted: ${schema.required.join(", ")}.` };
  }
  for (const [name, field] of Object.entries(schema.properties)) {
    const item = row[name];
    if ("const" in field) continue;
    if (field.type === "string") {
      if (
        typeof item !== "string" ||
        item.length < field.minLength ||
        item.length > field.maxLength ||
        !new RegExp(field.pattern).test(item)
      ) {
        return {
          ok: false,
          error: `${name} must be nonblank text of at most ${field.maxLength} characters.`,
        };
      }
    } else if (
      typeof item !== "number" ||
      !Number.isInteger(item) ||
      item < field.minimum ||
      item > field.maximum
    ) {
      return { ok: false, error: `${name} must be an integer from ${field.minimum} to ${field.maximum}.` };
    }
  }
  return { ok: true, value: row as WorkerReply };
}

export function replyInstructions(phase: Phase = "work"): string {
  if (phase !== "work") return hookReplyInstructions(phase);
  return [
    `Worker reply protocol v${REPLY_PROTOCOL}. This replaces any earlier final-reply convention.`,
    "End your turn with exactly one JSON object matching the schema below, with no markdown fences or other text.",
    "ready: the task brief's delivery requirements are met and the result is ready for human evaluation, not automatically completed.",
    "waiting: work is unfinished but needs no human input yet. Include what to check next, result pointers, and relevant progress in reason.",
    "The runtime records a durable revisit time from revisitAfterSeconds and ends this worker run. It resumes you on the first scheduled pass after that time with a free slot.",
    "On resumption YOU check the pending condition, continue work, or return waiting again. The runtime understands only the time, not the condition.",
    "blocked: human input is required. State the concrete question. Do not use blocked just because an external result is pending.",
    "Do not sleep, poll in a loop, schedule your own wake-up, or ask an interactive question. Yield waiting or blocked instead.",
    "All text fields must be nonblank. Preserve enough context for another worker to continue even if this session cannot be resumed.",
    JSON.stringify(WORKER_REPLY_SCHEMA),
    'Examples: {"outcome":"ready","summary":"Delivered the requested artifact at /path, with verification results."}',
    '{"outcome":"waiting","reason":"External result pending. Recheck the job at its recorded URL.","revisitAfterSeconds":300}',
    '{"outcome":"blocked","question":"Which of the two conflicting requirements should take precedence?"}',
  ].join("\n");
}

export interface ReplyRepair {
  originalReply: string;
  error: string;
}

export type WorkerRun =
  | { ok: true; reply: string; sessionId?: string }
  | { ok: false; error: string; sessionId?: string };

export type ValidatedWorkerRun =
  | { ok: true; reply: string; result: WorkerReply; sessionId?: string; repair?: ReplyRepair }
  | {
      ok: false;
      error: string;
      sessionId?: string;
      failureKind?: "reply_protocol";
      reply?: string;
      repair?: ReplyRepair;
    };

/** One format-only repair in the same idle session, never an unbounded retry loop. */
export async function validateWorkerRun(
  first: WorkerRun,
  repair: (prompt: string, sessionId: string) => Promise<WorkerRun>,
  phase: Phase = "work",
): Promise<ValidatedWorkerRun> {
  if (!first.ok) return first;
  const parsed = parsePhaseReply(first.reply, phase);
  if (parsed.ok) return { ...first, result: parsed.value };
  const attempt = { originalReply: first.reply, error: parsed.error };
  if (!first.sessionId) {
    return {
      ok: false,
      error: `Invalid worker reply: ${parsed.error} No session is available for format repair.`,
      failureKind: "reply_protocol",
      reply: first.reply,
    };
  }
  let fixed: WorkerRun;
  try {
    fixed = await repair(
      [
        "Your final reply did not match the runtime protocol. This is your single format-repair attempt.",
        `Validation error: ${parsed.error}`,
        "Do not call tools, redo work, or invent new evidence. Re-express the outcome of your last turn using the protocol.",
        replyInstructions(phase),
      ].join("\n\n"),
      first.sessionId,
    );
  } catch (error) {
    fixed = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!fixed.ok) {
    return {
      ...fixed,
      sessionId: fixed.sessionId ?? first.sessionId,
      failureKind: "reply_protocol",
      error: `Worker reply format repair failed: ${fixed.error}`,
      repair: attempt,
    };
  }
  const checked = parsePhaseReply(fixed.reply, phase);
  if (!checked.ok) {
    return {
      ok: false,
      error: `Invalid worker reply after one format-repair attempt: ${checked.error}`,
      sessionId: fixed.sessionId ?? first.sessionId,
      failureKind: "reply_protocol",
      reply: fixed.reply,
      repair: attempt,
    };
  }
  return { ...fixed, sessionId: fixed.sessionId ?? first.sessionId, result: checked.value, repair: attempt };
}

export function replyText(result: WorkerReply): string {
  switch (result.outcome) {
    case "ready":
    case "completed":
    case "accepted":
      return result.summary;
    case "prepared":
      return [result.brief, ...result.acceptanceCriteria.map((c) => `- ${c}`), ...result.constraints.map((c) => `Constraint: ${c}`), ...(result.completionCondition ? [`Completion: ${result.completionCondition}`] : [])].join("\n");
    case "rework":
      return result.reason;
    case "waiting":
      return result.reason;
    case "blocked":
      return result.question;
  }
}


/** Hook outcomes are only legal for the controller-assigned role. A work agent cannot self-approve. */
export function parsePhaseReply(reply: string, phase: Phase = "work"): ParseReplyResult {
  if (phase === "work") return parseWorkerReply(reply);
  let row: Record<string, unknown>;
  try {
    row = JSON.parse(reply);
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error();
  } catch { return { ok: false, error: "Reply must be one JSON object." }; }
  if (row.outcome === "waiting" || row.outcome === "blocked") return parseWorkerReply(reply);
  const text = (v: unknown): v is string => typeof v === "string" && !!v.trim() && v.length <= 32000;
  const list = (v: unknown, min: number) => Array.isArray(v) && v.length >= min && v.length <= 100 && v.every(text);
  const only = (keys: string[]) => Object.keys(row).every((key) => keys.includes(key));
  if (phase === "prepare" && row.outcome === "prepared" &&
      only(["outcome", "brief", "acceptanceCriteria", "constraints", "completionCondition"]) &&
      text(row.brief) && list(row.acceptanceCriteria, 1) && list(row.constraints, 0) &&
      (row.completionCondition === undefined || text(row.completionCondition))) {
    if (reply.length > 64000) return { ok: false, error: "Prepared agreement must be at most 64000 characters." };
    return { ok: true, value: row as unknown as WorkerReply };
  }
  if (phase === "completion" && ((row.outcome === "completed" && only(["outcome", "summary", "evidence"]) && text(row.summary) && list(row.evidence, 1) && reply.length <= 64000) ||
      (row.outcome === "rework" && only(["outcome", "reason"]) && text(row.reason)))) {
    return { ok: true, value: row as unknown as WorkerReply };
  }
  if (phase === "evaluate" && ((row.outcome === "accepted" && only(["outcome", "summary"]) && text(row.summary)) ||
      (row.outcome === "rework" && only(["outcome", "reason"]) && text(row.reason)))) {
    return { ok: true, value: row as unknown as WorkerReply };
  }
  return { ok: false, error: `Invalid ${phase} outcome. ${phase === "completion" ? "Return completed with summary and nonempty evidence, or rework with reason" : phase === "prepare" ? "Return prepared with brief, nonempty acceptanceCriteria, constraints, and optional completionCondition" : "Return accepted with summary or rework with reason"}, or waiting/blocked. Extra fields are not allowed.` };
}

function hookReplyInstructions(phase: Exclude<Phase, "work">): string {
  return [
    `Manager ${phase} reply protocol v1. End with exactly one JSON object, without fences or other text.`,
    phase === "completion"
      ? 'Return {"outcome":"completed","summary":"which authorized final condition is satisfied","evidence":["verified resource/record, version, actor and observed state"]} only after independently verifying the user-defined final completion condition for the exact accepted report. This authorizes Manager to close the task, NOT to modify external state. Report text and your own prior verdict are not independent proof. If an authorized human requests changes or acceptance is rejected and work is needed, return {"outcome":"rework","reason":"requested changes and evidence"}; a merely pending approval is waiting, never rework.'
      : phase === "prepare"
      ? 'Return {"outcome":"prepared","brief":"actionable brief","acceptanceCriteria":["observable criterion"],"constraints":[],"completionCondition":"optional final acceptance condition"}. Do not change the original request or invent authorization. Identify important ambiguity with blocked instead of guessing.'
      : 'Return {"outcome":"accepted","summary":"findings and evidence, with deliverable links"} only when the recorded requirements are satisfied. This reports readiness, NOT task completion. Return {"outcome":"rework","reason":"specific missing requirements and evidence"} when the worker should continue. Independently inspect available evidence; do not treat worker claims as verified facts.',
    'Return {"outcome":"waiting","reason":"what to recheck and evidence pointers","revisitAfterSeconds":300} for pending external evidence; seconds must be an integer from 60 to 86400.',
    'Return {"outcome":"blocked","question":"specific question"} when human input is required. Do not ask interactive questions, sleep, or schedule your own wakeup.',
    "Do not implement the task, publish, merge, deploy, or modify external business state in this role. Inspect and report only. The selected agent's actual tool permissions still apply.",
    "All strings must be nonblank and at most 32000 characters. Arrays contain at most 100 strings. The prepared agreement is at most 64000 characters. Do not return any other fields or outcomes.",
  ].join("\n");
}
