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
user. `safeText()` in `src/web/lib/facts.ts` rewrites them; it is the reason
that function exists, and why it is applied to every payload string rather than
at the few call sites that seemed to need it.

A stored fact kind is likewise never a label. `factLabel()` maps kinds to plain
words (`Dispatched` → "started work", `Returned` → "came back"), `authorLabel()`
maps identities to roles (`orchestrator` → "conductor", `w-…` → "worker"), and
`bucketTask()` derives the four user-facing groups. **All three maps are pinned
by `src/web/lib/facts.test.ts`** — change a label there and the test tells you.

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

Routes `/` → board, `/tasks` → list, `/config`, `/<taskId>` → detail, driven by
`getCurrentAppPath()` / `navigateToApp()` / `subscribeToAppPath()`. Board polls
`GET state` every 10s while `!document.hidden`; detail polls `GET tasks/:id`
every 8s; a 1s timer drives elapsed counters only. Changed task ids are marked
fresh and show the fading edge for 60s. Attention text over ~320 characters
clamps to four lines with a per-card expand toggle. The afterglow and pulse are
gated on `prefers-reduced-motion`.

## Design system

There is one: `@rome-os/ui`. The app carries no second palette — tone reaches a
chip through `TONE_BADGE`, which names kit `Badge` variants. Reach for a kit
component before writing a panel, chip, table or empty state by hand.
