import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { parseRepo } from "../adapters/github/config.js";

const exec = promisify(execFile);

export interface GitHubRepositorySummary {
  nameWithOwner: string;
  description?: string;
  private: boolean;
  archived: boolean;
  updatedAt?: string;
}

export type GitHubRepositoryLister = () => Promise<string>;

/** Repositories the connected GitHub identity can work with, newest first. */
export async function listGitHubRepositories(
  query = "",
  list: GitHubRepositoryLister = ghListRepositories,
): Promise<{ repositories: GitHubRepositorySummary[]; truncated: boolean }> {
  const output = await list();
  const needle = query.trim().toLocaleLowerCase();
  const repositories = output.split("\n").flatMap((line): GitHubRepositorySummary[] => {
    if (!line.trim()) return [];
    try {
      const item = JSON.parse(line) as Record<string, unknown>;
      const nameWithOwner = parseRepo(item.nameWithOwner);
      if (!nameWithOwner) return [];
      const description = typeof item.description === "string" && item.description.trim() ? item.description.trim() : undefined;
      const candidate: GitHubRepositorySummary = {
        nameWithOwner,
        ...(description ? { description } : {}),
        private: item.private === true,
        archived: item.archived === true,
        ...(typeof item.updatedAt === "string" ? { updatedAt: item.updatedAt } : {}),
      };
      const haystack = `${candidate.nameWithOwner}\n${candidate.description ?? ""}`.toLocaleLowerCase();
      return !needle || haystack.includes(needle) ? [candidate] : [];
    } catch {
      return [];
    }
  });
  const visible = repositories.slice(0, 100);
  return { repositories: visible, truncated: repositories.length > visible.length };
}

export async function githubRepositoriesConfigRoute(_ctx: RomeAppContext, request: RomeAppApiRequest): Promise<Response> {
  try {
    return json(await listGitHubRepositories(request.query.get("q") ?? ""));
  } catch (error) {
    return json({ error: shortError(error) }, 502);
  }
}

async function ghListRepositories(): Promise<string> {
  const { stdout } = await exec("gh", [
    "api",
    "--paginate",
    "/user/repos?affiliation=owner%2Ccollaborator%2Corganization_member&per_page=100&sort=updated",
    "--jq",
    ".[] | {nameWithOwner: .full_name, description, private: .private, archived: .archived, updatedAt: .updated_at}",
  ], { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

function shortError(error: unknown): string {
  const raw = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr
    : error instanceof Error ? error.message : String(error);
  return raw.trim().split("\n").slice(-8).join("\n").slice(-2_000) || "GitHub repositories could not be loaded.";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
