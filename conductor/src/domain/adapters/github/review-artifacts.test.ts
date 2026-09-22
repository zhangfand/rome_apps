import { describe, expect, it } from "@rstest/core";
import { foldTask } from "../../../core/lib/fold.js";
import type { PullEventPlan } from "./pulls.js";
import { externalizeReviewArtifacts } from "./review-artifacts.js";

const reviewPlan: PullEventPlan = {
  request: {
    op: "push_event",
    source: "github",
    taskId: "t1",
    type: "pr_review",
    key: "review:42",
    summary: "alice reviewed PR 12",
    data: { url: "https://github.com/acme/widgets/pull/12", reviewId: 42, commentCount: 1, commentIds: [101] },
  },
  artifact: {
    path: "_evidence/github/acme/widgets/pulls/12/reviews/42.json",
    value: { schema: "conductor.github.pull-review/v1", review: { id: 42, body: "full body" } },
  },
};

describe("GitHub review artifact externalization", () => {
  it("adds an immutable work-repository reference to the compact event", async () => {
    const events = await externalizeReviewArtifacts(task(true), [reviewPlan], logger(), async (repo, drafts) => {
      expect(repo).toEqual({ repo: "acme/widgets-work", workingDir: "/work/widgets" });
      expect(drafts[0].value).toMatchObject({ review: { body: "full body" } });
      return new Map([[drafts[0].path, {
        repo: repo.repo,
        path: drafts[0].path,
        commit: "abc123",
        sha256: "digest",
        bytes: 123,
        mediaType: "application/json",
        url: "https://github.com/acme/widgets-work/blob/abc123/review.json",
      }]]);
    });

    expect(events).toHaveLength(1);
    expect(events[0].data).toMatchObject({
      reviewId: 42,
      commentIds: [101],
      artifact: { repo: "acme/widgets-work", commit: "abc123", sha256: "digest" },
    });
    expect(JSON.stringify(events[0].data)).not.toContain("full body");
  });

  it("does not write a dangling review event when the work repository is unavailable", async () => {
    const warnings: unknown[] = [];
    const ordinary: PullEventPlan = {
      request: { op: "push_event", source: "github", taskId: "t1", type: "pr_merged", summary: "merged" },
    };

    const missing = await externalizeReviewArtifacts(task(false), [reviewPlan, ordinary], logger(warnings));
    expect(missing).toEqual([ordinary.request]);
    expect(warnings).toHaveLength(1);

    const failed = await externalizeReviewArtifacts(task(true), [reviewPlan, ordinary], logger(warnings), async () => {
      throw new Error("push failed");
    });
    expect(failed).toEqual([ordinary.request]);
    expect(warnings).toHaveLength(2);
  });
});

function task(withWorkRepo: boolean) {
  return foldTask([{
    seq: 1,
    id: "f1",
    taskId: "t1",
    kind: "Created" as const,
    by: "guardian",
    createdAt: new Date("2026-09-22T00:00:00Z"),
    payload: {
      brief: "ship review storage",
      projectId: "widgets",
      project: withWorkRepo ? { workRepo: { repo: "acme/widgets-work", workingDir: "/work/widgets" } } : {},
    },
  }]);
}

function logger(warnings: unknown[] = []) {
  return { warn(message: string, meta?: Record<string, unknown>) { warnings.push({ message, meta }); } };
}
