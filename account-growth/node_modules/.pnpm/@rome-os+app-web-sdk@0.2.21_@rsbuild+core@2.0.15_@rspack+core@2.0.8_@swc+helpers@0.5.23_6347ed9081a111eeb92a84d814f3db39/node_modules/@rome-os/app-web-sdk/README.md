# @rome-os/app-web-sdk

Runtime SDK for a Rome app's web UI bundle: the app bootstrap (`getBootstrap`),
the host API client (`fetchAppApi`), mount/portal helpers, and the theming
contract below. The package also ships the `rome` CLI — see
[CLI](#cli-rome) at the bottom.

## Starting chats

Apps can use `startChat` to create a webchat session, seed its first turn, and
navigate the host to the new chat. Pass `projectPath` to start the session inside
a specific webchat project:

```ts
import { startChat } from "@rome-os/app-web-sdk";

await startChat({
  message: "Help me plan this project.",
  projectPath: "demo/nested",
});
```

A Rome app mounts inside the host's Shadow DOM and inherits the host's semantic
design tokens, so a UI built only from the registered utilities follows the
active theme — light/dark and the host's named themes — automatically, with no
`dark:` variants and no hardcoded colors.

## Design token reference

The canonical vocabulary an app may paint with — every Tailwind color/font
utility the host theme supports — is the `@theme inline` block in
`@rome-os/ui/styles.css` (the design-system canon, which
[`src/runtime/styles.css`](src/runtime/styles.css) imports). **That file is the
reference:** each token carries an inline comment with its semantic role and
when to reach for it (`primary` vs `accent`, the `background`/`surface`
figure-ground split, the status `-bg`/`-fg`/`-border` triads). Anything
not registered there — raw shades (`bg-gray-100`), raw scrims (`bg-black/40`),
arbitrary colors — is a regression.

Your app's `src/web/styles.css` should be a single import of this layer, plus
any app-specific rules below it:

```css
@import "@rome-os/app-web-sdk/styles";
@import "@rome-os/ui/styles.css";

/* app-specific rules here; override a host token with a `:root` block */
```

The first line pulls in Tailwind and the full token vocabulary — don't copy the
`@theme inline` block into your app (it drifts the moment a token changes here).

The second line is **not** redundant. This sheet imports the canon through the
SDK's own copy of `@rome-os/ui`, while `@rome-os/ui/button` in your components
resolves *your* copy. Upgrade the kit across a `0.x` minor and those become two
installs — Tailwind then scans the old copy's `@source` files while the bundle
ships the new components, so their classes silently disappear from the CSS and
the build still passes. Importing the canon from the app keeps the version that
supplies the components as the one that supplies their styles; when both resolve
to the same install it costs nothing.

Token families, at a glance:

| Family                       | What it covers                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Surface**                  | Figure-ground: `background` canvas, `surface`/`card` raised fills, `surface-elevated`/`popover`, insets, hovers.              |
| **Foreground**               | Text emphasis tiers: `foreground`, `muted-foreground`, `subtle-foreground`, plus the neutral `muted` fill.                    |
| **Primary / Brand / Accent** | `primary` (CTA fill and, via alpha, the highlight), `brand` (legacy alias of `primary` — don't use in new code), `accent` (shadcn neutral hover), `secondary`. |
| **Status**                   | `destructive` / `success` / `warning` / `info` — each with a solid fill, `-foreground`, and soft `-bg`/`-fg`/`-border` parts. |
| **Border, ring & input**     | `border` (+ `-strong`/`-subtle`), `ring`, `input`, and the `overlay` scrim.                                                   |
| **Radius**                   | `rounded-sm/md/lg/xl`, calculated from the kit's constant `--radius`.                                                         |
| **Font**                     | `font-sans` (UI default), `font-mono` (code), `font-serif` (display headings).                                                |

A `-foreground` token is the text/icon color that sits **on** its base fill
(`bg-primary` pairs with `text-primary-foreground`). See `@rome-os/ui`'s
`src/styles.css` for the per-token detail.

## Components

This SDK ships the app *runtime*, not components. The primitives live in
[`@rome-os/ui`](https://www.npmjs.com/package/@rome-os/ui) — the same kit the
Rome dashboard is built from, and a dependency of the app scaffold:

```tsx
import { Button } from "@rome-os/ui/button";
```

Import them; do not copy them into `src/web/components/ui/`. A copy is frozen at
the moment it was made, while an imported component takes fixes with
`pnpm up @rome-os/ui`. Copy a shadcn recipe only for a primitive the kit does
not publish, and then re-wire its geometry to the kit control scale
(`--control-*` / `--field-*`) and pass this SDK's `getPortalContainer()` to its
`Portal`, so the layer renders inside the app's shadow root instead of
`document.body` (where the app's styles do not reach).

Kit components that float (dialog, popover, dropdown menu, context menu, select,
sheet, tooltip) resolve that container themselves, so they need no wiring —
`getPortalContainer()` is for app-authored ones.

## CLI (`rome`)

The package's `bin` is the `rome` CLI. Inside a scaffolded Rome app it is on
your `PATH` via `node_modules/.bin`; outside an app run it ad hoc with
`npx -p @rome-os/app-web-sdk rome --help`. Requires **Node.js 24+**.

```text
Develop:
  rome dev        Start the dev server with HMR
  rome build      Build the app web bundle for production
  rome upgrade    Bump app.yaml version by major, minor, or patch

Rome App Store:
  rome login      Log in to the Rome App Store and store credentials
  rome whoami     Show the currently logged-in account
  rome publish    Package a Rome app directory and upload it
```

Run `rome <command> --help` for command-specific options. `rome dev` and
`rome build` read `app.yaml` (`web.displayName`, `web.navLabel`, `web.entry`)
and emit `dist/` with `manifest.json` + assets.

### Bump the app version

Use `rome upgrade <major|minor|patch>` inside an app directory to update
`app.yaml#version` before publishing:

```bash
rome upgrade patch
rome upgrade minor ./my-app
```

### Authenticate

There are two ways to give the CLI store credentials, in order of preference:

1. **`ROME_TOKEN` env var (recommended for CI and long-lived workflows).**
   Generate a token in the store dashboard under **Settings → CLI / API
   token**, copy it once, and export it:

   ```bash
   export ROME_TOKEN=rome_…
   # optionally pin a host (otherwise ROME_STORE_HOST or the default is used)
   export ROME_STORE_HOST=https://romeos.cc
   rome publish ./my-app
   ```

   The token never expires, can be reset at any time from the dashboard, and is
   **store-API-only** — it cannot be used to log into the dashboard.

2. **`rome login` (interactive shells).** Mints a 24-hour session token via
   email + password and stores it in `~/.rome/store-token.json` (mode `0600`):

   ```bash
   rome login
   # or non-interactively
   rome login --email you@example.com --password-stdin <<<"$PW"
   ```

If both are present, `ROME_TOKEN` wins. Override the host with `--host <url>`
or the `ROME_STORE_HOST` env var (default: `https://romeos.cc`).

### Publish an app

The target directory must contain an `app.yaml` with `id` and `version`. For
release publishes, prefer passing the packed artifact a source-mode install
writes (`pnpm app:install --source ./my-app` builds + packs into
`./my-app/.rome/artifact`):

```bash
rome publish ./my-app/.rome/artifact
rome publish ./my-app/.rome/artifact --dry-run --out my-app.romeapp
rome publish ./my-app/.rome/artifact --exclude .env
```

The CLI builds a deterministic gzipped tarball (no mtimes), prints its
`sha256`, and uploads it to the store. With `--dry-run` it stops after
computing the hash.

`node_modules`, `.git`, and `.DS_Store` are excluded from the installable app
bundle by default; `.rome_store` is always excluded from the bundle. When
`<app>/.rome_store/rome_store.yaml` exists, `rome publish <app>/.rome/artifact`
uploads `.rome_store` as a separate store sidecar for listing images/videos.
Sidecar files update the public store listing only; they are not installed with
the app bundle at runtime.
Add more bundle excludes with
`--exclude <name>` (repeatable); each pattern matches any path segment by exact
name, so `--exclude dist` skips a top-level `dist/` and any nested `dist/` too.
Pass `--no-default-exclude` to opt out of the built-in bundle defaults.

When `app.yaml` sets `includeSource: true`, publish includes the root `src/`
directory in the same bundle and hash. New Rome app templates enable this by
default. Set `includeSource: false` to omit source. `.rome/` and `.rome_store/`
never enter the app bundle.

### Configuration

| Source                     | Field              | Notes                                                                    |
| -------------------------- | ------------------ | ------------------------------------------------------------------------ |
| `ROME_TOKEN` env var       | bearer token       | Long-lived API token minted in the dashboard. Wins over the JSON config. |
| `--host <url>`             | host               | Per-invocation override.                                                 |
| `ROME_STORE_HOST` env var  | host               | Used when no flag is passed and no config is stored.                     |
| `~/.rome/store-token.json` | host, email, token | Written by `rome login`. File is mode `0600`.                            |
