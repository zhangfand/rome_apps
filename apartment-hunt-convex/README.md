# Apartment Hunt (Convex)

Clone of the Apartment Hunt app with one deliberate change: **all storage lives
in a Convex Cloud deployment instead of the Rome app SQLite DB.** It exists to
evaluate Convex as a storage layer for Rome apps.

Everything else is identical to the original: paste a shared Google Maps list
link, every saved place is imported and auto-researched (Maps link, ratings,
ApartmentRatings score, rents and promotions), and you track your hunt in the
web UI.

## Architecture

- `convex/` — Convex schema + functions (queries/mutations for `apartments`,
  `imports`, `settings`). Deployed with `npx convex dev` / `npx convex deploy`.
- `src/lib/store.ts` — Convex-backed repository. Same interface as the
  original SQLite repository, but async, talking to the deployment via
  `ConvexHttpClient`. Function refs are built by name
  (`makeFunctionReference`), so the Rome build does not depend on Convex
  codegen output.
- `src/lib/deployment.ts` — deployment URL + shared secret, baked at build
  time, overridable via `APARTMENT_HUNT_CONVEX_URL` / `APARTMENT_HUNT_CONVEX_TOKEN`.
- There is **no `db:` section in `app.yaml`** — the app owns no SQLite tables.

### Differences vs. the SQLite original

| | Original | This clone |
|---|---|---|
| Storage | app SQLite tables (Drizzle, migrations) | Convex Cloud tables (schema.ts, push on deploy) |
| Repository | sync (better-sqlite3) | async (HTTP to Convex) |
| Row ids | 8-char random | Convex `_id` |
| Timestamps | `Date` (ISO strings over API) | epoch millis (numbers over API) |
| Access control | in-process only | public functions guarded by `APP_TOKEN` shared secret (`npx convex env set APP_TOKEN …`) |

Rome remains the orchestrator: actions, agents, the recurring sweep routine,
and the guardian-only API surface are unchanged — only reads/writes moved.

## Convex ops

```bash
npx convex dev --once   # push schema + functions to the dev deployment
npx convex deploy       # push to prod deployment
npx convex env set APP_TOKEN <secret>   # enable the shared-secret guard
npx convex dashboard    # open the data browser
```

## Live UI (reads via WebSocket)

The browser subscribes to Convex queries directly (`ConvexClient.onUpdate`),
so agent research results push into the UI instantly — no polling. Auth:

1. UI calls `GET /session` on the Rome app API (guardian-only), which mints a
   64-char random token and registers it via the `sessions:issue` mutation
   (APP_TOKEN-guarded — only Rome can mint).
2. Queries accept `APP_TOKEN | valid session token` (`assertReadAccess`);
   mutations remain APP_TOKEN-only, so browser tokens are strictly read-only.
3. Sessions live 1h; the UI renews ~5 min early and falls back to REST
   polling if the live session drops. A native Convex cron prunes expired
   sessions hourly (`convex/crons.ts`).

Writes stay on the Rome API on purpose: POST /apartments and /imports also
dispatch Rome actions (sweep, importer agent), which Convex mutations can't do.

## Possible next steps

- Production-grade browser auth: Convex Custom JWT (Rome-issued RS256 +
  public JWKS route) instead of the sessions table.
- Convex components (https://www.convex.dev/components): `rate-limiter` for
  research dispatch, `workpool` if the research pipeline itself moved into
  Convex actions, `migrations` for schema evolution.
