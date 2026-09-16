/**
 * GitHub issue references in a person's own words. The brief on a Created fact
 * is the only text this reads, so the issue a task is "about" is whatever the
 * person named when they asked — never something a worker later mentioned.
 */

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
  /** Canonical `https://github.com/owner/repo/issues/N`. */
  url: string;
}

const URL_RE = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/g;
const SHORT_RE = /(?<![\w/])([\w.-]+)\/([\w.-]+)#(\d+)/g;

function makeRef(owner: string, repo: string, n: string): IssueRef {
  const number = Number(n);
  return { owner, repo, number, url: `https://github.com/${owner}/${repo}/issues/${number}` };
}

/**
 * Every issue reference in `text`, de-duplicated, in order of appearance. Both
 * the full URL and the `owner/repo#N` short form count; a pull request URL
 * does not, because a task closes on its issue, not on a PR.
 */
export function issueRefsIn(text: string | undefined | null): IssueRef[] {
  if (!text) return [];
  const out: IssueRef[] = [];
  const seen = new Set<string>();
  const push = (ref: IssueRef) => {
    if (seen.has(ref.url)) return;
    seen.add(ref.url);
    out.push(ref);
  };
  for (const m of text.matchAll(URL_RE)) push(makeRef(m[1], m[2], m[3]));
  for (const m of text.matchAll(SHORT_RE)) push(makeRef(m[1], m[2], m[3]));
  return out;
}

/** The REST path `connector_proxy` needs, with each segment encoded. */
export function issueApiPath(ref: IssueRef): string {
  const owner = encodeURIComponent(ref.owner);
  const repo = encodeURIComponent(ref.repo);
  return `/repos/${owner}/${repo}/issues/${ref.number}`;
}
