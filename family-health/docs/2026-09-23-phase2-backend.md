# 2026-09-23 · Phase 2 backend

## What changed

- **Store** (`src/db/repositories/store.ts`): all SQL for members, reports, results,
  findings, interventions, measurements, insights; explicit cascades; demo clear.
- **Read models** (`src/lib/analytics.ts`): per-exam snapshots from confirmed reports
  with derived HOMA-IR / non-HDL / eGFR / GLB / A/G / BMI computed on the fly; series
  merging report, derived and home-measurement points; overview cards (latest exam,
  abnormal count, top changes, alerts); goal panels; indicator detail with reference
  band (printed range, else default) and overlapping interventions; findings timelines.
  Weight trend is judged against the member's healthy BMI range.
- **API** (`src/api/index.ts`): guardian-only; raw-binary uploads one file per request
  (60 MB cap, Chinese 413); path-safe page images; extract/retry (detached action),
  confirm (triggers report interpretation), review edits with recomputation, indicator
  search, interventions, measurements, insights, demo seed/clear.
- **Extraction** (`src/lib/extraction.ts`): batches of 5 pages → `family-health:extractor`
  (vision via Read, strict output schema) → validate/repair → deterministic mapping →
  one `family-health:mapper` call for unmapped names → flags → findings normalization →
  `needs_review`. Per-batch retry, partial warnings, idempotent re-runs, stale detection
  (15 min) so reports stuck after a daemon restart can be retried.
- **Media** in a worker thread (`media-runner.ts` / `media-worker.ts`) with a size-based
  timeout; main-thread stall dropped from ~650 ms to <10 ms for a 30-page scan.
- **Insights** (`src/lib/insights.ts`): `family-health:interpreter` (report) and
  `family-health:trend-interpreter` (trend). Payloads contain only age, sex, height,
  goals, results, findings, interventions. Deterministic alerts merged into 需尽快就医;
  causal-language check → one regeneration → sentence removal; disclaimer appended in code;
  cached by input hash + prompt version.
- **Actions**: list/add member, log/end intervention, log measurement, query, seed demo
  (public) + extract report, generate insight (explicit). Structured JSON errors with
  candidates/suggestions.
- **Skill** `family-health:log-from-chat`.
- **Dates** follow Rome's `guardianTimezone` setting (the daemon runs in UTC).
- **Demo seed**: 4 members, 17 confirmed reports, 650 results, 32 findings, 9
  interventions, 27 measurements; stable `demo-*` ids; no critical values.
- 尿酸 is now its own category.

## Decisions

- No demo seeding on install (AUTHORING has no install-time seeding guidance); seeding is
  explicit via action or the placeholder page.
- The seed contains no critical values; the red-flag banner can be demoed by adding a
  critical value while reviewing a report (verified live with 320 mg/dL glucose).
- Derived metrics are computed at read time instead of stored, so reviewer edits never
  leave stale derived rows.
- Host body limit: bodies up to 250 MB reached the handler on loopback, so the app's own
  60 MB per-file cap is the effective limit; no chunked upload needed.

## Validation

- 247 vitest tests; typecheck + build clean.
- Installed via app_management; live smoke tests of API, actions, uploads (PDF 3/30
  pages, HEIC), page serving, one live extraction, review edits, confirm, live report and
  trend interpretation.
