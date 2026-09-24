import type { ComponentProps } from "react";
import type { Badge } from "@rome-os/ui/badge";
import type { FactJson, TaskSummary } from "./types";
import { formatStamp } from "./format";
import { webDomain } from "../domain";

export type TaskBucket = "needs-you" | "running" | "resting" | "closed";
export type Tone = "person" | "neutral" | "question" | "report" | "success" | "destructive" | "info" | "quiet";
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/**
 * Tones expressed as kit Badge variants. Five land on a variant that paints the
 * same token pair the bespoke chip did (`question`→warning, `success`,
 * `destructive`, `info`, `neutral`→muted); `person` and `report` take the
 * nearest kit tone rather than carrying a private tint, and `quiet` shares
 * `muted` because the kit has no fainter step. Paint now comes from the kit, so
 * the app no longer owns a second chip palette.
 */
export const TONE_BADGE: Record<Tone, BadgeVariant> = {
  person: "info",
  neutral: "muted",
  question: "warning",
  report: "brand",
  success: "success",
  destructive: "destructive",
  info: "info",
  quiet: "muted",
};

/** Tone as text colour alone, for places that carry state without a filled chip. */
export const TONE_TEXT: Record<Tone, string> = {
  person: "text-info-fg",
  neutral: "text-muted-foreground",
  question: "text-warning-fg",
  report: "text-primary-hover",
  success: "text-success-fg",
  destructive: "text-destructive-fg",
  info: "text-info-fg",
  quiet: "text-subtle-foreground",
};

const LABELS: Record<string, string> = {
  Created: "request",
  Reply: "reply",
  JobCreated: "job",
  Dispatched: "started work",
  JobFailed: "job failed",
  Opened: "session",
  Returned: "came back",
  Waited: "waiting",
  Asked: "question",
  Reported: "report",
  Completed: "done",
  Cancelled: "cancelled",
  Failed: "failed",
  Lost: "lost",
  // Notes are quiet implementation detail and are hidden by default. When
  // revealed, this neutral word describes the content rather than its storage.
  ACK: "acknowledged",
  Noted: "update",
  Snapshot: "snapshot",
};

export function factLabel(kind: string): string {
  return kind === "Event" ? webDomain().externalFactLabel : LABELS[kind] ?? "update";
}

export function isSafetyEvent(fact: FactJson | undefined): boolean {
  return fact?.kind === "Event" && value(fact.payload, "type") === "circuit_breaker";
}

/**
 * An Asked/Reported decision needs the person only until that person writes a
 * newer fact. `lastDecision` is historical and deliberately remains present
 * after a reply, so it must never be used by itself as outstanding attention.
 */
export function hasOutstandingPersonDecision(task: TaskSummary): boolean {
  return task.decisionsSinceLastPersonFact > 0 &&
    (task.lastDecision?.kind === "Asked" || task.lastDecision?.kind === "Reported");
}

/** The four user-facing task groups are derived solely from TaskSummary. */
export function bucketTask(task: TaskSummary): TaskBucket {
  if (task.state !== "open") return "closed";
  if (task.liveWorker || task.pendingJob) return "running";
  if (task.waiting) return "resting";
  if (isSafetyEvent(task.latest) || hasOutstandingPersonDecision(task)) {
    return "needs-you";
  }
  return "resting";
}

export function taskStateLabel(task: TaskSummary): string {
  const bucket = bucketTask(task);
  if (bucket === "running") return task.liveWorker ? "running" : "queued";
  if (bucket === "resting") return "waiting";
  if (bucket === "closed") return task.state === "completed" ? "completed" : "cancelled";
  if (isSafetyEvent(task.latest)) return "paused";
  return task.lastDecision?.kind === "Asked" ? "question" : "report";
}

export function taskTone(task: TaskSummary): Tone {
  const bucket = bucketTask(task);
  if (bucket === "running" || bucket === "resting") return "neutral";
  if (bucket === "closed") return task.state === "completed" ? "success" : "quiet";
  if (isSafetyEvent(task.latest)) return "destructive";
  return task.lastDecision?.kind === "Asked" ? "question" : "report";
}

export function factTone(fact: FactJson): Tone {
  if (fact.kind === "Returned") {
    const status = value(fact.payload, "status");
    if (status === "succeeded") return "success";
    if (status === "waiting") return "question";
    if (status === "failed" || status === "blocked") return "destructive";
  }
  switch (fact.kind) {
    case "Created":
    case "Reply": return "person";
    case "JobCreated":
    case "Waited":
    case "Returned": return "neutral";
    case "Dispatched":
    case "Opened":
    case "ACK":
    case "Noted":
    case "Snapshot":
    case "Cancelled": return "quiet";
    case "Asked": return "question";
    case "Reported": return "report";
    case "Completed": return "success";
    case "JobFailed":
    case "Failed":
    case "Lost": return "destructive";
    case "Event": return "info";
    default: return "quiet";
  }
}

/** Raw identities become the four plain author labels used by the detail views. */
export function authorLabel(by: string, kind?: string): string {
  if (by === "orchestrator") return "conductor";
  if (by === "conductor:ledger-compactor") return "compactor";
  if (by === "runtime") return "runtime";
  if (/^w-[0-9a-z-]+$/i.test(by)) return "worker";
  return webDomain().authorLabel(by, kind) ?? "you";
}

/** Resolve a stored role/id to the concrete identity shown in Activity. */
export function activityAuthorLabel(
  fact: Pick<FactJson, "by" | "kind">,
  coordinatorAgent: string | undefined,
  workerAgents: ReadonlyMap<string, string>,
): string {
  const role = authorLabel(fact.by, fact.kind);
  if (role === "conductor") return coordinatorAgent || role;
  if (role === "worker") return workerAgents.get(fact.by) || role;
  // Person facts are stored with the guardian/channel user id. Showing that id
  // is more useful here than collapsing every person to the generic "you".
  return role === "you" ? fact.by : role;
}

export function authorLane(fact: FactJson): 1 | 2 | 3 | 4 {
  if (fact.kind === "Event" || fact.kind === "Snapshot" || fact.by === "runtime") return 4;
  const author = authorLabel(fact.by, fact.kind);
  if (author === "conductor") return 2;
  if (author === "worker") return 3;
  return 1;
}

export function isRoutine(fact: FactJson): boolean {
  return fact.kind === "Opened" || fact.kind === "ACK" || fact.kind === "Noted" || fact.kind === "Snapshot" || (fact.kind === "Dispatched" && typeof fact.payload.jobId === "string");
}

export function expandedTextLabel(fact: FactJson): "instructions" | "detail" {
  return fact.kind === "JobCreated" || fact.kind === "Dispatched" ? "instructions" : "detail";
}

export interface FactContent {
  title: string;
  body: string;
  extra?: string;
}

/** Payload-aware, user-facing copy. Internal kind names never become labels. */
export function factBody(fact: FactJson): FactContent {
  const p = fact.payload;
  const s = (key: string) => safeText(value(p, key));
  switch (fact.kind) {
    case "Created": return { title: "", body: s("brief") };
    case "Reply": return { title: "", body: s("text") };
    case "Completed": return { title: "", body: [s("reason"), s("evidence") ? `Evidence: ${s("evidence")}` : ""].filter(Boolean).join("\n\n") };
    case "Cancelled": return { title: "", body: s("reason") };
    case "JobCreated": return {
      title: [value(p, "jobId"), value(p, "agent") ? `for ${value(p, "agent")}` : ""].filter(Boolean).join(" "),
      body: s("note") || "Conductor created the next bounded job.",
      extra: s("instructions") || undefined,
    };
    case "Dispatched": return {
      title: [value(p, "workerId"), value(p, "agent") ? `as ${value(p, "agent")}` : ""].filter(Boolean).join(" "),
      body: s("note") || "Work started on this request.",
      extra: s("instructions") || undefined,
    };
    case "Asked": return { title: "", body: s("question") };
    case "Reported": return { title: "", body: s("report") };
    case "Waited": return {
      title: value(p, "resumeAfter") ? `Waiting until ${formatStamp(value(p, "resumeAfter"))}` : "Waiting",
      body: s("reason"),
    };
    case "ACK": return { title: "", body: s("summary") };
    case "Noted": return { title: "", body: s("note") };
    case "JobFailed": return { title: `Job ${s("jobId")} could not start`, body: s("error") };
    case "Opened": return { title: value(p, "romeSessionId") ? `Session ${value(p, "romeSessionId")}` : "Session opened", body: "" };
    case "Returned": {
      // `detail` is the structured job result; facts written before `report`
      // existed stored the free-form report there as a string.
      const detail = p.detail && typeof p.detail === "object" && !Array.isArray(p.detail)
        ? Object.entries(p.detail as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string")
          .map(([k, v]) => `${k}: ${safeText(v as string)}`)
          .join("\n")
        : "";
      const report = s("report") || s("detail");
      return { title: sentenceCase(value(p, "status")), body: s("summary"), extra: [detail, report].filter(Boolean).join("\n\n") || undefined };
    }
    case "Failed": return { title: "Work failed", body: s("error") };
    case "Lost": return { title: "Work stopped", body: s("why") };
    case "Event": return { title: eventTitle(fact), body: s("summary") };
    case "Snapshot": {
      const mirror = p.workRepo && typeof p.workRepo === "object" && !Array.isArray(p.workRepo)
        ? p.workRepo as Record<string, unknown>
        : undefined;
      const url = mirror ? value(mirror, "url") : "";
      return {
        title: value(p, "coversThroughSeq") ? `History through #${value(p, "coversThroughSeq")}` : "Task history snapshot",
        body: `Earlier ledger entries were compressed for future coordinator context.${url ? ` [Open work-repo mirror](${url})` : ""}`,
        extra: s("summary") || undefined,
      };
    }
    default: return { title: "", body: "An update was recorded." };
  }
}

export function latestText(task: TaskSummary): string {
  const content = factBody(task.latest);
  return [content.title, content.body].filter(Boolean).join(" — ") || "No summary was provided.";
}

export function attentionText(task: TaskSummary): string {
  const item = isSafetyEvent(task.latest) ? task.latest : task.lastDecision ?? task.latest;
  const content = factBody(item);
  return content.body || content.title || "Your input is needed before this can continue.";
}

export function eventTitle(fact: FactJson): string {
  const type = value(fact.payload, "type");
  if (type === "circuit_breaker") return "I stopped picking this up";
  return webDomain().eventTitle(fact) ?? "Something changed";
}

/** Keep implementation vocabulary out of payload prose while preserving meaning. */
export function safeText(text: string): string {
  return text
    .replace(/\bappend-only\b/gi, "lasting")
    .replace(/\bseenSeq\b/g, "current position")
    .replace(/\bcircuit_breaker\b/gi, "safety limit")
    .replace(/\borchestrators?\b/gi, (word) => word.toLowerCase().endsWith("s") ? "conductors" : "conductor")
    .replace(/\bledgers?\b/gi, (word) => word.toLowerCase().endsWith("s") ? "histories" : "history")
    .replace(/\bworktrees?\b/gi, (word) => word.toLowerCase().endsWith("s") ? "working folders" : "working folder")
    .replace(/\bwakes?\b/gi, "picks up")
    .replace(/\bwaking\b/gi, "picking up")
    .replace(/\bwoken\b/gi, "picked up")
    .replace(/\bfacts?\b/gi, (word) => word.toLowerCase().endsWith("s") ? "events" : "event")
    .replace(/\bDispatched\b/g, "Started work")
    .replace(/\bJobCreated\b/g, "Created job")
    .replace(/\bJobFailed\b/g, "Job failed")
    .replace(/\bReturned\b/g, "Came back")
    .replace(/\bACK\b/g, "Acknowledged")
    .replace(/\bNoted\b/g, "Updated")
    .replace(/\bLost\b/g, "Stopped");
}

function value(payload: Record<string, unknown>, key: string): string {
  return typeof payload[key] === "string" ? payload[key] as string : "";
}

function sentenceCase(text: string): string {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Came back";
}
