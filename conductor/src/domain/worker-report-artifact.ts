import type { WorkerReportInput } from "../core/lib/composition.js";
import type { PinnedArtifactRef } from "../core/lib/facts.js";
import type { TaskView } from "../core/lib/fold.js";
import { persistTextArtifacts } from "./work-repo-artifacts.js";
import { workRepoFor } from "./work-repo.js";

/**
 * Store one worker run's full report in the project's work repository, so the
 * ledger and every later prompt can cite it instead of repeating it.
 */
export async function archiveWorkerReport(task: TaskView, input: WorkerReportInput): Promise<PinnedArtifactRef | undefined> {
  const workRepo = workRepoFor(task.project);
  if (!workRepo) return undefined;
  const artifactPath = workerReportPath(task.id, input.workerId);
  const refs = await persistTextArtifacts(workRepo, [{
    path: artifactPath,
    mediaType: "text/markdown",
    content: workerReportMarkdown(task.id, input),
  }], `conductor: worker report ${input.workerId} for ${task.id}`);
  const ref = refs.get(artifactPath);
  if (!ref) throw new Error("work repository did not return the persisted worker report reference");
  return { repo: ref.repo, path: ref.path, commit: ref.commit, sha256: ref.sha256, bytes: ref.bytes, url: ref.url };
}

export function workerReportPath(taskId: string, workerId: string): string {
  return `_conductor/tasks/${taskId}/reports/${workerId}.md`;
}

export function workerReportMarkdown(taskId: string, input: WorkerReportInput): string {
  return [
    "---",
    `taskId: ${taskId}`,
    ...(input.jobId ? [`jobId: ${input.jobId}`] : []),
    `workerId: ${input.workerId}`,
    `agent: ${input.agent}`,
    `status: ${input.status}`,
    `returnedAt: ${input.returnedAt.toISOString()}`,
    "---",
    "",
    `# Worker report: ${input.summary}`,
    "",
    "> Runtime-owned copy of the worker's reply, cited by its Returned fact. The Task ledger remains authoritative for status, summary, and detail.",
    "",
    ...(input.detail && Object.keys(input.detail).length
      ? ["## Detail", "", ...Object.entries(input.detail).map(([key, value]) => `- ${key}: ${value}`), ""]
      : []),
    "## Report",
    "",
    input.report.trim(),
    "",
  ].join("\n");
}
