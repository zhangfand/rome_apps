# Conductor web UI: what still binds

The original handoff (`docs/handoff/`) specified a pixel-close recreation of an
HTML prototype, down to card radii, chip metrics and a private colour table. The
UI now composes `@rome-os/ui` and takes that kit's defaults, so the visual half
of that document described a design the code no longer has, and it was deleted.

What follows is the part that outlived it: decisions still in force that are not
obvious from reading the components.

## The UI does not expose ledger mechanics

*fact*, *ledger*, *wake*, *orchestrator*, *append-only*, *seenSeq*,
*circuit_breaker*, *worktree* are implementation vocabulary and never reach the
user. `safeText()` in `src/web/core/lib/facts.ts` rewrites them; it is the reason
that function exists, and why it is applied to every payload string rather than
at the few call sites that seemed to need it.


Domain vocabulary is allowed in `src/web/domain/`; `src/web/core/` stays reusable.
Server/app/domain code derives domain fields such as a GitHub repository and
passes generic presentation data to the core UI. `safeText()` is narrower: it
hides ledger mechanics only, not domain words that belong in a domain view.

A stored fact kind is likewise never a label. `factLabel()` maps kinds to plain
words (`Dispatched` → "started work", `Returned` → "came back"), `authorLabel()`
maps identities to roles (`orchestrator` → "conductor", `w-…` → "worker"), and
`bucketTask()` derives the four user-facing groups. **All three maps are pinned
by `src/web/core/lib/facts.test.ts`** — change a label there and the test tells you.

One rule lives only here: when `factBody().title` merely restates the kind
("Request", "Reply", "Report"), render the body alone, because the chip beside
it already says that word. Keep the title when it carries payload
(`succeeded · PR #21 at fc621e0`, `Waiting until 09:41:25`).

## Deliberately absent

`Stop worker` and a per-task "pick it up now" button were both designed and then
**cut**: `stop` is an orchestrator tool, and there is no per-task wake endpoint.
Do not reintroduce either without first adding a backing action — the buttons
are not missing by oversight.

## Behaviour constants

Routes `/` → board, `/tasks` → list, `/runtime` → runtime, `/<taskId>` →
detail, driven by `getCurrentAppPath()` / `navigateToApp()` /
`subscribeToAppPath()`. `/config` and `/config/projects/<id>` are deep links
that open the Settings dialog over the board (on the overview and on that
project's view respectively); closing the dialog navigates to `/`. The
`/config` and `/runtime` prefixes are parsed before the task-id fallback, so a
project id never reads as a task id. Board polls
`GET state` every 10s while `!document.hidden`; detail polls `GET tasks/:id`
every 8s; a 1s timer drives elapsed counters only. Changed task ids are marked
fresh and show the fading edge for 60s. Attention text over ~320 characters
clamps to four lines with a per-card expand toggle. The afterglow and pulse are
gated on `prefers-reduced-motion`.

## Settings and Runtime

**Settings** (`/config`) holds what the guardian changes; **Runtime**
(`/runtime`) holds what the loop is doing and the limits it runs under
(coordinator, max workers, tick interval, session reuse, decisions per turn,
heartbeat lease — read-only, set with `conductor:setup`), plus the worker
agents and the live workers from the same state feed the board polls.

**Settings** is one `lg` `Dialog` opened from a gear `IconButton` beside the
Conductor title. It is a modal task, not a place, so it has no inner routes: an
in-dialog view stack moves between an **overview** view and pushed **project**,
**sop**, and **add** views, with a back affordance in the header. Only the
active view renders, so returning to the overview re-mounts and re-fetches.
`/config` and `/config/projects/<id>` are deep links that open the dialog over
the board — on the overview and on that project's view — and Escape, a backdrop
click, or the close button all navigate to `/`.

The overview lists projects as a kit `List` of rows — id (with a `default`
badge), repository, intake label, and a workspace-status dot with a title
tooltip — each row pushing that project's view. **Add project** pushes a small
view asking only for an id and a working directory; on create it replaces
itself with the new project's view. The global SOP is one row under **Operating
procedure** ("Built-in" or "Custom" · length) whose **Edit** pushes the SOP
editor view (explicit Save / Cancel, and Revert to built-in for a custom SOP);
`runtime.sopBuiltIn` in the config response says which it is, and backing out of
the editor with unsaved edits raises a nested `sm` discard-confirm dialog.

The project view has no Save or Cancel buttons: every change autosaves. Toggles
and selects save immediately; text fields save on blur or ~600ms after typing
stops, and a pending debounced save is flushed when the view unmounts or the
dialog closes. A sequenced controller (`createSaveQueue` in
`src/web/core/lib/configuration.ts`) keeps at most one PATCH in flight and
coalesces to the latest pending value, so an older value can never land after a
newer one. Its status reaches the dialog header via a `reportStatus` callback
(`aria-live` polite, before the close button) as one of three strings from
`saveStatusText`: `Saving…` while a PATCH is in flight, `All changes saved` when
idle, and `Couldn't save — <reason>` on failure (the typed value is kept). The
working-directory muted-mono line and the `default` badge render at the top of
the project body, since `reportStatus` carries only the status string.

Sections run, top to bottom: **General** (working directory, workspace kind,
default project), **GitHub issue intake**, **Operating procedure** (the SOP
override, empty to inherit the global SOP), and a **Danger zone** that removes the
project behind a confirmation and returns to the overview. The GitHub section is
not core: it is a web-domain slot (`webDomain().projectSettingsFields`), so
`src/web/core/` mentions no git or GitHub. The slot renders a whole `Section` —
its own heading, the repo-status line with a refresh and a **Clone here**
action, and its rows — and writes through the same autosave controller via the
`patch` callback.

## Design system

There is one: `@rome-os/ui`. The app carries no second palette — tone reaches a
chip through `TONE_BADGE`, which names kit `Badge` variants. Reach for a kit
component before writing a panel, chip, table or empty state by hand.
