# PR-focused report cards

A Report's current, explicit GitHub PR links appear on the dashboard and task detail with:

- live additions/deletions;
- comment count: discussion comments + inline review comments (not review-summary bodies, reactions, or worker chat messages);
- GitHub approval and current-head aggregate check status, with check count;
- Open PR, Merge PR, and refresh shortcuts.

Reports without PR URLs say so instead of selecting an unrelated historical PR. Multiple PRs have independent cards. Questions keep Answer in chat. Full reports, evidence, task links and Discuss task remain in Details. No task lifecycle, worker protocol, or scheduler change.

## GitHub reads

Guardian-only GET `tasks/:id/pull-request?url=...` requires the canonical PR to be present in the task's latest Report. Uses Rome-managed `gh api` with argument arrays, never a shell command or credentials. REST PR totals avoid comment pagination; GraphQL supplies current-head CI, review decision, merge status and repository permissions/methods. When GitHub has no review rule, latest opinionated reviews are used; a truncated review set is unknown. Missing CI is never passing; successful GitHub rollups may include neutral/skipped checks.

Reads share a 30-second disposable cache. Visible cards refresh every minute and on returning to the tab; manual refresh is also available. Errors show unavailable/stale status and disable merging. REST/GraphQL head mismatch fails rather than combining stats from different commits.

## Explicit merges

Guardian-only POST `tasks/:id/pull-request/merge` requires URL, confirmed head SHA, repository-supported method and `confirmed: true`. The user selects an allowed method (squash is preferred when supported) and confirms the exact PR, target branch and commit in the UI.

The server bypasses the read cache and requires open/non-draft PR, approval, successful CI, write permission and GitHub CLEAN merge state. New head commits, changed approvals, failed/pending/missing checks, conflicts and unknown states all block. GitHub's merge API gets the expected SHA, preventing a concurrent push from merging unseen commits. No admin-bypass option, auto-merge, merge queue, branch deletion or task completion is requested. Repositories that do not require approvals or CI still require both for this dashboard shortcut; Open PR remains available. GitHub may still refuse a merge due to its latest rules; report the failure and refresh. Duplicate in-flight merges within the handler are rejected.

A successful merge is logged and refreshes the PR state. Task completion continues to follow tracked issue closure or an explicit guardian instruction; merging itself never writes Completed.

API references: [GitHub PR REST API](https://docs.github.com/en/rest/pulls/pulls), [GitHub PR GraphQL fields](https://docs.github.com/en/graphql/reference/pulls).

Tests mock all writes. Live verification only reads real GitHub PRs; browser merge-flow tests intercept the POST and never merge a real PR.
