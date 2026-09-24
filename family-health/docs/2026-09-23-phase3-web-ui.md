# 2026-09-23 · Phase 3 web UI

## What changed

- Full Chinese web UI with deep-linkable routes (SDK `getCurrentAppPath` / `navigateToApp`;
  real anchors, browser back works): `/`, `members/:id[/tab/:panel|all]`,
  `members/:id/indicators/:code`, `reports[/member/:id]`, `reports/:id`, `upload[/:memberId]`,
  `interventions[/:memberId]`.
- Views: 家庭总览 cards (red flags, top changes coloured by direction, intervention chips,
  empty state with 加载演示数据, 清空演示数据 confirm); 成员页 (goal-panel tabs + 全部指标 with
  search/collapsible categories, sparklines, 计算值 markers, findings timeline, edit/delete);
  指标详情 (time-axis chart with reference band, abnormal points, measurement diamonds,
  intervention spans with stacked labels, AI trend interpretation, raw table); 报告列表;
  上传 (sequential one-file-per-request, per-file status, client-side type/size checks);
  报告详情/审核 (page viewer with blob-loaded images, zoom, thumbnails; inline edits; mapping
  combobox; findings editor; confirm gating; confirmed view with grouped results, red-flag
  banner, structured AI interpretation, 重新编辑, delete); 干预记录.
- Backend: `POST reports/:id/reopen`; `direction`, per-point `flag` and printed `bandText`
  in read models; report interpretations now pass through the causal-language guard too.
- Charts resolve Rome theme tokens at runtime (`lib/theme.tsx`) and re-read them when the
  host toggles `dark` on the shadow root body / `:root` theme.
- `lib/shadow-id-shim.ts`: Radix Dialog checks its title with `document.getElementById`,
  which cannot see Shadow DOM, so every kit dialog logged an error; the app falls back to
  its shadow root for `radix-*` ids while mounted.
- Added `sonner` (kit Toaster) and `cmdk` (kit Command) optional peers.

## Validation

- 254 vitest tests (incl. web helpers: niceScale, formatting, route parsing, report
  causal guard); typecheck + build clean.
- CDP browser pass: 10 routes × light/dark × 1440/390 = 40 screenshots, zero console
  errors/warnings, no horizontal overflow; interaction checks (deep links, tabs, back,
  search, dialogs, combobox, row→page jump, blob page images, confirm dialogs) pass.

## Known gaps

- Upload progress is per-file status, not byte-level percent (fetchAppApi has no progress).
- Native date inputs follow the browser locale (mm/dd/yyyy in this Chrome).
- Main JS bundle ~890 KB (recharts); acceptable locally, could be code-split later.
