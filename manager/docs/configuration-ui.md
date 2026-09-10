# Editing configuration

Open **More → Configuration & status**. Each setting is already editable in a
full-width row: name/description on the left, control on the right (stacked on
mobile), following Rome's settings-row pattern. No Edit button or separate form
view. Save/Cancel appear inline only on the row with a change, including switches.
Saving one row does not commit or discard other rows' drafts. Saved status and
validation/network errors stay with the affected row. Runtime counts are in a
collapsed status disclosure, not duplicated alongside the setting controls.

Setup is still required for initialization. Settings load independently of the
dashboard's project filter. Polling never replaces unsaved edits. Each successful
save advances the shared revision for subsequent row saves. Stale edits require
an explicit discard/reload. When rearranging shared-repository routes, disable
intake first, edit the routing labels/repos, then enable intake again.

## Mutable after initialization

- Global worker limit (1–20): affects subsequent scheduling, not live workers.
- Retry/start budget (1–20): subsequent reconciliation, including existing tasks.
  Reducing it may ask the guardian sooner; it does not automatically retry tasks
  already awaiting a person.
- Legacy worker age cap (1–168 hours): next reconciliation may mark older legacy
  workers Lost. Heartbeat-leased workers continue to use their lease policy.
- Session reuse: future follow-ups only; worktrees and live sessions are retained.
- Close on GitHub issue closure: next pass, including already-open tasks.
- Default intake label; legacy repository list; per-project intake enablement,
  intake label, routing label, and repository: future intake/Board routing.
  Enabling intake can ingest already-labeled open issues on the next pass.
- Project source directories/repositories and default project: new task bindings
  only. Existing tasks keep their source snapshot and worktree. Source paths
  must point inside a valid local Git repository for future worker launches;
  saving a path does not create or clone it. An ambiguous chat still requires
  an explicit project, regardless of the default.

## Deliberately read-only here

Project IDs and adding/removing projects remain a `manager:setup` operation.
Worker-agent identity needs session compatibility planning; cadence changes need
scheduled-routine replacement. Both remain setup operations. This editor neither
creates/replaces routines nor launches, stops, or restarts workers.

## Write safety

Guardian-only `GET /api/apps/manager/config` returns normalized settings and a
content revision. Guardian-only `PATCH config` requires `{ revision, changes }`.
Strict allowlisting rejects unknown/immutable fields, out-of-range/fractional
numbers, malformed paths/repos/labels, and ambiguous shared-repository routes.
It does not use the unattended parser's permissive defaulting for human input.

The write acquires the same reconcile lock as setup/scheduling, re-reads settings,
rejects stale revisions with 409, and binds all legacy tasks from **old** settings
before the single settings write. A partial legacy-binding migration is safe to
retry. The lock is released on every path. No existing ledger fact is rewritten.
A conflict retains the draft and offers an explicit discard/reload; a busy lock
or validation error retains edits for correction or retry.

Verification includes strict validation/unit rendering tests and API boundary
coverage for authorization, stale writers, locks, migration ordering, malformed
requests, and storage failure. Browser save-path tests use intercepted fetch
responses, not real task launches or configuration changes.
