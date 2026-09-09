# Clean Manager overview

The root route is now an action-focused overview, not a stack of attention cards followed by a duplicate task list. Existing theme tokens, typography, task ledger, worker behavior and GitHub merge API are unchanged.

## Overview

Each open task is partitioned exactly once, newest activity first within its group:
- **Decisions:** current questions, shown in full, with Answer in chat and a task link. A question remains here even if it mentions a PR.
- **Pull requests:** explicit PR links in current reports, shown with live PR title/repository, additions/deletions, comments, approval and CI; Open PR / Merge PR preserved. Multiple PRs get independent cards. Details shares the action row and reveals the dated historical report, original task title, evidence, task link and discussion.
- **In progress:** working, waiting and queued tasks as compact title/status links.
- **Other results:** collapsed native disclosure with visible count. Expanded rows show actual report summaries, never a generic no-PR placeholder; opening a row reaches the full report/task. Closing the disclosure does not complete, cancel or acknowledge tasks.

Closed tasks do not appear on the overview. Project badges are suppressed when scoped to a project; the selector is hidden for single-project installs. Repository identity remains visible on PR cards to distinguish identical PR numbers from different repositories.

## Navigation

The header, above all page content, contains Overview, All tasks, Board and More. More holds History and Diagnostics links (Configuration & status, Workers, Ledger). Existing workers/ledger/board/task deep links continue to work; `tasks` now opens the separate all-task browser and the root opens Overview. Secondary views never repeat the overview stack. Project scoping applies to overview/task/history/diagnostic views as before; Board retains its own repository selection.

The seven-counter tally, runtime configuration sentence, routine lock indicator and persistent refresh/time labels are gone from the header. Configuration and diagnostic counts remain in More → Configuration & status (read-only). The legacy age-cap label is now explicitly distinguished from heartbeat-based worker leases.

Global data refresh shows a spinner only while fetching, or an accessible retry warning after failure / more than three minutes without a successful load. Normal polling remains 15 seconds and resumes on focus/visibility; hidden tabs do not poll. Project changes clear the previous data while the new scope loads, preventing mislabelled tasks.

## Task rows and safety

All tasks and History use compact rows without report transcripts, worker/fact/retry counters or raw event names. Full execution history and worker links remain on task detail. Historical claims cannot visually compete with the overview's current GitHub statuses.

Blocked Merge PR buttons remain focusable (`aria-disabled`) so keyboard/touch users can request the blocking reason; the handler never opens confirmation or posts a merge while blocked. Reasons are hidden until requested. Existing explicit merge confirmation, captured SHA, supported method selection, fresh server-side checks, and error handling are unchanged. No real merges are used for tests.

## Verification

Unit/render tests cover disjoint open-task groups, closed exclusion, questions with PR links, historical-vs-current PR references, multi-PR reports, actual result summaries, quiet health UI, early navigation, scoped project visibility, secondary routes, and removal of duplicate/stale report claims. Browser checks cover desktop/mobile layout, disclosure/navigation/filter behavior, and read-only or intercepted mutation fixtures. All production task and scheduler behavior remains unchanged.
