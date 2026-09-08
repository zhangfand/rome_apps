import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Fact } from "./facts.js";

const exec = promisify(execFile);

export interface WorkerWorkspace {
  /** Canonical shared Git metadata directory, used to verify repository identity. */
  commonDir: string;
  root: string;
  workingDir: string;
  /** Initial branch; workers may rename it when publishing their result. */
  branch: string;
  baseCommit: string;
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await exec("git", ["-C", cwd, ...args], {
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
    // Do not let a caller's Git context redirect operations out of this tree.
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"].includes(key))),
  });
  return result.stdout.trim();
}

async function repository(directory: string) {
  const workingDir = await realpath(directory);
  const root = await realpath(await git(workingDir, "rev-parse", "--show-toplevel"));
  const commonDir = await realpath(await git(workingDir, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  return { root, commonDir, relativeDir: path.relative(root, workingDir) };
}

/** Only the latest worker can hand over a tree. Lost means it may still write. */
export function reusableWorkspace(facts: readonly Fact[]): WorkerWorkspace | undefined {
  const ordered = [...facts].sort((a, b) => a.seq - b.seq);
  const previous = ordered.filter((fact) => fact.kind === "Started").at(-1);
  if (!previous || previous.kind !== "Started") return undefined;
  const terminal = ordered.find((fact) => fact.seq > previous.seq &&
    (fact.kind === "Returned" || fact.kind === "Failed" || fact.kind === "Lost") &&
    fact.payload.workerId === previous.payload.workerId);
  return terminal && terminal.kind !== "Lost" ? previous.payload.workspace : undefined;
}

/** Fail closed: never fall back to the shared checkout or recreate a missing tree. */
export async function validateWorkspace(workspace: WorkerWorkspace): Promise<void> {
  const actual = await repository(workspace.workingDir);
  if (actual.root !== workspace.root || actual.commonDir !== workspace.commonDir ||
      await realpath(workspace.root) !== workspace.root) {
    throw new Error(`Worker worktree identity changed: ${workspace.root}`);
  }
  // A valid checkout of the same repo is not enough: it must be registered as
  // this linked worktree, not the main checkout or a path outside the tree.
  const gitDir = await realpath(await git(workspace.root, "rev-parse", "--absolute-git-dir"));
  if (gitDir === workspace.commonDir) throw new Error("Worker workspace is the shared main checkout");
  const listing = await git(workspace.root, "worktree", "list", "--porcelain", "-z");
  if (!listing.split("\0").includes(`worktree ${workspace.root}`)) {
    throw new Error(`Worker worktree is no longer registered: ${workspace.root}`);
  }
}

/**
 * Allocate before Started is recorded. No checkout/reset/stash/clean on the
 * source, no copying ignored files or dependencies, and no automatic removal.
 */
export async function prepareWorkspace(input: {
  workingDir: string;
  taskId: string;
  workerId: string;
  previous?: WorkerWorkspace;
}): Promise<WorkerWorkspace> {
  const repo = await repository(input.workingDir);
  if (input.previous) {
    if (input.previous.commonDir !== repo.commonDir ||
        path.relative(input.previous.root, input.previous.workingDir) !== repo.relativeDir) {
      throw new Error("Configured repository changed; refusing to reuse the worker's old worktree");
    }
    await validateWorkspace(input.previous);
    if (input.previous.root === repo.root) throw new Error("Worker worktree must differ from the source checkout");
    return input.previous;
  }
  for (const id of [input.taskId, input.workerId]) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Unsafe worker worktree id: ${id}`);
  }
  // Prefer the locally known default branch, not whichever feature branch a
  // legacy worker may have left checked out. No network/fetch in scheduling.
  let baseCommit: string | undefined;
  for (const ref of ["refs/remotes/origin/HEAD", "refs/heads/main", "refs/heads/master", "HEAD"]) {
    try { baseCommit = await git(repo.root, "rev-parse", "--verify", `${ref}^{commit}`); break; }
    catch { /* try the next locally available base */ }
  }
  if (!baseCommit) throw new Error("Worker worktrees require a repository with a committed base");
  const key = createHash("sha256").update(repo.commonDir).digest("hex").slice(0, 12);
  const parent = path.join(path.dirname(path.dirname(repo.commonDir)), ".manager-worktrees", key);
  await mkdir(parent, { recursive: true });
  const root = path.join(await realpath(parent), `${input.taskId}-${input.workerId}`);
  const branch = `manager/${input.taskId}/${input.workerId}`;
  // Git refuses existing paths/branches. Never adopt an unknown leftover tree.
  await git(repo.root, "worktree", "add", "-b", branch, root, baseCommit);
  const workspace = { commonDir: repo.commonDir, root, workingDir: path.join(root, repo.relativeDir), branch, baseCommit };
  await validateWorkspace(workspace);
  return workspace;
}

/** This block is repeated on resumes too: a session may remember an old cwd. */
export function workspaceInstructions(workspace: WorkerWorkspace): string {
  return [
    "Worker workspace (authoritative for this run):",
    `Working directory: ${workspace.workingDir}`,
    `Git worktree root: ${workspace.root}`,
    `Initial branch: ${workspace.branch}`,
    "Move to this working directory before doing any work. Run every edit, build,",
    "test and Git command in this worktree, not the original/shared checkout.",
    "This overrides paths and working directories in earlier session context or task history.",
    "Keep branch changes inside this worktree; never force-checkout a branch used by another worktree.",
    "Install dependencies here if needed; do not share node_modules or copy ignored/private files from the source.",
    "Do not remove this worktree: follow-up workers need its branch and uncommitted work.",
    "Do not reinstall or upgrade the running Manager controller unless the task explicitly authorizes deployment.",
  ].join("\n");
}

export function bindWorkspacePrompt(prompt: string, workspace: WorkerWorkspace, sourceDir: string): string {
  // Remove only the fresh header's shared cwd, not user prose or history.
  const oldHeader = `Working directory: ${sourceDir}\nStart by moving there; every path below is relative to it.`;
  return `${workspaceInstructions(workspace)}\n\n${prompt.replace(oldHeader, "All task paths are relative to the worker working directory above.")}`;
}
