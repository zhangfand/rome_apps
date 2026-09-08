import { type ClosedIssue, GITHUB, type NewFact } from "./facts.js";
import { isTerminal, type LedgerSnapshot, type TaskView } from "./fold.js";
import { type IssueRef, issueRefsIn } from "./github-refs.js";

/**
 * Ending a task from GitHub. A person is not the only thing that ends a task:
 * the issue they named in the brief is the source of truth for whether the
 * work is wanted and whether it is done. When GitHub closes it as completed,
 * the task is Completed; closed as not planned (or duplicate), the task is
 * Cancelled. Either way the runtime transcribes; it decides nothing.
 *
 * Everything here is pure. The reconcile action fetches issue states and hands
 * them in; this module decides which tasks to ask about and what to write.
 *
 * - Only the brief counts. A worker's report may name an issue, but that is
 *   the worker's claim; the person's words are the contract.
 * - Any open task ends, whatever its position. A worker still running on it
 *   is stopped by the usual terminal-task rule — the issue closing is the
 *   person's word that the work is over, done or dropped.
 * - Every issue in the brief must be closed. Two issues in one brief means
 *   both were asked for. If every one was dropped the task is Cancelled;
 *   if any was completed, the task is Completed.
 */

/** What the poll learned about one issue. */
export interface IssueStatus {
  state: "open" | "closed";
  closedAt?: string;
  /** GitHub's `state_reason`: `completed`, `not_planned`, `duplicate`, or unset on older closes. */
  stateReason?: string;
}

export interface IssueWatch {
  taskId: string;
  refs: IssueRef[];
}

/** Reasons that mean the work was dropped rather than done. */
const DROPPED_REASONS = new Set(["not_planned", "duplicate"]);

/** Open tasks whose briefs name issues, with the issues to ask about. */
export function issuesToWatch(snapshot: LedgerSnapshot): IssueWatch[] {
  const out: IssueWatch[] = [];
  for (const task of snapshot.tasks) {
    if (isTerminal(task.state)) continue;
    const refs = issueRefsIn(task.brief);
    if (refs.length === 0) continue;
    out.push({ taskId: task.id, refs });
  }
  return out;
}

/**
 * The fact that ends a watched task, given what GitHub said, or nothing if any
 * issue is still open or unknown. `source` cites the issues, the way a
 * person's Completed cites their message.
 */
export function endedByIssues(
  task: TaskView,
  refs: readonly IssueRef[],
  statuses: ReadonlyMap<string, IssueStatus>,
): NewFact | undefined {
  const closed: ClosedIssue[] = [];
  for (const ref of refs) {
    const status = statuses.get(ref.url);
    if (!status || status.state !== "closed") return undefined;
    closed.push({
      url: ref.url,
      closedAt: status.closedAt ?? "",
      ...(status.stateReason ? { stateReason: status.stateReason } : {}),
    });
  }
  if (closed.length === 0) return undefined;

  const dropped = closed.every((issue) => DROPPED_REASONS.has(issue.stateReason ?? ""));
  const kind = dropped ? "Cancelled" : "Completed";
  const list = closed.map((issue) => issue.url).join(", ");
  const noun = closed.length === 1 ? "issue" : "issues";
  const how = dropped ? "closed as not planned" : "closed";

  return {
    taskId: task.id,
    kind,
    by: GITHUB,
    source: `${noun} ${how} on GitHub: ${list}`,
    payload: {
      reason:
        closed.length === 1
          ? `issue ${closed[0].url} was ${how}`
          : `all ${closed.length} issues were ${how}`,
      issues: closed,
    },
  };
}
