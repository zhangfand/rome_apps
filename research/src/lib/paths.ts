import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

/** Relative project path (under the Rome projects root) that holds every topic. */
export const RESEARCH_PROJECT_DIR = "research";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

/** Mirrors core's projects-root resolution so topic folders are Rome projects. */
export function projectsRoot(): string {
  const override = env("ROME_PROJECTS_ROOT") ?? env("ROME_WEBCHAT_PROJECTS_ROOT");
  if (override) return resolve(override);
  return join(homedir(), ".rome", process.env.ROME_PROFILE || "default", "projects");
}

export function researchRoot(): string {
  return join(projectsRoot(), RESEARCH_PROJECT_DIR);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function assertSlug(slug: string): string {
  if (!isValidSlug(slug)) throw new Error(`Invalid topic id: ${slug}`);
  return slug;
}

export function topicDir(slug: string): string {
  return join(researchRoot(), assertSlug(slug));
}

/** Project path used to bind a webchat session to a topic folder. */
export function topicProjectPath(slug: string): string {
  return `${RESEARCH_PROJECT_DIR}/${assertSlug(slug)}`;
}

/** Returns the topic slug when a webchat project path points inside a topic. */
export function slugFromProjectPath(projectPath: string | undefined | null): string | null {
  if (!projectPath) return null;
  const parts = projectPath.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== RESEARCH_PROJECT_DIR) return null;
  return isValidSlug(parts[1]!) ? parts[1]! : null;
}

/**
 * Slug from free text; falls back to `fallback` when nothing survives. ASCII-only by default
 * (topic ids become project paths); `unicode` keeps letters of any script (CJK file names read
 * well in Obsidian).
 */
export function slugify(text: string, fallback: string, unicode = false): string {
  const slug = text
    .normalize(unicode ? "NFC" : "NFKD")
    .toLowerCase()
    .replace(unicode ? /[^\p{L}\p{N}]+/gu : /[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** Resolves `rel` inside `base`, refusing traversal outside it. */
export function safeJoin(base: string, rel: string): string {
  const root = resolve(base);
  const target = resolve(root, rel);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error("Path escapes the topic folder");
  }
  return target;
}
