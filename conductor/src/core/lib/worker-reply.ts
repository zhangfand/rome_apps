import { WORKER_STATUSES, type WorkerStatus } from "./facts.js";

/**
 * The worker's reply is semi-structured. Its closing `conductor` block carries
 * the generic job result — a status from a small enum and a one-paragraph
 * summary — plus an optional `detail:` section of indented `key: value` lines
 * for a job-specific structured result (for example `needs: pm`). Everything
 * before the block is the worker's free-form report.
 *
 * The runtime records what it can parse and never rejects a reply — an
 * unparseable one is recorded as `unparsed` with the raw text, and the
 * orchestrator reads it like any other.
 */

export interface ParsedReply {
  status: WorkerStatus;
  summary: string;
  report?: string;
  detail?: Record<string, string>;
  raw?: string;
}

const REPORTABLE = WORKER_STATUSES.filter((s) => s !== "unparsed");

export function parseWorkerReply(reply: string): ParsedReply {
  const text = reply.trim();
  const block = text.match(/```conductor\s*\n([\s\S]*?)\n```\s*$/) ?? text.match(/```conductor\s*\n([\s\S]*?)```/);
  if (block) {
    const fields: Record<string, string> = {};
    const detail: Record<string, string> = {};
    let section: "summary" | "detail" | undefined;
    let lastDetailKey: string | undefined;
    for (const line of block[1].split("\n")) {
      const top = line.match(/^\s*(status|summary|detail)\s*:\s*(.*)$/i);
      const indented = /^\s+\S/.test(line);
      if (top && !(section === "detail" && indented)) {
        const key = top[1].toLowerCase();
        section = key === "summary" ? "summary" : key === "detail" ? "detail" : undefined;
        if (key !== "detail") fields[key] = top[2].trim();
        lastDetailKey = undefined;
        continue;
      }
      if (!line.trim()) continue;
      if (section === "detail") {
        const entry = line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*(.*)$/);
        if (entry) {
          lastDetailKey = entry[1].toLowerCase();
          detail[lastDetailKey] = entry[2].trim();
        } else if (lastDetailKey) {
          detail[lastDetailKey] = `${detail[lastDetailKey]} ${line.trim()}`.trim();
        }
      } else if (section === "summary") {
        fields.summary += ` ${line.trim()}`;
      }
    }
    const status = fields.status?.toLowerCase().replace(/[^a-z]/g, "") as WorkerStatus | undefined;
    const report = text.slice(0, text.indexOf("```conductor")).trim();
    if (status && (REPORTABLE as readonly string[]).includes(status) && fields.summary) {
      return {
        status,
        summary: fields.summary,
        ...(report ? { report } : {}),
        ...(Object.keys(detail).length ? { detail } : {}),
      };
    }
  }
  // Lossy fallback: keep everything, mark it for the orchestrator to interpret.
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "(empty reply)";
  return { status: "unparsed", summary: firstLine.slice(0, 400), report: text, raw: text };
}
