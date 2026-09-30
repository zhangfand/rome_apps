import { attentionText, bucketTask, factBody, latestText, safeText, type TaskBucket } from "./facts.js";
import type { TaskSummary } from "./types.js";
import { webDomain } from "../domain.js";

/**
 * Parent/child Task lineage, derived only from the `parent` link each child's
 * request carries. A child is a full Task with its own lead, Jobs and history;
 * nothing here schedules, nests or rolls up work — it only reads summaries the
 * board already polls.
 */

export type ChildGroup = "needs-you" | "running" | "resting" | "done";

export const CHILD_GROUPS: ReadonlyArray<{ group: ChildGroup; label: string }> = [
  { group: "needs-you", label: "Needs you" },
  { group: "running", label: "Running" },
  { group: "resting", label: "Resting" },
  { group: "done", label: "Done" },
];

const GROUP_OF: Record<TaskBucket, ChildGroup> = {
  "needs-you": "needs-you",
  running: "running",
  resting: "resting",
  closed: "done",
};

export function childGroup(task: TaskSummary): ChildGroup {
  return GROUP_OF[bucketTask(task)];
}

/**
 * The Tasks a parent started, in the order its lead created them. Creation
 * order keeps a row still while the person reads, whatever changes on it.
 */
export function childrenOf(tasks: readonly TaskSummary[], parentId: string): TaskSummary[] {
  return tasks
    .filter((task) => task.parent?.taskId === parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function groupChildren(children: readonly TaskSummary[]): Record<ChildGroup, TaskSummary[]> {
  const groups: Record<ChildGroup, TaskSummary[]> = { "needs-you": [], running: [], resting: [], done: [] };
  for (const child of children) groups[childGroup(child)].push(child);
  return groups;
}

export interface ChildRollup {
  total: number;
  open: number;
  counts: Record<ChildGroup, number>;
}

export function rollup(children: readonly TaskSummary[]): ChildRollup {
  const groups = groupChildren(children);
  const counts = {
    "needs-you": groups["needs-you"].length,
    running: groups.running.length,
    resting: groups.resting.length,
    done: groups.done.length,
  };
  return { total: children.length, open: children.length - counts.done, counts };
}

/** "1 needs you · 1 running · 2 done" — only groups that have a Task. */
export function rollupCounts(summary: ChildRollup): string {
  return CHILD_GROUPS
    .filter(({ group }) => summary.counts[group] > 0)
    .map(({ group, label }) => `${summary.counts[group]} ${label.toLowerCase()}`)
    .join(" · ");
}

/**
 * What a parent is waiting on, when its open children are the whole story:
 * "Waiting on 2 of the 3 tasks it started: 1 running, 1 needs you."
 * Undefined when every child has finished (or there are none), so callers fall
 * back to the parent's own latest news.
 */
export function waitingOnChildren(children: readonly TaskSummary[]): string | undefined {
  const summary = rollup(children);
  if (!summary.open) return undefined;
  const parts = CHILD_GROUPS
    .filter(({ group }) => group !== "done" && summary.counts[group] > 0)
    .map(({ group, label }) => `${summary.counts[group]} ${label.toLowerCase()}`);
  const noun = summary.total === 1 ? "task" : "tasks";
  const scope = summary.open === summary.total
    ? summary.total === 1 ? `the ${noun} it started` : `the ${summary.total} ${noun} it started`
    : `${summary.open} of the ${summary.total} ${noun} it started`;
  return `Waiting on ${scope}: ${parts.join(", ")}.`;
}

/**
 * The one activity line under a child row. A running child's worker todo
 * progress is rendered beside this by the row itself.
 */
export function childActivity(task: TaskSummary): string {
  const group = childGroup(task);
  if (group === "needs-you") return attentionText(task);
  if (group === "running") {
    if (!task.liveWorker) return "Queued for the next free worker.";
    const current = task.lastDecision ? factBody(task.lastDecision) : undefined;
    return current ? current.body || current.title || "Working on it." : "Working on it.";
  }
  if (group === "resting" && task.waiting) return safeText(task.waiting.reason);
  return latestText(task);
}

/** The plan item as a person reads it: the lead's stable id, made safe for display. */
export function planItemLabel(task: TaskSummary): string | undefined {
  return task.parent ? safeText(task.parent.planItemId) : undefined;
}

/**
 * A link for a child's spec or plan reference. The domain knows how its work
 * repository is browsed; without it only an absolute http(s) URL is linked.
 */
export function artifactHref(ref: string, task: TaskSummary): string | undefined {
  const fromDomain = webDomain().artifactUrl?.(ref, task);
  if (fromDomain) return fromDomain;
  const trimmed = ref.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}
