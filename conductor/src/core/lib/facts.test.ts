import { describe, expect, it } from "@rstest/core";
import { describeFact, type Fact } from "./facts.js";

describe("fact prompt rendering", () => {
  it("shows an immutable artifact reference without copying opaque event payloads", () => {
    const fact: Fact = {
      seq: 12,
      id: "f12",
      taskId: "t1",
      kind: "Event",
      by: "runtime",
      createdAt: new Date("2026-09-22T03:00:00Z"),
      payload: {
        source: "github",
        type: "pr_review",
        summary: "alice reviewed PR 12 (changes requested; 1 inline review comment)",
        data: {
          key: "review:42",
          reviewer: "alice",
          commentIds: [101],
          artifact: {
            repo: "acme/widgets-work",
            path: "_evidence/github/acme/widgets/pulls/12/reviews/42.json",
            commit: "abc123",
            sha256: "digest",
            url: "https://github.com/acme/widgets-work/blob/abc123/review.json",
          },
        },
      },
    };

    const rendered = describeFact(fact, { full: true });
    expect(rendered).toContain("github/pr_review: alice reviewed PR 12");
    expect(rendered).toContain("Artifact: acme/widgets-work@abc123:_evidence/github/acme/widgets/pulls/12/reviews/42.json");
    expect(rendered).toContain("sha256 digest");
    expect(rendered).not.toContain("commentIds");
  });
});
