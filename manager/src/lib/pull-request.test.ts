import { describe, expect, it } from "@rstest/core";
import { PullRequestService, mergeBlockReason, pullRequestRefs, reportPullRequests, readPullRequest, type GithubRequest, type PullRequestStatus } from "./pull-request.js";
import { LedgerBuilder } from "./test-facts.js";
const ref = { repo: "acme/repo", number: 42, url: "https://github.com/acme/repo/pull/42" };
const sha = "a".repeat(40);
function fixture() {
  const rest = { number: 42, html_url: ref.url, title: "Fix an issue", state: "open", merged: false, draft: false, additions: 125, deletions: 13, comments: 3, review_comments: 4, head: { sha, ref: "fix" }, base: { ref: "main" } };
  const pr = { headRefOid: sha, mergeStateStatus: "CLEAN", reviewDecision: "APPROVED" as string | null, latestOpinionatedReviews: { nodes: [] as Array<{ state: string }>, pageInfo: { hasNextPage: false } }, commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { totalCount: 11 } } as { state: string; contexts: { totalCount: number } } | null } }] } };
  const repo = { viewerPermission: "WRITE", squashMergeAllowed: true, mergeCommitAllowed: true, rebaseMergeAllowed: false, pullRequest: pr };
  const graph = { data: { repository: repo }, errors: undefined as unknown[] | undefined };
  const calls: string[][] = [];
  let merged = true;
  const request: GithubRequest = async (args) => { calls.push(args); return args[0] === "graphql" ? graph : args.includes("PUT") ? { merged, sha: "b".repeat(40) } : rest; };
  return { rest, pr, repo, graph, calls, request, rejectMerge: () => { merged = false; } };
}

describe("PR data", () => {
  it("counts additions, deletions, discussion and inline comments without pagination truncation", async () => {
    const f = fixture(); f.rest.review_comments = 150;
    const data = await readPullRequest(ref, f.request);
    expect(data).toMatchObject({ additions: 125, deletions: 13, comments: 153, review: "APPROVED", ci: "SUCCESS", checks: 11, mergeBlocked: null, methods: ["squash", "merge"] });
  });
  it("uses latest opinionated reviews when review requirements are absent", async () => {
    const f = fixture(); f.pr.reviewDecision = null;
    expect((await readPullRequest(ref, f.request)).review).toBe("UNREVIEWED");
    f.pr.latestOpinionatedReviews.nodes = [{ state: "APPROVED" }];
    expect((await readPullRequest(ref, f.request)).review).toBe("APPROVED");
    f.pr.latestOpinionatedReviews.nodes.push({ state: "CHANGES_REQUESTED" });
    expect((await readPullRequest(ref, f.request)).review).toBe("CHANGES_REQUESTED");
    f.pr.latestOpinionatedReviews.pageInfo.hasNextPage = true;
    expect((await readPullRequest(ref, f.request)).review).toBe("UNKNOWN");
  });
  it("never reports absent, pending, failed, or unknown CI as passing", async () => {
    const f = fixture();
    for (const [state, expected] of [["PENDING", "PENDING"], ["FAILURE", "FAILURE"], ["ERROR", "FAILURE"], ["EXPECTED", "PENDING"], ["OTHER", "UNKNOWN"]]) {
      f.pr.commits.nodes[0].commit.statusCheckRollup!.state = state;
      const data = await readPullRequest(ref, f.request);
      expect(data.ci).toBe(expected); expect(data.mergeBlocked).toBeTruthy();
    }
    f.pr.commits.nodes[0].commit.statusCheckRollup = null;
    expect((await readPullRequest(ref, f.request)).ci).toBe("NONE");
  });
  it("rejects mismatched heads, redirected PRs, incomplete stats and GraphQL partial errors", async () => {
    for (const mutate of [(f: ReturnType<typeof fixture>) => { f.pr.headRefOid = "b".repeat(40); }, (f: ReturnType<typeof fixture>) => { f.rest.html_url = "https://github.com/other/repo/pull/42"; }, (f: ReturnType<typeof fixture>) => { f.rest.comments = NaN; }, (f: ReturnType<typeof fixture>) => { f.graph.errors = [{ message: "field denied" }]; }]) {
      const f = fixture(); mutate(f); await expect(readPullRequest(ref, f.request)).rejects.toThrow();
    }
  });
  it("fails closed on every unsafe merge state", async () => {
    const good = await readPullRequest(ref, fixture().request);
    for (const change of [{ state: "CLOSED" }, { state: "MERGED" }, { draft: true }, { canWrite: false }, { methods: [] }, { review: "REVIEW_REQUIRED" }, { review: "UNKNOWN" }, { ci: "NONE" }, { ci: "PENDING" }, { mergeState: "DIRTY" }, { mergeState: "UNKNOWN" }, { mergeState: "BLOCKED" }, { mergeState: "BEHIND" }] as Partial<PullRequestStatus>[]) {
      expect(mergeBlockReason({ ...good, ...change })).toBeTruthy();
    }
  });
});

describe("PR service and merge", () => {
  it("deduplicates and caches reads, but rechecks everything on explicit merge", async () => {
    const f = fixture(); const service = new PullRequestService(f.request);
    await Promise.all([service.read(ref), service.read(ref)]);
    expect(f.calls.length).toBe(2);
    await service.merge(ref, sha, "squash");
    expect(f.calls.length).toBe(5);
    expect(f.calls[4]).toEqual(["repos/acme/repo/pulls/42/merge", "--method", "PUT", "-f", `sha=${sha}`, "-f", "merge_method=squash"]);
    await service.read(ref); expect(f.calls.length).toBe(7);
  });
  it("never sends a write when the confirmed head changed or a review/check regressed", async () => {
    for (const change of ["head", "ci", "review", "conflict", "method"]) {
      const f = fixture(); const service = new PullRequestService(f.request);
      await service.read(ref);
      if (change === "head") { f.rest.head.sha = "b".repeat(40); f.pr.headRefOid = f.rest.head.sha; }
      if (change === "ci") f.pr.commits.nodes[0].commit.statusCheckRollup!.state = "FAILURE";
      if (change === "review") f.pr.reviewDecision = "CHANGES_REQUESTED";
      if (change === "conflict") f.pr.mergeStateStatus = "DIRTY";
      await expect(service.merge(ref, sha, change === "method" ? "rebase" : "squash")).rejects.toThrow();
      expect(f.calls.some((args) => args.includes("PUT"))).toBe(false);
    }
  });
  it("serializes duplicate merge requests and never treats a provider refusal as success", async () => {
    const f = fixture(); const service = new PullRequestService(f.request);
    const first = service.merge(ref, sha, "merge");
    await expect(service.merge(ref, sha, "merge")).rejects.toThrow("already in progress");
    await first;
    f.rejectMerge(); await expect(service.merge(ref, sha, "merge")).rejects.toThrow("did not merge");
  });
  it("does not cache provider failures", async () => {
    const f = fixture(); let fail = true;
    const service = new PullRequestService(async (args) => { if (fail) throw new Error("offline"); return f.request(args); });
    await expect(service.read(ref)).rejects.toThrow("offline");
    fail = false; expect((await service.read(ref)).ci).toBe("SUCCESS");
  });
});

describe("report references", () => {
  it("keeps multiple PRs, deduplicates and rejects arbitrary hosts or paths", () => {
    expect(pullRequestRefs(`${ref.url} ${ref.url} https://github.com/acme/repo/pull/43 https://evil.example/acme/repo/pull/1 https://github.com/../repo/pull/1`)).toHaveLength(2);
  });
  it("uses only the newest report, never an unrelated historical PR", () => {
    const b = new LedgerBuilder().add({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: ref.url, evidence: "" } });
    expect(reportPullRequests(b.facts)).toEqual([ref]);
    b.add({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: "No PR created", evidence: "" } });
    expect(reportPullRequests(b.facts)).toEqual([]);
  });
});
