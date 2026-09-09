import { describe, expect, it } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PullRequestCard, PullRequestMetrics } from "./pull-request";
import type { PullRequestStatus } from "../../lib/pull-request.js";
const pr = { url: "https://github.com/acme/repo/pull/42", repo: "acme/repo", number: 42 };
const data: PullRequestStatus = { ...pr, title: "Fix the bug", additions: 120, deletions: 30, comments: 7, discussionComments: 3, reviewComments: 4, review: "APPROVED", ci: "SUCCESS", checks: 8, state: "OPEN", draft: false, headSha: "a".repeat(40), headBranch: "fix", baseBranch: "main", mergeState: "CLEAN", canWrite: true, methods: ["squash"], checkedAt: new Date().toISOString(), mergeBlocked: null };
describe("PR cards", () => {
  it("renders all requested metrics and their GitHub shortcuts", () => {
    const html = renderToStaticMarkup(createElement(PullRequestMetrics, { pr, data }));
    for (const label of ["+120", "−30", "7 comments", "Approved", "CI passed", "/checks", "3 discussion comments + 4 inline review comments"]) expect(html).toContain(label);
  });
  it("shows loading unknowns rather than zero or green and cannot merge before loading", () => {
    const html = renderToStaticMarkup(createElement(PullRequestCard, { taskId: "t1", pr }));
    for (const label of ["Review unknown", "CI unknown", "Open PR", "Merge PR", "Checking GitHub"]) expect(html).toContain(label);
    expect(html).toContain("disabled"); expect(html).not.toContain("CI passed"); expect(html).not.toContain("Confirm merge");
  });
  it("distinguishes negative, missing, draft, closed and merged states", () => {
    for (const [patch, label] of [[{ review: "CHANGES_REQUESTED" }, "Changes requested"], [{ ci: "PENDING" }, "CI pending"], [{ ci: "NONE", checks: 0 }, "No CI checks"], [{ draft: true }, "Draft"], [{ state: "CLOSED" }, "Closed"], [{ state: "MERGED" }, "Merged"]] as Array<[Partial<PullRequestStatus>, string]>) {
      expect(renderToStaticMarkup(createElement(PullRequestMetrics, { pr, data: { ...data, ...patch } }))).toContain(label);
    }
  });
});
