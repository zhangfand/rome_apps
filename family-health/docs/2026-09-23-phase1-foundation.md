# 2026-09-23 · Phase 1 foundation

## What changed

- Manifest: formatVersion 2, id `family-health`, name/displayName/navLabel
  `家庭体检助手`, agent-facing description, tagline `全家体检报告自动整理，指标趋势一目了然`,
  DB enabled with `tablePrefix: family_health`. Scaffold demo action/agent/repo removed;
  API reduced to a `GET status` probe until Phase 2.
- DB (`src/db/schema.ts`, migration `0000_init`): `members`, `reports`, `indicator_defs`,
  `results`, `findings`, `interventions`, `measurements`, `insights`. `is_demo` on
  members and reports so demo data can be wiped cleanly. No SQL foreign keys (shared
  system SQLite); repositories cascade deletes explicitly.
- `indicator_defs` is synced from the TS dictionary by an idempotent upsert
  (`syncIndicatorDefs`) instead of a data migration, so the dictionary has one source
  of truth.
- Pure domain library `src/domain/` (no I/O):
  - `indicators.ts` — 157 indicators in 15 categories (aliases, canonical unit,
    conversions, sex-specific default ranges, direction, plain-language 解释).
  - `mapping.ts` — alias lookup over normalized keys, with section/unit/value
    disambiguation for shared aliases (GLU, WBC, 中性粒细胞 …).
  - `units.ts`, `values.ts`, `refRange.ts`, `flags.ts`, `normalize.ts` — unit folding
    and conversion (incl. affine HbA1c), value parsing (↑↓/H/L/*, censored, qualitative
    grades), range parsing (intervals, one-sided, qualitative, 男/女), flag precedence.
  - `derived.ts` — eGFR (CKD-EPI 2021, race-free), HOMA-IR, non-HDL, GLB, A/G, BMI, WHR,
    IBIL, fPSA/tPSA, PGI/PGII.
  - `critical.ts` — deterministic urgent/soon thresholds + imaging red flags.
  - `findings.ts` — 27 normalized finding keys, negation-aware detection, severity parsing.
  - `members.ts` — 我/老婆/爸爸/… resolution with candidates on ambiguity.
  - `panels.ts` — the four goal panels.
- Media (`src/lib/media.ts`, `src/lib/storage.ts`): magic-byte type sniffing,
  HEIC→JPEG via `heic-convert`, PDF/image rasterization via `mupdf` (WASM) to JPEG with a
  1600px long edge (never upscaling, EXIF orientation applied), stored under
  `~/.rome/<profile>/apps/data/family-health/reports/<id>/`.

## Decisions

- PDF rasterization uses the `mupdf` npm package (WASM, AGPL-3.0). pdfjs-dist would need
  a native canvas in Node. No system binaries are required.
- Page images are JPEG q85 (~100 KB per scanned page) rather than PNG (~1.2 MB).
- Page rendering is an async generator that yields between pages because mupdf renders
  synchronously in the daemon process.

## Validation

- `pnpm test`: 192 tests (domain, DB migrations + dictionary sync on real SQLite via
  `node:sqlite`, media pipeline).
- `pnpm typecheck` (app + tests) and `pnpm build` clean.
- `node scripts/media-smoke.mjs` against the built `dist/` (same `import()` path the
  daemon uses): 12-page PDF 1.7 s, HEIC photo 1.4 s.

## Follow-ups (Phase 2)

- Consider moving rendering into a `worker_threads` worker if per-page stalls
  (≤~0.65 s on scans) prove noticeable.
- Call `syncIndicatorDefs` once per process before the first read.
- Store listing copy (README / .rome_store) and web UI are still scaffold placeholders.
