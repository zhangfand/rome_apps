# Build Account Growth coach

## What changed

- Replaced the scaffold examples with a dedicated draft-only X growth coach.
- Added read-only X and LinkedIn snapshot actions backed by the connected Rome Browser.
- Added a labeled baseline fallback so a temporary X rate limit cannot erase the latest known evidence; every component reports whether it is live or baseline.
- Added read-only X research for relevant accounts and specific current conversations.
- Added a saved weekly planning action, plan persistence, and a responsive dashboard with deep-linked plan details.
- Added a dedicated coach chat entry point and a custom icon.

## Decisions

- X is the primary growth channel; LinkedIn is supporting evidence for niche and topic fit.
- The boundary is structural as well as instructional: the coach only has read actions plus local plan storage, and no social publishing or engagement actions.
- Weekly planning is manually triggered. A routine can bind to `account-growth:weekly_plan` without changing the draft-only boundary.

## Validation

- `pnpm typecheck` passed.
- `pnpm build` passed.
- The first install surfaced a strict YAML quoting issue in the weekly action metadata; it was fixed before release.
- The first runtime snapshot hit X's session rate limit; the action now degrades to an explicitly labeled baseline per data source instead of failing the whole workflow.
- Installed successfully through `system:app_management`.
- Exercised the live snapshot and generated the first complete weekly plan; the plan was saved with ID `3834a1d6-2b7e-4a6b-bf0d-6fb17a126665`.
- Browser inspection confirmed the dashboard, strategy, draft-only badge, and saved plan history render correctly.
- Independent `coding:app_verification` verdict: pass. It confirmed build/artifact parity, dashboard and API behavior, snapshot and X research actions, saved-plan persistence, coach boundary, and absence of social write actions.

## Follow-up

- The guardian should review and approve or revise each post, visual, and reply draft individually before any manual publishing.
