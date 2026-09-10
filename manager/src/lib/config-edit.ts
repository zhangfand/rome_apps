import { createHash } from "node:crypto";
import { parseConfig, parseRepoList, type ManagerConfig } from "./config.js";

/** Content revision for optimistic writes; generated only from normalized settings. */
export function configRevision(config: ManagerConfig): string {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

const editable = new Set(["maxWorkers", "startCap", "ageCapHours", "reuseSessions", "closeOnIssueClosed", "intakeLabel", "intakeRepos", "workingDir", "projects", "defaultProject"]);
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function fail(message: string): never { throw new Error(message); }
function label(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 100 || /[,\n\r\0]/.test(value)) fail(`${field} must be one nonblank label (at most 100 characters, no commas).`);
}
function directory(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim().startsWith("/") || /[\0\n\r]/.test(value) || value.length > 4096) fail(`${field} must be an absolute source directory.`);
}

/** Human edits are strict: never silently clamp or replace invalid input with defaults. */
export function applyConfigEdit(current: ManagerConfig, changes: unknown): ManagerConfig {
  if (!record(changes) || !Object.keys(changes).length) fail("Provide configuration changes.");
  for (const key of Object.keys(changes)) if (!editable.has(key)) fail(`${key} is read-only here; use manager:setup for infrastructure changes.`);
  for (const [key, max] of [["maxWorkers", 20], ["startCap", 20], ["ageCapHours", 168]] as const) {
    if (Object.hasOwn(changes, key) && (typeof changes[key] !== "number" || !Number.isInteger(changes[key]) || changes[key] < 1 || changes[key] > max)) fail(`${key} must be a whole number from 1 to ${max}.`);
  }
  for (const key of ["reuseSessions", "closeOnIssueClosed"] as const) {
    if (Object.hasOwn(changes, key) && typeof changes[key] !== "boolean") fail(`${key} must be boolean.`);
  }
  if (Object.hasOwn(changes, "intakeLabel")) label(changes.intakeLabel, "Intake label");
  if (Object.hasOwn(changes, "workingDir")) {
    if (current.projects) fail("Edit the project's source directory instead of workingDir.");
    directory(changes.workingDir, "Source directory");
  }
  if (Object.hasOwn(changes, "intakeRepos")) {
    if (current.projects) fail("Edit project repositories instead of intakeRepos.");
    if (!Array.isArray(changes.intakeRepos) || changes.intakeRepos.some((r) => typeof r !== "string" || !r.trim()) || parseRepoList(changes.intakeRepos).invalid.length) fail("Repositories must be owner/name entries.");
  }
  if (Object.hasOwn(changes, "defaultProject") && (typeof changes.defaultProject !== "string" || !current.projects || !Object.hasOwn(current.projects, changes.defaultProject))) fail("Select an existing default project.");
  if (Object.hasOwn(changes, "projects")) {
    const projects = changes.projects;
    if (!current.projects || !record(projects) || Object.keys(projects).sort().join("\n") !== Object.keys(current.projects).sort().join("\n")) fail("Project IDs are fixed here. Use manager:setup to add, remove, or rename projects.");
    for (const [id, project] of Object.entries(projects)) {
      if (!record(project)) fail(`Invalid project: ${id}`);
      for (const key of Object.keys(project)) if (!["workingDir", "repo", "intakeEnabled", "intakeLabel", "projectLabel"].includes(key)) fail(`Unknown project setting: ${id}.${key}`);
      directory(project.workingDir, `${id} source directory`);
      for (const key of ["intakeLabel", "projectLabel"] as const) if (Object.hasOwn(project, key)) label(project[key], `${id}.${key}`);
    }
  }
  const parsed = parseConfig({ ...current, ...changes });
  if (!parsed.ok) fail(parsed.error);
  return parsed.config;
}
