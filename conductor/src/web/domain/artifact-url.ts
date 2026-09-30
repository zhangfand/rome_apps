/**
 * Browsable GitHub links for the spec and plan references an engineering lead
 * records on a child Task. Leads write these in a few shapes:
 *
 *   https://…                                   used as-is
 *   owner/repo@<sha>:path/to/file.md#anchor     pinned file in another repository
 *   path/to/file.md@<sha>#anchor                pinned file in the project's work repository
 *   path/to/file.md                             current file in the project's work repository
 *
 * Anything else stays unlinked; the reference is still shown as text.
 */
const REPO = String.raw`[\w.-]+\/[\w.-]+`;
const SHA = String.raw`[0-9a-f]{7,40}`;
const QUALIFIED_RE = new RegExp(`^(${REPO})@(${SHA}):([^#]+)(#.*)?$`, "i");
const PINNED_RE = new RegExp(`^([^@#]+)@(${SHA})(#.*)?$`, "i");
const PATH_RE = /^([\w.\-/]+)(#.*)?$/;

export function githubArtifactUrl(ref: string, workRepo?: { repo: string }): string | undefined {
  const trimmed = ref.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const qualified = QUALIFIED_RE.exec(trimmed);
  if (qualified) return blob(qualified[1], qualified[2], qualified[3], qualified[4]);
  if (!workRepo || !new RegExp(`^${REPO}$`).test(workRepo.repo)) return undefined;
  const pinned = PINNED_RE.exec(trimmed);
  if (pinned) return blob(workRepo.repo, pinned[2], pinned[1], pinned[3]);
  const path = PATH_RE.exec(trimmed);
  if (path) return blob(workRepo.repo, "HEAD", path[1], path[2]);
  return undefined;
}

function blob(repo: string, rev: string, path: string, fragment?: string): string | undefined {
  const segments = path.trim().split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) return undefined;
  const anchor = fragment && fragment.length > 1 ? `#${encodeURIComponent(fragment.slice(1))}` : "";
  return `https://github.com/${repo}/blob/${rev}/${segments.map(encodeURIComponent).join("/")}${anchor}`;
}
