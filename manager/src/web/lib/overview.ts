import { briefText, gist, handleOf, plain, refsIn, titleOf } from "./domain";
import type { TaskSummary } from "./types";

export function isOpen(task: TaskSummary): boolean {
  return task.state === "created" || task.state === "taken";
}

/** Every open task has exactly one home. No historical PR inference. */
export function overviewGroups(tasks: readonly TaskSummary[]) {
  const groups = { decisions: [] as TaskSummary[], prs: [] as TaskSummary[], progress: [] as TaskSummary[], results: [] as TaskSummary[] };
  for (const task of [...tasks].filter(isOpen).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    if (task.attention?.kind === "Question") groups.decisions.push(task);
    else if (task.attention?.kind === "Report") {
      (refsIn(task.attention.text).some((r) => r.kind === "pr") ? groups.prs : groups.results).push(task);
    } else groups.progress.push(task);
  }
  return groups;
}

export function taskTitle(task: TaskSummary): string {
  return titleOf(briefText(task.brief, handleOf(task)), 180) || "Untitled task";
}

export function resultPreview(text: string): string {
  const summary = plain(gist(text).text).replace(/\s+/g, " ").trim();
  return summary.length > 180 ? `${summary.slice(0, 177).trimEnd()}…` : summary;
}

export function taskStatus(task: TaskSummary): string {
  if (task.state === "completed") return "Completed";
  if (task.state === "cancelled") return "Cancelled";
  if (task.attention?.kind === "Question") return "Needs an answer";
  if (task.attention?.kind === "Report") return "Result available";
  if (task.waiting || task.position === "waiting") return "Waiting";
  if (task.liveWorkerId) return "Working";
  return "Queued";
}
