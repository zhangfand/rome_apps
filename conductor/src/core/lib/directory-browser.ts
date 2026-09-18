import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { readdir, stat } from "node:fs/promises";

export interface DirectoryBrowserEntry {
  name: string;
  path: string;
}

export interface DirectoryBrowserShortcut {
  label: string;
  path: string;
}

export interface DirectoryBrowserListing {
  path: string;
  parent?: string;
  entries: DirectoryBrowserEntry[];
  shortcuts: DirectoryBrowserShortcut[];
}

/** The directory where Rome-owned projects normally live for this profile. */
export function defaultProjectsDirectory(): string {
  return join(homedir(), ".rome", process.env.ROME_PROFILE || "default", "projects");
}

/**
 * List only child directories. This is intentionally server-side: a browser
 * file picker sees the guardian's client filesystem, while Conductor workers
 * need a path on the Rome host.
 */
export async function browseDirectories(requestedPath?: string): Promise<DirectoryBrowserListing> {
  const selected = normalize(requestedPath?.trim() || defaultProjectsDirectory());
  if (!isAbsolute(selected) || selected.includes("\0")) {
    throw new DirectoryBrowserError("path must be an absolute directory", 400);
  }

  try {
    const selectedStat = await stat(selected);
    if (!selectedStat.isDirectory()) throw new DirectoryBrowserError("path is not a directory", 400);

    const dirents = await readdir(selected, { withFileTypes: true });
    const entries = (await Promise.all(dirents.map(async (entry): Promise<DirectoryBrowserEntry | null> => {
      if (entry.isDirectory()) return { name: entry.name, path: join(selected, entry.name) };
      if (!entry.isSymbolicLink()) return null;
      try {
        return (await stat(join(selected, entry.name))).isDirectory()
          ? { name: entry.name, path: join(selected, entry.name) }
          : null;
      } catch {
        return null;
      }
    })))
      .filter((entry): entry is DirectoryBrowserEntry => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

    return {
      path: selected,
      ...(selected === dirname(selected) ? {} : { parent: dirname(selected) }),
      entries,
      shortcuts: uniqueShortcuts([
        { label: "Projects", path: defaultProjectsDirectory() },
        { label: "Home", path: homedir() },
        { label: "Filesystem", path: "/" },
      ]),
    };
  } catch (error) {
    if (error instanceof DirectoryBrowserError) throw error;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") throw new DirectoryBrowserError("directory does not exist", 404);
    if (code === "EACCES" || code === "EPERM") throw new DirectoryBrowserError("directory cannot be read", 403);
    throw error;
  }
}

export class DirectoryBrowserError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DirectoryBrowserError";
  }
}

function uniqueShortcuts(shortcuts: DirectoryBrowserShortcut[]): DirectoryBrowserShortcut[] {
  const seen = new Set<string>();
  return shortcuts.filter((shortcut) => {
    if (seen.has(shortcut.path)) return false;
    seen.add(shortcut.path);
    return true;
  });
}
