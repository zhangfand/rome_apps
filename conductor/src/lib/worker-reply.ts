import { WORKER_STATUSES, type WorkerStatus } from "./facts.js";

/**
 * The worker's reply is semi-structured: a status from a small enum, a
 * one-paragraph summary, and free-form detail. The runtime records what it
 * can parse and never rejects a reply — an unparseable one is recorded as
 * `unparsed` with the raw text, and the orchestrator reads it like any other.
 */

export interface ParsedReply {
  status: WorkerStatus;
  summary: string;
  detail?: string;
  raw?: string;
}

const REPORTABLE = WORKER_STATUSES.filter((s) => s !== "unparsed");

export function replyInstructions(): string {
  return [
    "## How to reply",
    "",
    "When you are finished, end your final message with a fenced block exactly like this:",
    "",
    "```conductor",
    "status: <one of succeeded | failed | blocked | waiting>",
    "summary: <one or two sentences: what you did and the key result (PR URL, commit, finding, question)>",
    "```",
    "",
    "- succeeded: the instructions were carried out and verified.",
    "- failed: you could not do it; say why in the summary.",
    "- blocked: you need a decision or information from a person; put the exact question in the summary.",
    "- waiting: something external must happen first (CI, a review, a merge); say what, and suggest when to check again.",
    "",
    "Everything before the block is your detail: what you found, what you changed, how you verified it. Be concrete — URLs, commits, commands run.",
  ].join("\n");
}

export function parseWorkerReply(reply: string): ParsedReply {
  const text = reply.trim();
  const block = text.match(/```conductor\s*\n([\s\S]*?)\n```\s*$/) ?? text.match(/```conductor\s*\n([\s\S]*?)```/);
  if (block) {
    const fields: Record<string, string> = {};
    for (const line of block[1].split("\n")) {
      const m = line.match(/^\s*(status|summary)\s*:\s*(.*)$/i);
      if (m) fields[m[1].toLowerCase()] = m[2].trim();
      else if (fields.summary !== undefined && line.trim()) fields.summary += ` ${line.trim()}`;
    }
    const status = fields.status?.toLowerCase().replace(/[^a-z]/g, "") as WorkerStatus | undefined;
    const detail = text.slice(0, text.indexOf("```conductor")).trim();
    if (status && (REPORTABLE as readonly string[]).includes(status) && fields.summary) {
      return { status, summary: fields.summary, ...(detail ? { detail } : {}) };
    }
  }
  // Lossy fallback: keep everything, mark it for the orchestrator to interpret.
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "(empty reply)";
  return { status: "unparsed", summary: firstLine.slice(0, 400), detail: text, raw: text };
}
