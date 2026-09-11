import { type EventFact, type NewFact, RUNTIME } from "./facts.js";
import type { LedgerSnapshot, TaskView } from "./fold.js";
import { type IssueRef, issueRefsIn } from "./github-refs.js";

/**
 * External events. The runtime watches the GitHub issues an open task names
 * and, when one closes, writes an Event saying so — once per close. It does
 * not end the task; the orchestrator reads the Event and decides, per the
 * SOP, whether that means done, dropped, or nothing yet.
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

/** Events to append for issues that closed and have not been recorded as closed at that time. */
export function issueEvents(task: TaskView, refs: readonly IssueRef[], statuses: ReadonlyMap<string, IssueStatus>): NewFact[] {
  const recorded = new Set(
    task.facts
      .filter((f): f is EventFact => f.kind === "Event" && f.payload.source === "github" && f.payload.type === "issue_closed")
      .map((f) => `${f.payload.data?.url}@${f.payload.data?.closedAt ?? ""}`),
  );
  const out: NewFact[] = [];
  for (const ref of refs) {
    const status = statuses.get(ref.url);
    if (!status || status.state !== "closed") continue;
    const key = `${ref.url}@${status.closedAt ?? ""}`;
    if (recorded.has(key)) continue;
    const reason = status.stateReason ?? "unspecified";
    out.push({
      taskId: task.id,
      kind: "Event",
      by: RUNTIME,
      source: `conductor:tick, polling ${ref.url}`,
      payload: {
        source: "github",
        type: "issue_closed",
        summary: `${ref.url} was closed (state_reason: ${reason}${status.closedAt ? `, at ${status.closedAt}` : ""})`,
        data: { url: ref.url, closedAt: status.closedAt, stateReason: status.stateReason },
      },
    });
  }
  return out;
}
