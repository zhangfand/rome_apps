# PR-focused report cards

A Report's current, explicit GitHub PR links appear on the dashboard and task detail with:

- live additions/deletions;
- comment count: discussion comments + inline review comments (not review-summary bodies, reactions, or worker chat messages);
- GitHub approval and current-head aggregate check status, with check count;
- Open PR and Merge PR shortcuts.

Reports without PR URLs say so instead of selecting an unrelated historical PR. Multiple PRs have independent cards. Questions keep Answer in chat. Full reports, evidence, task links and Discuss task remain in Details. No task lifecycle, worker protocol, or scheduler change.

## GitHub reads

Guardian-only GET `tasks/:id/pull-request?url=...` requires the canonical PR to be present in the task's latest Report. Uses Rome-managed `gh api` with argument arrays, never a shell command or credentials. REST PR totals avoid comment pagination; GraphQL supplies current-head CI, review decision, merge status and repository permissions/methods. When GitHub has no review rule, latest opinionated reviews are used; a truncated review set is unknown. Missing CI is never passing; successful GitHub rollups may include neutral/skipped checks.

Reads share a 30-second disposable cache. Visible cards refresh every minute and on returning to the tab. Fresh idle cards show no refresh icon, timestamp, or merge-blocked explanation line (the disabled merge button retains its reason in a tooltip). A spinner appears only while refreshing. Read failures, unavailable timestamps/data, or data over 3 minutes old show an accessible warning icon with a reason/retry tooltip; clicking it retries. Stale/error data disables merging and mutes positive status colors. Explicit merge failures remain visible as actionable errors. REST/GraphQL head mismatch fails rather than combining stats from different commits.

## Explicit merges

Guardian-only POST `tasks/:id/pull-request/merge` requires URL, confirmed head SHA, repository-supported method and `confirmed: true`. The user selects an allowed method (squash is preferred when supported) and confirms the exact PR, target branch and commit in the UI.

The server bypasses the read cache and requires an open/non-draft PR, no outstanding review requirement or changes requested, successful CI, write permission and GitHub CLEAN merge state. Formal approval is displayed but not imposed when the repository does not require it. New head commits, changed approvals, failed/pending/missing checks, conflicts and unknown states all block. GitHub's merge API gets the expected SHA, preventing a concurrent push from merging unseen commits. No admin-bypass option, auto-merge, merge queue, branch deletion or task completion is requested. Repositories without CI checks still require passing CI for this dashboard shortcut; Open PR remains available. GitHub may still refuse a merge due to its latest rules; report the failure and refresh. Duplicate in-flight merges within the handler are rejected.

A successful merge is logged and refreshes the PR state. Task completion continues to follow tracked issue closure or an explicit guardian instruction; merging itself never writes Completed.

API references: [GitHub PR REST API](https://docs.github.com/en/rest/pulls/pulls), [GitHub PR GraphQL fields](https://docs.github.com/en/graphql/reference/pulls).

Tests mock all writes. Live verification only reads real GitHub PRs; browser merge-flow tests intercept the POST and never merge a real PR.
