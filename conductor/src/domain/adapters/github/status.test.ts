import { describe, expect, it } from "@rstest/core";
import type { Fact } from "../../../core/lib/facts.js";
import { foldTask } from "../../../core/lib/fold.js";
import { deriveCiStatus, deriveReviewStatus, readPullRequests } from "./status.js";

describe("pull request status derivations", () => {
  it("uses each non-author reviewer's latest decisive review", () => {
    const reviews = [
      review("author", "CHANGES_REQUESTED", "2026-09-16T00:00:00Z"),
      review("alice", "CHANGES_REQUESTED", "2026-09-16T00:01:00Z"),
      review("bob", "APPROVED", "2026-09-16T00:02:00Z"),
      review("alice", "COMMENTED", "2026-09-16T00:03:00Z"),
      review("alice", "APPROVED", "2026-09-16T00:04:00Z"),
    ];
    expect(deriveReviewStatus(reviews, "AUTHOR")).toBe("APPROVED");
    expect(deriveReviewStatus([...reviews, review("bob", "CHANGES_REQUESTED", "2026-09-16T00:05:00Z")], "author")).toBe("CHANGES_REQUESTED");
    expect(deriveReviewStatus([review("author", "APPROVED", "2026-09-16T00:00:00Z")], "author")).toBe("UNREVIEWED");
  });

  it("rolls up absent, pending, failed, and successful current-head checks", () => {
    expect(deriveCiStatus([])).toEqual({ status: "NONE", total: 0, completed: 0, failed: 0 });
    expect(deriveCiStatus([{ status: "completed", conclusion: "success" }, { status: "queued" }]))
      .toEqual({ status: "PENDING", total: 2, completed: 1, failed: 0 });
    expect(deriveCiStatus([{ status: "completed", conclusion: "failure" }, { status: "queued" }]))
      .toEqual({ status: "PENDING", total: 2, completed: 1, failed: 1 });
    expect(deriveCiStatus([{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "timed_out" }]))
      .toEqual({ status: "FAILURE", total: 2, completed: 2, failed: 1 });
    expect(deriveCiStatus([{ status: "completed", conclusion: "neutral" }, { status: "completed", conclusion: "skipped" }]))
      .toEqual({ status: "SUCCESS", total: 2, completed: 2, failed: 0 });
  });
});

describe("pull request status reader", () => {
  it("shapes GitHub responses and keeps successful fields when one subrequest fails", async () => {
    const first = "https://github.com/acme/widgets/pull/12";
    const second = "https://github.com/acme/widgets/pull/13";
    const responses = new Map<string, unknown>([
      ["/repos/acme/widgets/pulls/12", details(12, first, "sha-12")],
      ["/repos/acme/widgets/pulls/12/reviews?per_page=100", [
        review("author", "CHANGES_REQUESTED", "2026-09-16T00:00:00Z"),
        review("reviewer", "APPROVED", "2026-09-16T00:01:00Z"),
      ]],
      ["/repos/acme/widgets/commits/sha-12/check-runs?per_page=100", {
        total_count: 3,
        check_runs: [
          { status: "completed", conclusion: "success" },
          { status: "completed", conclusion: "failure" },
          { status: "queued", conclusion: null },
        ],
      }],
      ["/repos/acme/widgets/pulls/13", details(13, second, "sha-13")],
      ["/repos/acme/widgets/commits/sha-13/check-runs?per_page=100", {
        total_count: 1,
        check_runs: [{ status: "completed", conclusion: "success" }],
      }],
    ]);
    const get = async (path: string) => responses.get(path);

    const result = await readPullRequests(taskWith(`${first}\nthen ${second}`), get, new Date("2026-09-16T12:00:00Z"));

    expect(result.checkedAt).toBe("2026-09-16T12:00:00.000Z");
    expect(result.pullRequests).toHaveLength(2);
    expect(result.pullRequests[0]).toMatchObject({
      title: "PR 12",
      number: 12,
      owner: "acme",
      repo: "widgets",
      state: "open",
      draft: false,
      merged: false,
      head: { ref: "feature-12", sha: "sha-12" },
      base: { ref: "main", sha: "base-sha" },
      additions: 120,
      deletions: 12,
      changed_files: 4,
      comments: 2,
      review_comments: 3,
      total_comments: 5,
      html_url: first,
      review: "APPROVED",
      ci: "PENDING",
      checks: { total: 3, completed: 2, failed: 1 },
    });
    expect(result.pullRequests[0].error).toBeUndefined();
    expect(result.pullRequests[1]).toMatchObject({
      number: 13,
      title: "PR 13",
      ci: "SUCCESS",
      checks: { total: 1, completed: 1, failed: 0 },
      error: "GitHub reviews could not be read.",
    });
    expect(result.pullRequests[1].review).toBeUndefined();
  });
});

function review(login: string, state: string, submitted_at: string) {
  return { user: { login }, state, submitted_at };
}

function details(number: number, html_url: string, sha: string) {
  return {
    number,
    html_url,
    title: `PR ${number}`,
    state: "open",
    draft: false,
    merged: false,
    additions: 120,
    deletions: 12,
    changed_files: 4,
    comments: 2,
    review_comments: 3,
    user: { login: "author" },
    head: { ref: `feature-${number}`, sha },
    base: { ref: "main", sha: "base-sha" },
  };
}

function taskWith(text: string) {
  const at = new Date("2026-09-16T00:00:00Z");
  const facts: Fact[] = [
    { seq: 1, id: "f1", taskId: "t1", kind: "Created", by: "guardian", payload: { brief: "ship it" }, createdAt: at },
    { seq: 2, id: "f2", taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", status: "succeeded", summary: text }, createdAt: at },
  ];
  return foldTask(facts);
}
