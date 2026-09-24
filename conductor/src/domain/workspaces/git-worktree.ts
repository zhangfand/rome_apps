import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  type PrepareWorkspaceInput,
  type Workspace,
  type WorkspaceProvider,
  type WorkspaceInspection,
} from "../../core/lib/workspaces.js";
import { parseRepo } from "../adapters/github/config.js";

const exec = promisify(execFile);
export interface GitWorktreeWorkspace extends Workspace {
  kind?: "git-worktree";
  commonDir: string;
  root: string;
  workingDir: string;
  branch: string;
  baseCommit: string;
}

function asGitWorkspace(workspace: Workspace): GitWorktreeWorkspace {
  for (const key of ["commonDir", "root", "workingDir", "branch", "baseCommit"]) {
    if (typeof workspace[key] !== "string") throw new Error("invalid git worktree workspace");
  }
  return workspace as GitWorktreeWorkspace;
}


/**
 * A worktree of its own per worker, cut from the project's checkout: real
 * isolation, because two workers editing one tree would overwrite each other
 * and because a worker that dies must leave its work where the next one can
 * pick it up.
 *
 * This provider is the only place in Conductor that runs Git.
 */
export const gitWorktreeProvider: WorkspaceProvider = {
  kind: "git-worktree",

  inspect: inspectGitWorkspace,

  async prepare(input: PrepareWorkspaceInput): Promise<Workspace> {
    const workingDir = input.project.workingDir;
    if (!workingDir) throw new Error("a git-worktree project needs a workingDir");
    return await prepareWorkspace({
      workingDir,
      taskId: input.taskId,
      workerId: input.workerId,
      previous: input.previous && input.previous.kind !== "none" ? asGitWorkspace(input.previous) : undefined,
    });
  },

  async validate(workspace: Workspace): Promise<void> {
    if (workspace.kind === "none") throw new Error("expected a git worktree, found none");
    await validateWorkspace(asGitWorkspace(workspace));
  },

  instructions(workspace: Workspace): string {
    return workspace.kind === "none" ? "" : workspaceInstructions(asGitWorkspace(workspace));
  },
};

async function gitWithTimeout(cwd: string, timeout: number, ...args: string[]): Promise<string> {
  const result = await exec("git", ["-C", cwd, ...args], {
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    // Do not let a caller's Git context redirect operations out of this tree.
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"].includes(key))),
  });
  return result.stdout.trim();
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  return gitWithTimeout(cwd, 60_000, ...args);
}

type InspectGit = (cwd: string, ...args: string[]) => Promise<string>;

/** Inspect without allowing a slow or malformed repository to break config reads. */
export async function inspectGitWorkspace(
  workingDir: string,
  run: InspectGit = (cwd, ...args) => gitWithTimeout(cwd, 4_000, ...args),
): Promise<WorkspaceInspection> {
  try {
    const entry = await stat(workingDir);
    if (!entry.isDirectory()) return { exists: true, isRepository: false, problem: "Path is not a directory." };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    return code === "ENOENT"
      ? { exists: false, isRepository: false }
      : { exists: false, isRepository: false, problem: shortProblem(error) };
  }

  let root: string;
  try {
    root = await run(workingDir, "rev-parse", "--show-toplevel");
  } catch (error) {
    try {
      if ((await readdir(workingDir)).length === 0) return { exists: true, isRepository: false, problem: "Directory is empty." };
    } catch { /* The stat result above is still authoritative. */ }
    return { exists: true, isRepository: false, problem: shortProblem(error, "Not a Git repository.") };
  }

  const inspection: WorkspaceInspection = { exists: true, isRepository: true, root: root.trim() };
  try {
    const originUrl = (await run(workingDir, "remote", "get-url", "origin")).trim();
    if (originUrl) {
      inspection.originUrl = originUrl;
      inspection.originRepo = parseRepo(originUrl);
    }
  } catch { /* A repository need not have an origin. */ }
  try {
    const originHead = (await run(workingDir, "symbolic-ref", "refs/remotes/origin/HEAD")).trim();
    inspection.defaultBranch = originHead.replace(/^refs\/remotes\/origin\//, "") || undefined;
  } catch { /* A repository need not know the remote default branch. */ }
  try {
    inspection.dirty = Boolean((await run(workingDir, "status", "--porcelain")).trim());
  } catch { /* Dirty state is supplementary. */ }
  return inspection;
}

function shortProblem(error: unknown, fallback?: string): string {
  const value = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr
    : error instanceof Error ? error.message : "";
  const tail = value.trim().split("\n").slice(-2).join(" ").slice(-300);
  return tail || fallback || "The path could not be inspected.";
}

async function repository(directory: string) {
  const workingDir = await realpath(directory);
  const root = await realpath(await git(workingDir, "rev-parse", "--show-toplevel"));
  const commonDir = await realpath(await git(workingDir, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  return { root, commonDir, relativeDir: path.relative(root, workingDir) };
}

/** Fail closed: never fall back to the shared checkout or recreate a missing tree. */
export async function validateWorkspace(workspace: GitWorktreeWorkspace): Promise<void> {
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
  previous?: GitWorktreeWorkspace;
}): Promise<GitWorktreeWorkspace> {
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
  const parent = path.join(path.dirname(path.dirname(repo.commonDir)), ".conductor-worktrees", key);
  await mkdir(parent, { recursive: true });
  const root = path.join(await realpath(parent), `${input.taskId}-${input.workerId}`);
  const branch = `conductor/${input.taskId}/${input.workerId}`;
  // Git refuses existing paths/branches. Never adopt an unknown leftover tree.
  // Leave LFS assets as pointers: avoid large downloads/copies for every worker.
  // SKIP_SMUDGE alone still requires git-lfs. Disable both checkout filters for
  // this command only; never weaken the shared repo's clean/commit behavior.
  await git(repo.root,
    "-c", "filter.lfs.process=", "-c", "filter.lfs.smudge=", "-c", "filter.lfs.required=false",
    "worktree", "add", "-b", branch, root, baseCommit);
  const workspace: GitWorktreeWorkspace = { kind: "git-worktree", commonDir: repo.commonDir, root, workingDir: path.join(root, repo.relativeDir), branch, baseCommit };
  await validateWorkspace(workspace);
  return workspace;
}

/** This block is repeated on resumes too: a session may remember an old cwd. */
export function workspaceInstructions(workspace: GitWorktreeWorkspace): string {
  return [
    "## Workspace",
    `Working directory: ${workspace.workingDir}`,
    `Git worktree root: ${workspace.root}`,
    `Initial branch: ${workspace.branch}`,
  ].join("\n");
}
