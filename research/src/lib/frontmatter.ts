/**
 * Minimal frontmatter: one `key: value` per line where value is JSON when it
 * parses (strings are written JSON-quoted, which is valid YAML), raw otherwise.
 * Keeps the files readable in Obsidian without a YAML dependency.
 */
export type Frontmatter = Record<string, unknown>;

export function parseFrontmatter(text: string): { data: Frontmatter; body: string } {
  const normalized = text.replace(/^﻿/, "");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { data: {}, body: normalized };
  const head = normalized.slice(4, end);
  let body = normalized.slice(end + 4);
  if (body.startsWith("\n")) body = body.slice(1);
  const data: Frontmatter = {};
  for (const line of head.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    if (!key) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return { data, body };
}

export function stringifyFrontmatter(data: Frontmatter, body: string): string {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  const trimmed = body.replace(/^\n+/, "");
  return `---\n${lines.join("\n")}\n---\n\n${trimmed}${trimmed.endsWith("\n") ? "" : "\n"}`;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
