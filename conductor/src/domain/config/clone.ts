import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { parseRepo } from "../adapters/github/config.js";
import { inspectGitWorkspace } from "../workspaces/git-worktree.js";

const exec = promisify(execFile);

type CloneResult =
  | { ok: true; root: string; originRepo?: string; defaultBranch?: string }
  | { ok: false; error: string; status: number };

type CloneCommand = (repo: string, workingDir: string) => Promise<void>;

export async function cloneRepository(
  input: { repo?: unknown; workingDir?: unknown },
  run: CloneCommand = runClone,
): Promise<CloneResult> {
  const repo = parseRepo(input.repo);
  if (!repo) return { ok: false, error: "repo must be an owner/name or github.com URL", status: 400 };
  if (typeof input.workingDir !== "string" || !path.isAbsolute(input.workingDir) || input.workingDir.includes("\0")) {
    return { ok: false, error: "workingDir must be an absolute path", status: 400 };
  }
  const workingDir = path.normalize(input.workingDir);

  try {
    const entry = await stat(workingDir);
    if (!entry.isDirectory()) return { ok: false, error: "The target exists and is not a directory.", status: 409 };
    if ((await readdir(workingDir)).length > 0) return { ok: false, error: "The target directory is not empty.", status: 409 };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    if (code !== "ENOENT") return { ok: false, error: shortError(error), status: 500 };
  }

  await mkdir(path.dirname(workingDir), { recursive: true });
  try {
    await run(repo, workingDir);
  } catch (error) {
    return { ok: false, error: shortError(error), status: 502 };
  }
  const inspection = await inspectGitWorkspace(workingDir);
  if (!inspection.isRepository || !inspection.root) {
    return { ok: false, error: inspection.problem ?? "Clone finished without a readable Git repository.", status: 502 };
  }
  return {
    ok: true,
    root: inspection.root,
    originRepo: inspection.originRepo,
    defaultBranch: inspection.defaultBranch,
  };
}

export async function cloneConfigRoute(_ctx: RomeAppContext, request: RomeAppApiRequest): Promise<Response> {
  const body = readBody(request);
  if (!body) return json({ error: "A JSON object is required." }, 400);
  const result = await cloneRepository(body);
  return result.ok ? json(result) : json({ error: result.error }, result.status);
}

async function runClone(repo: string, workingDir: string): Promise<void> {
  await exec("gh", ["repo", "clone", repo, workingDir], { timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 });
}

function readBody(request: RomeAppApiRequest): { repo?: unknown; workingDir?: unknown } | undefined {
  if (!request.body?.byteLength) return undefined;
  try {
    const value = JSON.parse(new TextDecoder().decode(request.body)) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as { repo?: unknown; workingDir?: unknown } : undefined;
  } catch {
    return undefined;
  }
}

function shortError(error: unknown): string {
  const raw = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr
    : error instanceof Error ? error.message : String(error);
  return raw.trim().split("\n").slice(-8).join("\n").slice(-2_000) || "Clone failed.";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
