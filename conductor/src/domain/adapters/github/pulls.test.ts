import { describe, expect, it } from "@rstest/core";
import type { Fact } from "../../../core/lib/facts.js";
import { foldTask } from "../../../core/lib/fold.js";
import { pullEvents, type PullObservation, type PullRef } from "./pulls.js";

const ref: PullRef = { owner: "acme", repo: "widgets", number: 12, url: "https://github.com/acme/widgets/pull/12" };

describe("GitHub pull review events", () => {
  it("keeps only a compact review envelope beside a structured artifact draft", () => {
    const plans = pullEvents(task(), ref, observation(), ["alice"]);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      request: {
        type: "pr_review",
        key: "review:42",
        data: {
          reviewId: 42,
          reviewer: "alice",
          state: "CHANGES_REQUESTED",
          commentCount: 3,
          commentIds: [101, 102, 103],
        },
      },
      artifact: {
        path: "_evidence/github/acme/widgets/pulls/12/reviews/42.json",
        value: {
          schema: "conductor.github.pull-review/v1",
          review: { id: 42, body: "please adjust" },
          comments: [{ id: 101, body: "first" }, { id: 102, body: "second" }, { id: 103, body: "third" }],
        },
      },
    });
    expect(plans[0].request.summary).toContain("3 inline review comments");
    expect(plans[0].request.data).not.toHaveProperty("body");
    expect(plans[0].request.data).not.toHaveProperty("comments");
  });

  it("keeps separate review submissions as separate events", () => {
    const seen = observation();
    seen.reviews!.push({ id: 43, user: "bob", state: "APPROVED", body: "looks good" });
    seen.reviewComments!.push({ id: 104, reviewId: 43, user: "bob", path: "src/d.ts", line: 4, body: "nice" });

    expect(pullEvents(task(), ref, seen, ["alice", "bob"]).map((plan) => plan.request.key)).toEqual(["review:42", "review:43"]);
  });

  it("ignores code-review events from anyone outside the configured author allowlist", () => {
    const seen = observation();
    seen.reviews!.push({ id: 43, user: "ZhangFanD", state: "APPROVED", body: "ship it" });
    seen.reviewComments!.push({ id: 104, reviewId: 43, user: "zhangfand", path: "src/d.ts", line: 4, body: "one fix" });

    const plans = pullEvents(task(), ref, seen, ["zhangfand"]);

    expect(plans.map((plan) => plan.request.key)).toEqual(["review:43"]);
    expect(plans[0]).toMatchObject({
      request: { data: { reviewer: "ZhangFanD", commentIds: [104] } },
      artifact: { value: { comments: [{ id: 104, author: "zhangfand" }] } },
    });
  });

  it("waits for a pending review to be submitted", () => {
    const seen = observation();
    seen.reviews![0].state = "PENDING";

    expect(pullEvents(task(), ref, seen, ["alice"])).toEqual([]);
  });

  it("does not replay comments already captured by the legacy per-comment events", () => {
    const events = [
      githubEvent(2, "pr_review", "review:42", {}),
      githubEvent(3, "pr_review_comment", "rc:101", {}),
      githubEvent(4, "pr_review_comment", "rc:102", {}),
      githubEvent(5, "pr_review_comment", "rc:103", {}),
    ];
    expect(pullEvents(task(events), ref, observation(), ["alice"])).toEqual([]);
  });

  it("batches comments missed after an already-recorded review shell", () => {
    const events = pullEvents(task([githubEvent(2, "pr_review", "review:42", {})]), ref, observation(), ["alice"]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      request: {
        type: "pr_review_comments",
        key: "review-comments:42",
        data: { reviewId: 42, commentCount: 3, commentIds: [101, 102, 103] },
      },
      artifact: {
        path: "_evidence/github/acme/widgets/pulls/12/reviews/42-comments.json",
      },
    });
  });
});

function observation(): PullObservation {
  return {
    reviews: [{ id: 42, user: "alice", state: "CHANGES_REQUESTED", body: "please adjust", submittedAt: "2026-09-19T01:00:00Z" }],
    reviewComments: [
      { id: 101, reviewId: 42, user: "alice", path: "src/a.ts", line: 10, body: "first" },
      { id: 102, reviewId: 42, user: "alice", path: "src/b.ts", line: 20, body: "second" },
      { id: 103, reviewId: 42, user: "alice", path: "src/c.ts", line: 30, body: "third" },
    ],
  };
}

function task(extra: Fact[] = []) {
  const at = new Date("2026-09-19T00:00:00Z");
  return foldTask([
    { seq: 1, id: "f1", taskId: "t1", kind: "Created", by: "guardian", payload: { brief: `ship ${ref.url}` }, createdAt: at },
    ...extra,
  ]);
}

function githubEvent(seq: number, type: string, key: string, data: Record<string, unknown>): Fact {
  return {
    seq,
    id: `f${seq}`,
    taskId: "t1",
    kind: "Event",
    by: "runtime",
    payload: { source: "github", type, summary: type, data: { key, ...data } },
    createdAt: new Date("2026-09-19T00:00:00Z"),
  } as Fact;
}
