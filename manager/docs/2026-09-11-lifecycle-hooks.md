# User-defined task preparation and evaluation

Implemented Prepare/Evaluate as optional agent + instruction definitions with
global defaults and per-project overrides. Retained the existing coding execution,
GitHub intake, worktree and completion mechanisms; business rules stay in user
instructions. Added durable Prepared/Rework facts, phase-specific output validation,
submission/agreement references, separate evaluator sessions, bounded rework,
phase-aware failure/revisit handling, and a guard against late results superseding
human instructions. No database migration is required (fact payloads remain JSON).

Configuration UI supports atomic hook definitions and inheritance/disable controls
through the existing guardian-only, revision-checked API. Task detail exposes the
prepared agreement; Workers identifies Prepare/Evaluate runs. Existing tasks keep
their protocol; installation/configuration saves do not start or migrate them.

Verification: regression tests initially failed for intake snapshots, preparation
before work, and invalid configuration; they pass after implementation. Further
coverage includes end-to-end pure lifecycle transitions, submitted-but-uncommitted
work assessed before reporting, rework/session isolation, waiting, stale results,
retry budgets, phase-gated replies, real SQLite late-result guards, runner wiring,
config API authorization/revisions, and UI markup/config serialization.

See lifecycle-hooks.md for configuration, examples, exact protocol, and limitations.
