import { describe, expect, it } from "@rstest/core";
import { toPullReview, toPullReviewComment } from "./index.js";

describe("GitHub review observation normalization", () => {
  it("reads typed routing fields without parsing prose and preserves the provider JSON", () => {
    const raw = {
      id: 42,
      user: { login: "alice", avatar_url: "https://example.test/a.png" },
      state: "CHANGES_REQUESTED",
      body: "Please change this",
      submitted_at: "2026-09-22T00:00:00Z",
      commit_id: "deadbeef",
      future_field: { kept: true },
    };

    expect(toPullReview(raw)).toEqual({
      id: 42,
      user: "alice",
      state: "CHANGES_REQUESTED",
      body: "Please change this",
      submittedAt: "2026-09-22T00:00:00Z",
      raw,
    });
    expect(toPullReview({ id: "not-an-id", state: "APPROVED" })).toBeUndefined();
  });

  it("accepts GitHub's numeric ids as strings but rejects malformed comments", () => {
    const raw = {
      id: "101",
      pull_request_review_id: 42,
      user: { login: "bot" },
      path: "src/a.ts",
      line: 9,
      body: "finding",
      diff_hunk: "@@ -1 +1 @@",
    };
    expect(toPullReviewComment(raw)).toMatchObject({ id: 101, reviewId: 42, user: "bot", raw });
    expect(toPullReviewComment(null)).toBeUndefined();
    expect(toPullReviewComment({ id: -1 })).toBeUndefined();
  });
});
