export interface GithubIssueReference {
  repo: string;
  number: number;
}

const FULL_URL = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)/gi;
const QUALIFIED = /\b([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)\b/g;
const LOCAL = /(^|[^A-Za-z0-9_\/-])#(\d+)\b/g;

export function githubIssueKey(repo: string, number: number): string {
  return `${repo.toLowerCase()}#${number}`;
}

function unique(refs: GithubIssueReference[]): GithubIssueReference[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = githubIssueKey(ref.repo, ref.number);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractIssueSection(body: string, headingName: string): string {
  const escaped = headingName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^##[ \\t]+${escaped}[ \\t]*$`, "im").exec(body);
  if (!heading || heading.index === undefined) return "";
  const remainder = body.slice(heading.index + heading[0].length).replace(/^\r?\n/, "");
  const nextHeading = remainder.search(/^##[ \t]+/m);
  return (nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder).trim();
}

export function parseGithubIssueReferences(text: string, currentRepo: string): GithubIssueReference[] {
  const refs: GithubIssueReference[] = [];
  for (const match of text.matchAll(FULL_URL)) {
    refs.push({ repo: `${match[1]}/${match[2]}`, number: Number(match[3]) });
  }
  for (const match of text.matchAll(QUALIFIED)) {
    refs.push({ repo: match[1], number: Number(match[2]) });
  }
  for (const match of text.matchAll(LOCAL)) {
    refs.push({ repo: currentRepo, number: Number(match[2]) });
  }
  return unique(refs);
}

export function parseBlockedByReferences(body: string | null, currentRepo: string): GithubIssueReference[] {
  if (!body) return [];
  const section = extractIssueSection(body, "Blocked by");
  if (!section || /^(?:[-*]\s*)?none\b/i.test(section)) return [];
  return parseGithubIssueReferences(section, currentRepo);
}

export function parseClosingReferences(body: string | null, currentRepo: string): GithubIssueReference[] {
  if (!body) return [];
  const refs: GithubIssueReference[] = [];
  const pattern = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+([^\n.]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) refs.push(...parseGithubIssueReferences(match[1], currentRepo));
  return unique(refs);
}
