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

  it("renders a worker's structured detail and report, and reads a legacy string detail as the report", () => {
    const returned = (payload: Record<string, unknown>): Fact => ({
      seq: 20, id: "f20", taskId: "t1", kind: "Returned", by: "w-1",
      createdAt: new Date("2026-09-24T03:00:00Z"),
      payload: { workerId: "w-1", status: "blocked", summary: "Two readings.", ...payload },
    } as Fact);
    const current = describeFact(returned({ report: "Read settings.ts.", detail: { needs: "pm" } }), { full: true });
    expect(current).toContain("worker w-1 blocked: Two readings.\ndetail:\n  needs: pm\nRead settings.ts.");
    const legacy = describeFact(returned({ detail: "Old free-form text." }), { full: true });
    expect(legacy).toContain("worker w-1 blocked: Two readings.\nOld free-form text.");
  });

  it("cites a stored worker report instead of repeating it", () => {
    const fact = {
      seq: 21, id: "f21", taskId: "t1", kind: "Returned", by: "w-1",
      createdAt: new Date("2026-09-24T03:00:00Z"),
      payload: {
        workerId: "w-1", status: "blocked", summary: "Two readings.", detail: { needs: "pm" },
        reportRef: { repo: "acme/work", path: "_conductor/tasks/t1/reports/w-1.md", commit: "abc123", sha256: "d", bytes: 9, url: "https://x" },
      },
    } as Fact;
    const rendered = describeFact(fact, { full: true });
    expect(rendered).toContain("needs: pm");
    expect(rendered).toContain("Full report: acme/work@abc123:_conductor/tasks/t1/reports/w-1.md");
  });
});
