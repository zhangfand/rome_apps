import type { EventFact } from "../../lib/facts.js";
import type { LedgerSnapshot, TaskView } from "../../lib/fold.js";
import type { PushEventRequest } from "../../lib/ingest.js";
import { type IssueRef, issueRefsIn } from "./refs.js";

/**
 * External events from issues. The adapter watches the GitHub issues an open
 * task names and, when one closes, says so — once per close. It does not end
 * the task; the orchestrator reads the Event and decides, per the SOP, whether
 * that means done, dropped, or nothing yet.
 */

export interface IssueStatus {
  state: "open" | "closed";
  closedAt?: string;
  stateReason?: string;
}

export interface IssueWatch {
  taskId: string;
  refs: IssueRef[];
}

/** Open tasks whose briefs name issues, with the issues to ask about. */
export function issuesToWatch(snapshot: LedgerSnapshot): IssueWatch[] {
  const out: IssueWatch[] = [];
  for (const task of snapshot.tasks) {
    if (task.state !== "open") continue;
    const refs = issueRefsIn(task.brief);
    if (refs.length === 0) continue;
    out.push({ taskId: task.id, refs });
  }
  return out;
}

/**
 * Requests for issues that closed and are not already recorded as closed at
 * that time. The seam dedupes on the key as well; the check here also reads
 * the shape used before the seam existed, so an upgrade does not re-announce
 * a close that is already in the ledger.
 */
export function issueEvents(task: TaskView, refs: readonly IssueRef[], statuses: ReadonlyMap<string, IssueStatus>): PushEventRequest[] {
  const recorded = new Set(
    task.facts
      .filter((f): f is EventFact => f.kind === "Event" && f.payload.source === "github" && f.payload.type === "issue_closed")
      .map((f) => `${f.payload.data?.url}@${f.payload.data?.closedAt ?? ""}`),
  );
  const out: PushEventRequest[] = [];
  for (const ref of refs) {
    const status = statuses.get(ref.url);
    if (!status || status.state !== "closed") continue;
    const stamp = `${ref.url}@${status.closedAt ?? ""}`;
    if (recorded.has(stamp)) continue;
    const reason = status.stateReason ?? "unspecified";
    out.push({
      op: "push_event",
      source: "github",
      taskId: task.id,
      type: "issue_closed",
      key: `closed:${stamp}`,
      summary: `${ref.url} was closed (state_reason: ${reason}${status.closedAt ? `, at ${status.closedAt}` : ""})`,
      cite: `conductor:tick, polling ${ref.url}`,
      data: { url: ref.url, closedAt: status.closedAt, stateReason: status.stateReason },
    });
  }
  return out;
}
