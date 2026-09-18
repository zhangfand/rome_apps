import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { parseRepo } from "../adapters/github/config.js";
import { cloneRepository } from "./clone.js";
import { inspectGitWorkspace } from "../workspaces/git-worktree.js";

const exec = promisify(execFile);

export interface WorkRepoCommands {
  exists(repo: string): Promise<boolean>;
  create(repo: string): Promise<void>;
  clone(repo: string, workingDir: string): Promise<void>;
}

type SetupResult =
  | { ok: true; repo: string; workingDir: string; created: boolean; cloned: boolean }
  | { ok: false; error: string; status: number };

/** Create the private remote when absent, then make the local checkout ready. */
export async function setupWorkRepository(
  input: { repo?: unknown; workingDir?: unknown },
  commands: WorkRepoCommands = ghCommands,
): Promise<SetupResult> {
  const repo = parseRepo(input.repo);
  if (!repo) return { ok: false, error: "repo must be an owner/name or github.com URL", status: 400 };
  if (typeof input.workingDir !== "string" || !path.isAbsolute(input.workingDir) || input.workingDir.includes("\0")) {
    return { ok: false, error: "workingDir must be an absolute path", status: 400 };
  }
  const workingDir = path.normalize(input.workingDir);

  try {
    const entry = await stat(workingDir);
    if (!entry.isDirectory()) return { ok: false, error: "The target exists and is not a directory.", status: 409 };
    if ((await readdir(workingDir)).length > 0) {
      const inspection = await inspectGitWorkspace(workingDir);
      if (inspection.isRepository && inspection.originRepo?.toLowerCase() === repo.toLowerCase()) {
        return { ok: true, repo, workingDir, created: false, cloned: false };
      }
      return { ok: false, error: inspection.problem ?? "The target directory is not the configured work repository.", status: 409 };
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    if (code !== "ENOENT") return { ok: false, error: shortError(error), status: 500 };
  }

  let exists: boolean;
  try {
    exists = await commands.exists(repo);
  } catch (error) {
    return { ok: false, error: shortError(error), status: 502 };
  }

  if (!exists) {
    try {
      await commands.create(repo);
    } catch (error) {
      return { ok: false, error: shortError(error), status: 502 };
    }
  }

  const cloned = await cloneRepository({ repo, workingDir }, commands.clone);
  if (!cloned.ok) return cloned;
  return { ok: true, repo, workingDir, created: !exists, cloned: true };
}

export async function setupWorkRepoConfigRoute(_ctx: RomeAppContext, request: RomeAppApiRequest): Promise<Response> {
  const body = readBody(request);
  if (!body) return json({ error: "A JSON object is required." }, 400);
  const result = await setupWorkRepository(body);
  return result.ok ? json(result) : json({ error: result.error }, result.status);
}

const ghCommands: WorkRepoCommands = {
  async exists(repo) {
    try {
      await exec("gh", ["repo", "view", repo, "--json", "nameWithOwner"], { timeout: 30_000, maxBuffer: 1024 * 1024 });
      return true;
    } catch (error) {
      const message = shortError(error);
      if (/Could not resolve to a Repository|HTTP 404|not found/i.test(message)) return false;
      throw error;
    }
  },
  async create(repo) {
    await exec("gh", ["repo", "create", repo, "--private", "--description", "Agent coordination artifacts: product specs, engineering designs, and handoff records"], {
      timeout: 60_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  },
  async clone(repo, workingDir) {
    await exec("gh", ["repo", "clone", repo, workingDir], { timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  },
};

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
  return raw.trim().split("\n").slice(-8).join("\n").slice(-2_000) || "Work repository setup failed.";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
