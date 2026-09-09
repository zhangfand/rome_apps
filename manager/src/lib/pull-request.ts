import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Fact } from "./facts.js";

export type MergeMethod = "squash" | "merge" | "rebase";
export interface PullRequestRef { url: string; repo: string; number: number }
export interface PullRequestStatus extends PullRequestRef {
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  draft: boolean;
  additions: number;
  deletions: number;
  comments: number;
  discussionComments: number;
  reviewComments: number;
  review: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "UNREVIEWED" | "UNKNOWN";
  ci: "SUCCESS" | "FAILURE" | "PENDING" | "NONE" | "UNKNOWN";
  checks: number;
  headSha: string;
  headBranch: string;
  baseBranch: string;
  mergeState: string;
  canWrite: boolean;
  methods: MergeMethod[];
  checkedAt: string;
  mergeBlocked: string | null;
}
export class PullRequestError extends Error {
  constructor(message: string, readonly status = 502) { super(message); }
}

/** Only full, canonical GitHub PR URLs; never pass free-form URLs to gh. */
export function pullRequestRefs(text: string): PullRequestRef[] {
  const found = new Map<string, PullRequestRef>();
  for (const m of text.matchAll(/https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/([1-9]\d*)(?![\w])/g)) {
    if ([m[1], m[2]].some((v) => v === "." || v === "..")) continue;
    const number = Number(m[3]);
    if (!Number.isSafeInteger(number)) continue;
    const repo = `${m[1]}/${m[2]}`;
    const url = `https://github.com/${repo}/pull/${number}`;
    found.set(url.toLowerCase(), { url, repo, number });
  }
  return [...found.values()];
}

/** Do not silently pick an old PR when the current report has no PR. */
export function reportPullRequests(facts: readonly Fact[]): PullRequestRef[] {
  const report = [...facts].reverse().find((f) => f.kind === "Report");
  return report?.kind === "Report" ? pullRequestRefs(report.payload.what) : [];
}

export type GithubRequest = (args: string[]) => Promise<unknown>;
const exec = promisify(execFile);
export const githubRequest: GithubRequest = async (args) => {
  try {
    const { stdout } = await exec("gh", ["api", ...args], { timeout: 25_000, maxBuffer: 2 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    // Never expose CLI stderr (or its environment) to a browser.
    const message = error instanceof Error ? error.message : "";
    if (/auth login|not logged|authentication|HTTP 401|GH_TOKEN/i.test(message)) {
      throw new PullRequestError("Connect GitHub in Rome Settings, then refresh.", 503);
    }
    throw new PullRequestError("GitHub could not complete the request. Refresh or open the PR on GitHub.");
  }
};

interface RestPr {
  number: number; html_url: string; title: string; state: string; merged: boolean; draft: boolean;
  additions: number; deletions: number; comments: number; review_comments: number;
  head: { sha: string; ref: string }; base: { ref: string };
}
interface GraphPr {
  headRefOid: string; mergeStateStatus: string; reviewDecision: PullRequestStatus["review"] | null;
  latestOpinionatedReviews: { nodes: Array<{ state: string }>; pageInfo: { hasNextPage: boolean } };
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string; contexts: { totalCount: number } } | null } }> };
}
interface GraphResult {
  errors?: unknown[];
  data?: { repository: {
    viewerPermission: string; squashMergeAllowed: boolean; mergeCommitAllowed: boolean; rebaseMergeAllowed: boolean;
    pullRequest: GraphPr | null;
  } | null };
}
const QUERY = `query($owner:String!, $repo:String!, $number:Int!) {
  repository(owner:$owner, name:$repo) {
    viewerPermission squashMergeAllowed mergeCommitAllowed rebaseMergeAllowed
    pullRequest(number:$number) {
      headRefOid mergeStateStatus reviewDecision
      latestOpinionatedReviews(first:100) { nodes { state } pageInfo { hasNextPage } }
      commits(last:1) { nodes { commit { statusCheckRollup { state contexts { totalCount } } } } }
    }
  }
}`;

export function mergeBlockReason(pr: Omit<PullRequestStatus, "mergeBlocked">): string | null {
  if (pr.state === "MERGED") return "Already merged";
  if (pr.state !== "OPEN") return "PR is closed";
  if (pr.draft) return "PR is a draft";
  if (!pr.canWrite) return "GitHub write access is required";
  if (!pr.methods.length) return "No supported merge method";
  if (pr.review === "CHANGES_REQUESTED") return "Changes requested";
  if (pr.review === "REVIEW_REQUIRED") return "Approval required by GitHub";
  if (pr.review === "UNKNOWN") return "Review status is unknown";
  // Do not invent an approval requirement on repos that do not have one.
  // CLEAN plus GitHub's merge endpoint still enforce repository rules.
  if (pr.ci !== "SUCCESS") return pr.ci === "NONE" ? "No CI checks reported" : "CI must be passing";
  if (pr.mergeState !== "CLEAN") return `GitHub merge state: ${pr.mergeState.toLowerCase()}`;
  return null;
}

export async function readPullRequest(ref: PullRequestRef, request: GithubRequest = githubRequest): Promise<PullRequestStatus> {
  const [owner, repo] = ref.repo.split("/");
  const [rest, graph] = await Promise.all([
    request([`repos/${ref.repo}/pulls/${ref.number}`]) as Promise<RestPr>,
    request(["graphql", "-f", `query=${QUERY}`, "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `number=${ref.number}`]) as Promise<GraphResult>,
  ]);
  const repository = graph.data?.repository;
  const pr = repository?.pullRequest;
  if (graph.errors?.length || !repository || !pr) throw new PullRequestError("PR status is unavailable from GitHub.");
  if (rest.head.sha !== pr.headRefOid) throw new PullRequestError("PR changed while loading. Refresh to load its latest commit.", 409);
  if (rest.number !== ref.number || rest.html_url.toLowerCase() !== ref.url.toLowerCase()) {
    throw new PullRequestError("PR repository changed. Open the PR on GitHub.", 409);
  }
  for (const count of [rest.additions, rest.deletions, rest.comments, rest.review_comments]) {
    if (!Number.isSafeInteger(count) || count < 0) throw new PullRequestError("Incomplete PR statistics from GitHub.");
  }
  let review: PullRequestStatus["review"] = pr.reviewDecision ?? "UNREVIEWED";
  // GitHub leaves reviewDecision null on repositories without review requirements.
  if (!pr.reviewDecision) {
    const reviews = pr.latestOpinionatedReviews;
    review = reviews.pageInfo.hasNextPage ? "UNKNOWN"
      : reviews.nodes.some((r) => r.state === "CHANGES_REQUESTED") ? "CHANGES_REQUESTED"
      : reviews.nodes.some((r) => r.state === "APPROVED") ? "APPROVED" : "UNREVIEWED";
  }
  const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup;
  const checks = rollup?.contexts.totalCount ?? 0;
  const ci: PullRequestStatus["ci"] = !checks ? "NONE"
    : rollup?.state === "SUCCESS" ? "SUCCESS"
    : rollup?.state === "FAILURE" || rollup?.state === "ERROR" ? "FAILURE"
    : rollup?.state === "PENDING" || rollup?.state === "EXPECTED" ? "PENDING" : "UNKNOWN";
  const methods: MergeMethod[] = [];
  if (repository.squashMergeAllowed) methods.push("squash");
  if (repository.mergeCommitAllowed) methods.push("merge");
  if (repository.rebaseMergeAllowed) methods.push("rebase");
  const value: Omit<PullRequestStatus, "mergeBlocked"> = {
    ...ref, title: rest.title, state: rest.merged ? "MERGED" : rest.state === "open" ? "OPEN" : "CLOSED",
    draft: rest.draft, additions: rest.additions, deletions: rest.deletions,
    comments: rest.comments + rest.review_comments, discussionComments: rest.comments, reviewComments: rest.review_comments,
    review, ci, checks, headSha: rest.head.sha, headBranch: rest.head.ref, baseBranch: rest.base.ref,
    mergeState: pr.mergeStateStatus, canWrite: ["ADMIN", "MAINTAIN", "WRITE"].includes(repository.viewerPermission),
    methods, checkedAt: new Date().toISOString(),
  };
  return { ...value, mergeBlocked: mergeBlockReason(value) };
}

/** GETs share short-lived snapshots; merge always bypasses this cache. */
export class PullRequestService {
  private cache = new Map<string, { until: number; value: Promise<PullRequestStatus> }>();
  private merging = new Set<string>();
  constructor(private readonly request: GithubRequest = githubRequest) {}
  read(ref: PullRequestRef): Promise<PullRequestStatus> {
    const key = ref.url.toLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    // Bound the disposable cache even across long-lived handler sessions.
    for (const [k, v] of this.cache) if (v.until <= Date.now()) this.cache.delete(k);
    if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
    const value = readPullRequest(ref, this.request).catch((error) => { this.cache.delete(key); throw error; });
    this.cache.set(key, { until: Date.now() + 30_000, value });
    return value;
  }
  async merge(ref: PullRequestRef, sha: string, method: MergeMethod) {
    const key = ref.url.toLowerCase();
    if (this.merging.has(key)) throw new PullRequestError("A merge is already in progress.", 409);
    this.merging.add(key);
    try {
      const pr = await readPullRequest(ref, this.request);
      if (pr.headSha !== sha) throw new PullRequestError("New commits were pushed. Refresh and review the latest PR before merging.", 409);
      if (pr.mergeBlocked) throw new PullRequestError(pr.mergeBlocked, 409);
      if (!pr.methods.includes(method)) throw new PullRequestError("This merge method is not allowed by the repository.", 409);
      // No admin bypass, auto-merge, branch deletion, or task completion. GitHub
      // enforces its rules; sha atomically rejects a newly pushed head commit.
      const result = await this.request([`repos/${ref.repo}/pulls/${ref.number}/merge`, "--method", "PUT", "-f", `sha=${sha}`, "-f", `merge_method=${method}`]) as { merged?: boolean; sha?: string };
      if (result.merged !== true) throw new PullRequestError("GitHub did not merge the PR. Refresh or open it on GitHub.", 409);
      return { merged: true, sha: result.sha, url: ref.url };
    } finally {
      this.cache.delete(key);
      this.merging.delete(key);
    }
  }
}
