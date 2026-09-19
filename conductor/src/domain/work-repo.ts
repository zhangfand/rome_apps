import path from "node:path";
import type { ProjectBinding, ProjectConfig } from "../core/lib/projects.js";
import type { TaskView } from "../core/lib/fold.js";
import { parseRepo } from "./adapters/github/config.js";

export interface WorkRepoConfig {
  repo: string;
  workingDir: string;
}

export function workRepoFor(project: ProjectConfig | ProjectBinding["project"] | undefined): WorkRepoConfig | undefined {
  const value = project?.workRepo;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const repo = parseRepo(candidate.repo);
  const workingDir = typeof candidate.workingDir === "string" ? candidate.workingDir.trim() : "";
  return repo && path.isAbsolute(workingDir) && !workingDir.includes("\0") ? { repo, workingDir: path.normalize(workingDir) } : undefined;
}

/** Default one private coordination repo beside the code checkout per project. */
export function defaultWorkRepo(
  projectId: string,
  codeRepo: string | undefined,
  codeWorkingDir: string | undefined,
  preferredOwner?: string,
): WorkRepoConfig | undefined {
  if (!codeRepo || !codeWorkingDir || !path.isAbsolute(codeWorkingDir)) return undefined;
  const owner = preferredOwner ?? codeRepo.split("/")[0];
  return {
    repo: `${owner}/${projectId}-work`,
    workingDir: path.join(path.dirname(path.normalize(codeWorkingDir)), `${projectId}-work`),
  };
}

export function workRepoPromptNote(task: TaskView, _audience: "worker" | "orchestrator"): string {
  const workRepo = workRepoFor(task.project);
  if (!workRepo) return "";
  return ` (agent work repository ${workRepo.repo}, local checkout ${workRepo.workingDir})`;
}
