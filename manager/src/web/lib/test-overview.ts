import type { TaskSummary } from "./types";

export function task(id: string, patch: Partial<TaskSummary> = {}): TaskSummary {
  return { id, brief: `Task ${id} does useful work`, state: "taken", position: "working", projectId: "rome",
    createdAt: "2026-09-09T00:00:00Z", updatedAt: "2026-09-09T01:00:00Z", createdBy: "ann", factCount: 42,
    startsSinceLastPersonFact: 3, workers: [], latest: { seq: 1, id: "f1", taskId: id, kind: "Taken", by: "runtime", payload: {}, createdAt: "2026-09-09T01:00:00Z", line: "taken" }, ...patch };
}
export function fixtureTasks() {
  return [
    task("question", { position: "stuck", attention: { kind: "Question", text: "Which database should I use? See https://github.com/acme/repo/pull/9" } }),
    task("pr", { position: "reported", attention: { kind: "Report", text: "Historical claim: all CI passed. https://github.com/acme/repo/pull/42" } }),
    task("result", { position: "reported", attention: { kind: "Report", text: "## Summary\nFound four Git LFS objects.\n\n## Evidence\nFull evidence." } }),
    task("running", { liveWorkerId: "w1" }),
    task("waiting", { position: "waiting", waiting: { reason: "Waiting for the upstream issue.", resumeAfter: "2026-09-10T00:00:00Z" } }),
    task("created", { state: "created", position: undefined }),
    task("done", { state: "completed", attention: { kind: "Report", text: "Old https://github.com/acme/repo/pull/1" } }),
    task("cancelled", { state: "cancelled" }),
  ];
}
