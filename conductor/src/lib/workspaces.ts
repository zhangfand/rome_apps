import type { Fact } from "./facts.js";

/**
 * Where a worker does its work.
 *
 * Conductor was born running software tasks, so for a while there was only one
 * answer: a Git worktree cut from the project's checkout. That made a repo a
 * hard requirement for dispatching anything at all — a research task with no
 * code to touch could not be given a worker. The workspace is a per-project
 * capability instead, and this module is its seam: the loop asks a provider to
 * prepare, validate and describe a workspace, and never learns which kind it
 * got.
 *
 * Be honest about the strength of this: `system:summon` takes no working
 * directory, so a worker runs wherever its agent runs. What a provider controls
 * is what exists on disk before the worker starts and what the prompt tells it
 * about that. `git-worktree` is real isolation because the tree is real and the
 * prompt points at it; `none` is the absence of both, not a sandbox.
 */

export const WORKSPACE_KINDS = ["git-worktree", "none"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const DEFAULT_WORKSPACE_KIND: WorkspaceKind = "git-worktree";

/**
 * A checkout of its own, cut from the project's repository. `kind` is optional
 * because facts written before workspace modes existed carry this shape
 * without it; {@link workspaceKind} reads those as what they were.
 */
export interface GitWorktreeWorkspace {
  kind?: "git-worktree";
  /** Canonical shared Git metadata directory, used to verify repository identity. */
  commonDir: string;
  root: string;
  workingDir: string;
  /** Initial branch; workers may rename it when publishing their result. */
  branch: string;
  baseCommit: string;
}

/** No workspace was prepared, by configuration. Recorded so it is never a guess. */
export interface NoWorkspace {
  kind: "none";
}

export type Workspace = GitWorktreeWorkspace | NoWorkspace;

/** What a project asks of the runtime when a worker starts on it. */
export interface WorkspaceProject {
  workingDir?: string;
  repo?: string;
  workspace?: WorkspaceKind;
}

export interface PrepareWorkspaceInput {
  project: WorkspaceProject;
  taskId: string;
  workerId: string;
  /** The workspace the previous worker handed over, if it ended cleanly. */
  previous?: Workspace;
}

export interface WorkspaceProvider {
  readonly kind: WorkspaceKind;
  /** Allocate before the Dispatched fact is recorded. Throws rather than degrade. */
  prepare(input: PrepareWorkspaceInput): Promise<Workspace>;
  /** Checked before every run, including resumes. Fails closed. */
  validate(workspace: Workspace): Promise<void>;
  /** The block appended to a worker's prompt; empty when there is nothing to say. */
  instructions(workspace: Workspace): string;
  /** One line for the orchestrator's wake prompt; empty when there is nothing to say. */
  note(): string;
}

/** The kind a stored workspace is, reading facts written before kinds existed. */
export function workspaceKind(workspace: Workspace): WorkspaceKind {
  return workspace.kind ?? DEFAULT_WORKSPACE_KIND;
}

/** The kind a project asks for; the Git worktree remains the default. */
export function projectWorkspaceKind(project: WorkspaceProject | undefined): WorkspaceKind {
  return project?.workspace ?? DEFAULT_WORKSPACE_KIND;
}

/**
 * The workspace the last worker left behind, if it may be handed on. Only the
 * latest worker can hand over, and only if it ended cleanly: `Lost` means the
 * worker may still be writing in there.
 *
 * This is about the ledger, not about any kind of workspace, so it lives here
 * rather than in a provider.
 */
export function handedOverWorkspace(facts: readonly Fact[]): Workspace | undefined {
  const ordered = [...facts].sort((a, b) => a.seq - b.seq);
  const previous = ordered.filter((fact) => fact.kind === "Dispatched").at(-1);
  if (!previous || previous.kind !== "Dispatched") return undefined;
  const terminal = ordered.find((fact) => fact.seq > previous.seq &&
    (fact.kind === "Returned" || fact.kind === "Failed" || fact.kind === "Lost") &&
    fact.payload.workerId === previous.payload.workerId);
  return terminal && terminal.kind !== "Lost" ? previous.payload.workspace : undefined;
}
