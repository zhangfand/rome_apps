# Handoff: Conductor web UI redesign

## Overview

A redesign of the Conductor app's web surface (`conductor/src/web/**` in `zhangfand/rome_apps`). Conductor is a long-running task runner whose workflow is a prompt: a person or a labeled GitHub issue opens a task, an orchestrator agent reads the task's append-only ledger plus an SOP and records one decision per wake.

The current UI is a flat list of tasks and a flat list of ledger facts. The redesign is organised around two goals the owner named:

1. **Monitoring many tasks at once** — who is running, who is stuck, who is waiting on a human.
2. **Making human intervention cheap** — reply, accept, cancel, right where the question is.

A third, editorial goal ran through the whole pass: **the UI does not expose ledger mechanics.** Words like *fact*, *wake*, *orchestrator*, *worker*, *Dispatched*, *Returned*, *Noted*, *Lost* are implementation vocabulary. The user sees a series of things that happened, in plain English. The mapping from fact kinds to UI labels is specified below and must be preserved.

## About the design files

`Conductor.dc.html` and `Conductor - Current UI.dc.html` in this bundle are **design references written in HTML** — prototypes of the intended look and behavior, not production code to copy. The task is to recreate them inside Conductor's real environment: React 19 + `@rome-os/app-web-sdk` + `@rome-os/ui` + Tailwind, in `conductor/src/web/`, using that kit's components (`Button`, `cn`, etc.) and the product's token layer rather than the inline styles used in the prototypes.

The prototypes run on the **Rome Design System (Orange / Ember)** stylesheet, whose semantic token names match the product's own (`--background`, `--surface`, `--primary`, `--border`, `--muted-foreground`, `--info-*`, `--success-*`, `--warning-*`, `--destructive-*`). In the codebase these are already available as Tailwind utilities (`bg-background`, `text-muted-foreground`, `border-border`, …) — see the mapping table.

## Fidelity

**High fidelity.** Final colors, type, spacing and interaction states. Recreate pixel-close using the kit's components. Two deliberate carve-outs:

- All content is **sample data** modeled on `conductor/README.md`'s canonical run. Real content comes from the API.
- The prototype's `boardState` switch (Live / Stressed / Quiet / Loading / Error / Not configured) is a **prototype device** for reviewing states, not a feature. In the real app these are derived from the API response.

## Files

| File | What it is |
|---|---|
| `Conductor.dc.html` | The redesign. Four screens: Board, Tasks, Task detail, SOP & runtime. |
| `Conductor - Current UI.dc.html` | Faithful recreation of today's UI, for before/after comparison. |

Both open directly in a browser. Screens switch through the in-page tab bar; the detail screen is reached by clicking any task row or a Board card's **Details** button.

---

## Screens

### 1. Board (new screen, default)

**Purpose.** Answer "does anything need me, and is anything moving?" in one glance.

**Layout.** Single column, `max-width: 1060px`, centred, `padding: 40px 44px 104px`. Three stacked sections, `gap: 48px`. Section = serif heading (Petrona 25px/500) + content, `gap: 18px`.

**Section 1 — "Needs you".** One card per task that is stopped until a person acts. Card: `background: --surface`, `1px solid --border`, **`border-left: 3px solid`** (ember `--primary` for a report, `--warning` for a question, `--destructive` for a tripped safety valve), `border-radius: 14px`, `box-shadow: --shadow-sm`, `padding: 24px 26px`, inner `gap: 18px`.

Card contents, in order:
- Row: status chip (mono 11px uppercase, `height: 24px`, `padding: 0 10px`, `radius: 6px`, tinted bg/fg per tone) · task title (18px/600, `-0.015em`) · project id (mono 12px `--subtle-foreground`) · age right-aligned (mono 12px `--muted-foreground`).
- The question or report text itself: 15px/1.6, `max-width: 78ch`, clamped to **4 lines** with a `show all` / `show less` toggle (mono 12px underlined) when longer than ~320 chars.
- Action row, `gap: 8px`: **primary** `Answer` (question) / `Reply` (report) → toggles the inline composer; **secondary** `Mark complete` (report) / `Cancel task` (question); **ghost** `Details` → task detail.
- Inline composer (only when open): `border-top: 1px solid --border`, `padding-top: 18px`; a row of mono 12px quick-reply chips that fill the textarea; textarea `min-height: 96px`, `1px solid --input`, `radius: 8px`, `padding: 12px 14px`, 14px/1.55; primary `Send reply`.

Empty state: `Quiet. Nothing is waiting on you.` (15px, `--muted-foreground`).

**Section 2 — "Running".** One hairline-divided row per live worker inside a `--surface` card (`radius: 14px`, rows `padding: 20px 22px`, `border-top: 1px solid --border-subtle`): task title (15.5px/500, underline on hover, click → detail) · what it is doing right now, in plain words (mono 11px `--subtle-foreground`) · elapsed time right-aligned (mono 11.5px), **counting up every second**. Sub-label next to the heading: `2 of 3 at once`. Empty: `No worker is running.`

**Section 3 — "Resting".** Same row treatment, `padding: 18px 22px`: title · why it is waiting (13.5px `--muted-foreground`) · `continues in 9m` (mono 11px). Empty: `Nothing is on a timer.`

**Deliberately absent from the Board** (all were tried and cut as noise or duplication): task id hashes, worker id hashes, heartbeat age, worker-slot meter, agent names, the `N / 25 decisions` safety-valve counter, tick countdown, `Tick now`, the app tagline, and any "waiting on you" label (the section heading says it).

**Live-updating cues** — no spinners, no "last updated" text:
- elapsed timers tick every second (`setInterval`, 1s);
- rows that changed since the last poll carry a 2px ember bar on their left edge that fades out over 60s (`@keyframes afterglow{0%{opacity:1}100%{opacity:0}}`, `--ease-classical`, `forwards`).

### 2. Tasks

**Purpose.** The full list, filterable.

Segmented filter (`All / Needs you / Running / Resting / Closed`) with per-filter counts: track `--surface-muted`, `1px solid --border`, `radius: 9px`, `padding: 2px`; active segment lifts onto `--background` with `--shadow-xs`, `radius: 7px`, 12px/600.

Table inside a `--surface` card (`radius: 14px`): header row `background: --surface-muted`, `border-bottom: 1px solid --border`, mono 10px uppercase `0.1em` `--muted-foreground`. Grid `104px minmax(0,1fr) 96px 118px 66px`, `gap: 18px`, rows `padding: 16px 20px`, `border-bottom: 1px solid --border-subtle`, hover `--surface-muted`, whole row clickable.

Columns: **task** (mono 11.5px id — the one place the id is shown) · **brief · latest** (title 15px/500 + the latest thing that happened, 13px `--muted-foreground`, both single-line with ellipsis) · **project** (mono 11px) · **state** (tinted chip: `report / question / running / waiting / completed / cancelled`) · **age** (mono 11px, right).

Same afterglow bar as the Board on recently-changed rows. No status dot (the state chip already carries it), no row count (the filter chips carry it), no fact-kind prefix on the latest line (the state chip carries it).

### 3. Task detail

**Purpose.** Understand one task, and act on it.

- Back link: mono 11px ghost `← back to board`.
- **Header card** (`--surface`, `radius: 14px`, `--shadow-sm`, `padding: 26px`, `gap: 18px`):
  - state chip (`open`, `--info-bg` / `--info-fg`) · task title (Petrona 26px/32px/500) · task id (mono 11px).
  - meta row, mono 11px `--muted-foreground`, `gap: 14px`: `project · owner/repo`, `from github:<login> · issue #N`, `opened 29m ago`.
  - **"Where it stands"** callout — `--info-bg`, `1px solid --info-border`, `radius: 10px`, `padding: 16px 18px`: mono 10px uppercase eyebrow + one paragraph (15px/1.6, `max-width: 78ch`) that says what is true now and what is expected of the reader. This is the single most important element on the screen: it is what replaces reading the ledger.
  - Action row: primary `Reply` · secondary `Mark complete` · ghost `Cancel task`.
- **"What happened"** — serif 22px heading + `12 events` count; on the right a `hide routine steps` checkbox (accent `--primary`) and a three-way view switch (`Stream` / `Lanes` / `Table`, same segmented treatment as the Tasks filter). All three ship; **Stream is the default.**
  - **Stream** — grouped by the round of work it belonged to; group header is just the time (mono 10px uppercase) with a hairline rule. Each entry: `grid-template-columns: 96px minmax(0,1fr)`, card `radius: 12px`, `padding: 20px 22px`, `background: --surface` (routine steps drop to `--background`). Left gutter: `#seq · time` (mono 11px) and the author in plain words (mono 10.5px/600; `you` is `--info-fg`, `conductor` is `--foreground`, others `--muted-foreground`). Right: label chip + a title *only when the title carries payload*, then the body (13–14.5px/1.6, `max-width: 76ch`), then a `show detail` / `show instructions` toggle that reveals the long text in a sunken mono block (`--surface-muted`, `--inset-soft`, 11.5px/1.55).
  - **Lanes** — four columns: `you & github` · `conductor` · `workers` · `world`. One card per entry placed in its lane via `grid-column`, ordered vertically by sequence. Card: `radius: 10px`, `padding: 14px 15px`, seq + label chip + time, then one line of lead text.
  - **Table** — grid `44px 104px 132px minmax(0,1fr) 84px`, rows `padding: 13px 20px`, 12.5px; columns (unlabelled seq) · **what** (label chip) · **who** (plain author label — *not* the raw `by`) · **what it says** (single line, ellipsis) · **time** (mono 10.5px, right). Row click expands the long text.
- **Reply** composer at the bottom in its own `--surface` card: quick-reply chips + textarea (`min-height: 104px`) + primary `Send reply`.

### 4. SOP & runtime

Two columns, `minmax(0,1.55fr) minmax(260px,1fr)`, `gap: 18px`, `align-items: start`.

**Left — SOP editor.** Serif 22px heading `SOP · the workflow, as a prompt` + mono 11px `takes effect on every open task`. Editor card (`--surface`, `radius: 14px`): a toolbar strip (`--surface-muted`, `border-bottom: 1px solid --border`, `padding: 10px 20px`) showing `global sop · markdown · N chars` — **computed live from the textarea value** — and, on the right, `unsaved changes` in `--warning-fg` when dirty. Textarea: borderless, `background: --surface`, mono 12px/1.65, `min-height: 420px`, `padding: 12px 14px`. Below: primary `Save SOP`, secondary `Revert to built-in`, and `Saved.` after a successful save.

**Right rail.** Three cards: **Projects** (id + `own SOP` chip when the project overrides the SOP + intake on/off dot + working dir + repo/label line, all mono 11px), **Runtime** (label · dotted leader · value rows; `Change these with conductor:setup.`), **Worker agents** (agent id mono + one plain sentence about what it does).

---

## Copy rules (load-bearing)

The fact kinds from `src/lib/facts.ts` must be presented as plain labels. Chip label map:

| fact kind | UI label | tone |
|---|---|---|
| `Created` | request | `--accent-wash` / `--info-fg` |
| `Reply` | reply | `--accent-wash` / `--info-fg` |
| `Dispatched` | started work | `--surface-muted` / `--muted-foreground` |
| `Opened` | session (routine; hidden by default) | `--surface-muted` / `--subtle-foreground` |
| `Returned` | came back | neutral; **status** re-tones it: `succeeded` → success, `waiting` → warning, `failed`/`blocked` → destructive |
| `Waited` | waiting | `--surface-muted` / `--muted-foreground` |
| `Asked` | question | `--warning-bg` / `--warning-fg` |
| `Reported` | report | `color-mix(in srgb, --primary 14%, transparent)` / `--primary-hover` |
| `Completed` | done | `--success-bg` / `--success-fg` |
| `Cancelled` | cancelled | `--surface-muted` / `--subtle-foreground` |
| `Failed` / `Lost` | failed / lost | `--destructive-bg` / `--destructive-fg` |
| `Event` | github | `--info-bg` / `--info-fg` |

Author map (`by` → label): `orchestrator` → **conductor**; `w-xxxxxxxx` → **worker**; `github:<login>` → **github**; the guardian's own name → **you**; `runtime` on an Event → **github**.

Titles: when `factBody().title` only restates the kind (`Request`, `Reply`, `Report`, `Question`, `Note`) **render the body alone** — the chip already says it. Keep the title where it carries payload (`succeeded · PR #21 at fc621e0`, `Waiting until 09:41:25`, `w-4f81ac20 as coding:coding`). Event titles are rewritten as sentences (`A second PR appeared`, `You commented on PR #21`), never raw webhook names.

Never shown to the user: *fact*, *ledger*, *wake*, *orchestrator*, *append-only*, *seenSeq*, *circuit_breaker* (say "I stopped picking this up"), *worktree*.

Tone follows the Rome content rules: sentence case, plain, past tense for confirmations (`Saved.`), errors with a next step and no blame, no emoji.

---

## Interactions & behavior

- **Navigation.** Tabs (`Board` / `Tasks` / `SOP & runtime`) + task rows / `Details` → detail. In the real app keep the existing routing: `getCurrentAppPath()` / `navigateToApp()` / `subscribeToAppPath()`, routes `/` → board, `/tasks` → list, `/config`, `/<taskId>` → detail. The Board is the new default for `/`.
- **Polling.** Keep the current model: `GET state` every 10s when `!document.hidden` and on window focus; detail `GET tasks/:id` every 8s. Add a 1s local timer for elapsed counters only.
- **Afterglow.** Diff the incoming task list against the previous one (`updatedAt` / `factCount`); mark changed ids fresh and mount the fading edge for 60s.
- **Reply.** `POST tasks/:id/reply` with `{ text }` → on 200 clear the draft and reload. Disable while empty or sending; show the returned `error` string inline.
- **Clamp.** Report/question text over ~320 chars clamps to 4 lines (`-webkit-line-clamp`) with a per-card expand toggle.
- **Hover / press / focus.** Hover moves one tonal step (`--surface-hover`), never opacity; press adds 1px `translateY`; focus is a continuous `--ring` edge (1px border recolor + 1px `outline` at `outline-offset: 0`). Transitions `--dur-fast` (120ms) with `--ease-classical`.
- **Board states.** `configured === false` → the "Nothing to conduct yet." empty screen with the `conductor:setup` snippet. Fetch in flight with no data → mono typewriter ellipsis `reading this app's history...` (three dots pulsing on 200ms offsets; no spinner). Fetch error / `ledger unreachable` (503) → destructive card: `I couldn't read this app's history.` + one plain sentence + `Try again`.
- **Reduced motion.** Gate the pulse and afterglow on `prefers-reduced-motion`.

## State

Per screen: `path`, `state: StateJson | null`, `error`, `now` (1s tick), `freshIds: Set<string>` with mount timestamps, per-card `replyOpen` / `draft` / `expanded`, detail `task: TaskDetailJson | null`, `reply`, `sending`, `openEntries` (which long texts are expanded), `ledgerView` (`Stream` default, persist per user), `hideRoutine` (default **true**), config page `sop` / `saving` / `saved`.

Bucketing (derive on the client from the existing `TaskSummary`):

- **needs you** — latest decision is `Asked` or `Reported`, or a `circuit_breaker` Event is the latest fact; i.e. `state === "open" && !liveWorker && !waiting` with an orchestrator fact that expects a person.
- **running** — `liveWorker` present.
- **resting** — `waiting` present, or open with nothing pending.
- **closed** — `state !== "open"`.

## API

Existing and sufficient for read + reply: `GET state`, `GET tasks/:id`, `POST tasks/:id/reply`, `GET|PATCH config`, `POST tick` (`conductor/src/api/index.ts`).

**Two routes are missing** for the actions the design exposes:

- `POST tasks/:id/complete` → `conductor:complete` (person's `Completed` fact) — backs `Mark complete`.
- `POST tasks/:id/cancel` → `conductor:cancel` (person's `Cancelled` fact) — backs `Cancel task`.

Both actions already exist (`src/actions/complete`, `src/actions/cancel`); they just have no HTTP surface. Guard them like `reply` (`request.caller.kind !== "guardian"` → 403) and have them return the refreshed task so the UI can re-render without a second fetch.

Earlier drafts of this design also had `Stop worker` and a per-task "pick it up now" button. **They were cut** precisely because `stop` is an orchestrator tool and there is no per-task wake endpoint — do not reintroduce them without backing actions.

## Design tokens

From `colors_and_type.css` (Ember, light). Product equivalents live in `packages/web`'s `primitives.css` / `themes.ts`; prefer the Tailwind utilities the kit already exposes.

| Role | Token | Light value |
|---|---|---|
| canvas | `--background` | `#f4f3ef` |
| card | `--surface` | `#fdfcf9` |
| sunken / header strip | `--surface-muted` | `#efe9e1` |
| hover | `--surface-hover` | `#eae6df` |
| hairline | `--border` | `#ece6de` |
| strong border | `--border-strong` | `#e0d8cd` |
| divider inside cards | `--border-subtle` | `#efe9e1` |
| ink | `--foreground` | `#1a130f` |
| secondary ink | `--muted-foreground` | `#8a7868` |
| faint ink | `--subtle-foreground` | `#b0a294` |
| primary fill | `--primary` / `--primary-hover` | `#d86f4c` / `#c2410c` |
| indicator / ring | `--ring` | `#e55a22` |
| info chip | `--info-bg` / `--info-fg` / `--info-border` | `#ffead9` / `#c2410c` / `#fbcda6` |
| success chip | `--success-bg` / `--success-fg` | `#e4ead5` / `#44603a` |
| warning chip | `--warning-bg` / `--warning-fg` | `#fdf6e3`-ish `--amber-50` / `--amber-500` |
| destructive chip | `--destructive-bg` / `--destructive-fg` / `--destructive-border` | `--red-50` / `--red-500` / `--red-200` |

Type: UI **Funnel Sans** (`--font-sans`); display **Petrona** (`--font-serif`) for the section headings and the task title; **IBM Plex Mono** (`--font-mono`) for ids, times, eyebrows, code, chips. Sizes used: 26/25/22 serif · 18 / 15.5 / 15 / 14.5 / 13.5 / 13 sans · 12 / 11.5 / 11 / 10.5 / 10 mono. Body line-height 1.6; nothing below 10px, and no body copy in mono.

Radii: chips/inputs 6–8px · buttons 8px (`--control-r-sm`) · cards 14px · never mixed at one level. Control heights: 26px chips, 34px buttons (`--control-h-*` in the real kit: sm 28 / md 36). Spacing: 4px base — 6 / 8 / 10 / 11 / 14 / 18 / 20 / 22 / 26 / 48. Shadows: `--shadow-xs` on lifted segments, `--shadow-sm` on cards, `--inset-soft` on sunken mono blocks. Motion: `--dur-fast` 120ms / `--dur-base` 200ms, `--ease-classical`; fade + 4px slide on entrance, fade only on exit; no spring, no bounce.

## Assets

None new. Icons, if added, are **Lucide** at stroke 1.75 (sizes 14/16/20/24), `currentColor` — the design ships without icons on purpose. `conductor/src/assets/icon.svg` stays the app icon; Rome's CRT glyph is a brand mark, not an interface icon.

## Source

Built from `zhangfand/rome_apps`, branch `main`, subtree `conductor/` — README, `app.yaml`, `src/api/index.ts`, `src/lib/{sop,facts,fold}.ts`, `src/web/**`. See `github.md` at the project root for the screen → source-file map.
