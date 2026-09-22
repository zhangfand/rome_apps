import type { TaskSnapshotMirrorRef } from "../core/lib/composition.js";
import type { TaskView } from "../core/lib/fold.js";
import { persistTextArtifacts } from "./work-repo-artifacts.js";
import { readPinnedTextArtifact } from "./work-repo-artifacts.js";
import { workRepoFor } from "./work-repo.js";

/** Mirror the newest generated Task state into the project's work repository. */
export async function archiveTaskSnapshot(
  task: TaskView,
  input: { coversThroughSeq: number; generatedAt: Date; summary: string },
): Promise<TaskSnapshotMirrorRef | undefined> {
  const workRepo = workRepoFor(task.project);
  if (!workRepo) return undefined;
  const artifactPath = `_conductor/tasks/${task.id}/snapshot.md`;
  const refs = await persistTextArtifacts(workRepo, [{
    path: artifactPath,
    mediaType: "text/markdown",
    content: archivedSnapshotMarkdown({
      taskId: task.id,
      brief: task.brief,
      coversThroughSeq: input.coversThroughSeq,
      generatedAt: input.generatedAt,
      summary: input.summary,
    }),
  }], `conductor: update ledger snapshot for ${task.id}`);
  const ref = refs.get(artifactPath);
  if (!ref) throw new Error("work repository did not return the persisted Snapshot reference");
  return ref;
}

export function archivedSnapshotMarkdown(input: {
  taskId: string;
  brief: string;
  coversThroughSeq: number;
  generatedAt: Date;
  summary: string;
}): string {
  return [
    "---",
    `taskId: ${input.taskId}`,
    `coversThroughSeq: ${input.coversThroughSeq}`,
    `generatedAt: ${input.generatedAt.toISOString()}`,
    "---",
    "",
    `# Task ledger snapshot: ${input.brief}`,
    "",
    "> Runtime-owned body referenced by a Conductor Snapshot fact. The append-only Task ledger remains authoritative for identity, ordering, and coverage.",
    "",
    input.summary.trim(),
    "",
  ].join("\n");
}

/** Extract the compacted state body from the self-describing archived file. */
export function archivedSnapshotSummary(markdown: string): string {
  const quote = markdown.indexOf("\n> ");
  const body = quote < 0 ? -1 : markdown.indexOf("\n\n", quote);
  if (body < 0) throw new Error("Pinned Snapshot artifact has no body separator");
  const summary = markdown.slice(body + 2).trim();
  if (!summary) throw new Error("Pinned Snapshot artifact has an empty body");
  return summary;
}

export async function readArchivedTaskSnapshot(
  task: TaskView,
  ref: TaskSnapshotMirrorRef,
): Promise<string> {
  const workRepo = workRepoFor(task.project);
  if (!workRepo) throw new Error("Task has no configured work repository for its externalized Snapshot");
  return archivedSnapshotSummary(await readPinnedTextArtifact(workRepo, ref));
}
