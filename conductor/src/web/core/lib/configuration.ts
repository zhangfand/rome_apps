import type { WorkspaceInspection } from "./types.js";

/** Follow an acknowledged server value unless the person has changed this row locally. */
export function reconcileDefaultSelection(current: boolean, previous: boolean, next: boolean): boolean {
  return current === previous ? next : current;
}

export function workspaceInspectionStatus(
  inspection: WorkspaceInspection | null,
  error: string | null,
  workspaceOptional = false,
): string {
  if (workspaceOptional) return "✓ No working directory is needed.";
  if (error) return `✗ ${error}`;
  if (!inspection) return "Checking workspace…";
  if (inspection.problem) return `⚠ Workspace is unusable: ${inspection.problem}`;
  if (!inspection.exists) return "✗ Working directory does not exist.";
  if (!inspection.isRepository) return "⚠ Workspace is unusable.";
  return "✓ Workspace is ready.";
}
