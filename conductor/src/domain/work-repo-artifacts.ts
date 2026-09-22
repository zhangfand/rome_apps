import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { WorkRepoConfig } from "./work-repo.js";

const exec = promisify(execFile);

export interface JsonArtifactDraft {
  /** POSIX path inside the work repository. */
  path: string;
  value: unknown;
}

export interface TextArtifactDraft {
  /** POSIX path inside the work repository. */
  path: string;
  content: string;
  mediaType: "text/markdown";
}

export interface WorkRepoArtifactRef {
  repo: string;
  path: string;
  commit: string;
  sha256: string;
  bytes: number;
  mediaType: "application/json" | "text/markdown";
  url: string;
}

export type PersistJsonArtifacts = (
  workRepo: WorkRepoConfig,
  drafts: readonly JsonArtifactDraft[],
  message: string,
) => Promise<Map<string, WorkRepoArtifactRef>>;

export type PersistTextArtifacts = (
  workRepo: WorkRepoConfig,
  drafts: readonly TextArtifactDraft[],
  message: string,
) => Promise<Map<string, WorkRepoArtifactRef>>;

export interface PinnedTextArtifactRef {
  repo: string;
  path: string;
  commit: string;
  sha256: string;
  bytes: number;
}

/**
 * Commit immutable JSON evidence through an isolated clone, leaving the shared
 * work-repository checkout untouched. A push race is retried from the newest
 * remote head. The returned commit pins exactly what a ledger reference means.
 */
export const persistJsonArtifacts: PersistJsonArtifacts = async (workRepo, drafts, message) => {
  if (!drafts.length) return new Map();
  const prepared = prepare(drafts);
  return persistPreparedArtifacts(workRepo, prepared, message);
};

/** Commit human-readable runtime artifacts with the same isolated-clone guarantees. */
export const persistTextArtifacts: PersistTextArtifacts = async (workRepo, drafts, message) => {
  if (!drafts.length) return new Map();
  const paths = new Set<string>();
  const prepared = drafts.map((draft) => {
    const artifactPath = safeArtifactPath(draft.path);
    if (paths.has(artifactPath)) throw new Error(`Duplicate work-repository artifact path: ${artifactPath}`);
    paths.add(artifactPath);
    const content = draft.content.endsWith("\n") ? draft.content : `${draft.content}\n`;
    return { path: artifactPath, content, sha256: createHash("sha256").update(content).digest("hex"), mediaType: draft.mediaType };
  });
  return persistPreparedArtifacts(workRepo, prepared, message);
};

/** Read and verify an immutable text artifact without trusting a stale checkout. */
export async function readPinnedTextArtifact(
  workRepo: WorkRepoConfig,
  ref: PinnedTextArtifactRef,
): Promise<string> {
  if (ref.repo.toLowerCase() !== workRepo.repo.toLowerCase()) {
    throw new Error(`Snapshot artifact repository ${ref.repo} does not match ${workRepo.repo}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(ref.commit)) throw new Error("Pinned artifact commit must be a full Git SHA");
  const artifactPath = safeArtifactPath(ref.path);
  const origin = (await git(workRepo.workingDir, "remote", "get-url", "origin")).trim();
  if (!origin) throw new Error(`Work repository ${workRepo.repo} has no origin remote`);

  const checkout = await mkdtemp(path.join(os.tmpdir(), "conductor-artifact-read-"));
  try {
    await git(checkout, "init", "--quiet");
    await git(checkout, "remote", "add", "origin", origin);
    await git(checkout, "fetch", "--quiet", "--depth=1", "origin", ref.commit);
    const content = await git(checkout, "show", `FETCH_HEAD:${artifactPath}`);
    const bytes = Buffer.byteLength(content);
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (bytes !== ref.bytes || sha256 !== ref.sha256) {
      throw new Error(`Pinned artifact verification failed for ${ref.repo}@${ref.commit}:${artifactPath}`);
    }
    return content;
  } finally {
    await rm(checkout, { recursive: true, force: true });
  }
}

async function persistPreparedArtifacts(
  workRepo: WorkRepoConfig,
  prepared: readonly PreparedArtifact[],
  message: string,
): Promise<Map<string, WorkRepoArtifactRef>> {
  const origin = (await git(workRepo.workingDir, "remote", "get-url", "origin")).trim();
  if (!origin) throw new Error(`Work repository ${workRepo.repo} has no origin remote`);
  const branch = await remoteDefaultBranch(workRepo.workingDir);

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const checkout = await mkdtemp(path.join(os.tmpdir(), "conductor-artifacts-"));
    try {
      await command("git", ["clone", "--quiet", "--no-tags", "--depth=1", origin, checkout], undefined, 120_000);
      const hasHead = await succeeds(() => git(checkout, "rev-parse", "--verify", "HEAD^{commit}"));
      if (!hasHead) await git(checkout, "checkout", "--orphan", branch);

      for (const item of prepared) {
        const filename = path.join(checkout, ...item.path.split("/"));
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, item.content, "utf8");
      }
      await git(checkout, "add", "--", ...prepared.map((item) => item.path));
      const changed = (await git(checkout, "diff", "--cached", "--name-only", "--", ...prepared.map((item) => item.path))).trim();
      if (changed) {
        await command("git", [
          "-C", checkout,
          "-c", "user.name=Rome Conductor",
          "-c", "user.email=staging@romeos.cc",
          "commit", "--quiet", "-m", message, "--", ...prepared.map((item) => item.path),
        ], undefined, 60_000);
        await git(checkout, "push", "--quiet", "origin", `HEAD:refs/heads/${branch}`);
      }
      const commit = (await git(checkout, "rev-parse", "HEAD^{commit}")).trim();
      return new Map(prepared.map((item) => [item.path, {
        repo: workRepo.repo,
        path: item.path,
        commit,
        sha256: item.sha256,
        bytes: Buffer.byteLength(item.content),
        mediaType: item.mediaType,
        url: `https://github.com/${workRepo.repo}/blob/${commit}/${item.path.split("/").map(encodeURIComponent).join("/")}`,
      }]));
    } catch (error) {
      lastError = error;
      if (attempt === 3 || !isPushRace(error)) throw error;
    } finally {
      await rm(checkout, { recursive: true, force: true });
    }
  }
  throw lastError;
}

interface PreparedArtifact {
  path: string;
  content: string;
  sha256: string;
  mediaType: WorkRepoArtifactRef["mediaType"];
}

function prepare(drafts: readonly JsonArtifactDraft[]) {
  const paths = new Set<string>();
  return drafts.map((draft) => {
    const artifactPath = safeArtifactPath(draft.path);
    if (paths.has(artifactPath)) throw new Error(`Duplicate work-repository artifact path: ${artifactPath}`);
    paths.add(artifactPath);
    const content = `${JSON.stringify(draft.value, null, 2)}\n`;
    return { path: artifactPath, content, sha256: createHash("sha256").update(content).digest("hex"), mediaType: "application/json" as const };
  });
}

function safeArtifactPath(value: string): string {
  const normalized = path.posix.normalize(value.trim().replaceAll("\\", "/"));
  if (!normalized || normalized === "." || path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error(`Invalid work-repository artifact path: ${JSON.stringify(value)}`);
  }
  return normalized;
}

async function remoteDefaultBranch(workingDir: string): Promise<string> {
  try {
    const result = await git(workingDir, "ls-remote", "--symref", "origin", "HEAD");
    const match = /^ref: refs\/heads\/(\S+)\s+HEAD$/m.exec(result);
    if (match) return match[1];
  } catch { /* Empty repositories have no remote HEAD yet. */ }
  try {
    const local = (await git(workingDir, "branch", "--show-current")).trim();
    if (local) return local;
  } catch { /* Fall through to GitHub's conventional default. */ }
  return "main";
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  return command("git", ["-C", cwd, ...args], undefined, 120_000);
}

async function command(binary: string, args: string[], cwd?: string, timeout = 60_000): Promise<string> {
  const result = await exec(binary, args, { cwd, timeout, maxBuffer: 4 * 1024 * 1024 });
  return result.stdout;
}

async function succeeds(operation: () => Promise<unknown>): Promise<boolean> {
  try { await operation(); return true; } catch { return false; }
}

function isPushRace(error: unknown): boolean {
  const text = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr
    : error instanceof Error ? error.message : String(error);
  return /non-fast-forward|fetch first|failed to push some refs|remote contains work/i.test(text);
}
