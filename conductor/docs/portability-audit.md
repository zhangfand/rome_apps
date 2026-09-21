# Portability audit: what in the runtime is still software-development-specific

Date: 2026-09-11. No code was changed for this audit.
Updated 2026-09-14: proposals 2 and 1 are done — see "Status" at the end.

The core loop — ledger, fold, decisions with `seenSeq`, `tick` / `orchestrate`,
worker heartbeats, the semi-structured worker reply — knows nothing about git,
GitHub, PRs or CI. Development specifics live in three "world adapters" that
are currently baked in rather than pluggable, plus some prompt wording.

| area | file(s) | status | what is dev-specific |
|---|---|---|---|
| ~~Worker workspace~~ | ~~`src/core/actions/dispatch`, old worktree helper~~ | **done 2026-09-14** | `projects[].workspace: "git-worktree" \| "none"`. Providers live in `src/domain/workspaces/`; the loop asks one to prepare and validate and never learns which it got. |
| ~~Worker prompt framing~~ | ~~`src/core/lib/prompts.ts`~~ | **done 2026-09-14** | The workspace block comes from the provider; `none` adds no section at all. |
| ~~Task intake~~ | ~~old intake helper, `src/core/actions/tick`~~ | **done 2026-09-14** | Any source opens a task through `src/core/lib/ingest.ts`, over HTTP or as an adapter. GitHub moved to `src/domain/adapters/github/`. |
| ~~External events~~ | ~~old observation helpers~~ | **done 2026-09-14** | Same seam; `POST tasks/:id/events` and adapter polls are one path. |
| Facts | `src/core/lib/facts.ts` | core | `Created.origin` is generic; the old issue payload remains a compatibility reader only. Workspaces are provider-owned opaque data. |
| Config | `src/core/lib/config.ts`, `src/app/config.ts` | split 2026-09-16 | Core parses runtime fields through generic extension hooks; app owns the worker/workspace defaults and GitHub normalization. |
| Orchestrator system prompt | `src/app/agents/orchestrator.yaml` | partly done | The checkout sentence moved to the wake prompt, emitted by the project's workspace provider. Still dev-worded: "GitHub issue closing; on a PR … reviews, comments, checks, merge", "may have pushed a branch or opened a PR" — those belong to proposal 3, where adapters emit their own notes. |
| Front-desk agent, UI | `agents/conductor.yaml`, `web/` | dev wording | Mentions GitHub issue intake; repo badge on task rows. |
| `create` action | `src/core/actions/create` | core | The source-specific URL check was dropped; source intake remains exactly deduped by `(source,key)`. |

## Historical proposed changes

1. ~~**Workspace as a per-project capability.**~~ **Done 2026-09-14**, with two
   kinds rather than three — see Status below. `directory` was left out until a
   task actually needs files without Git.
2. ~~**Generic task and event entry points.**~~ **Done 2026-09-14** — see
   Status below.
3. **Adapter-generated runtime notes in the orchestrator prompt.** The system
   prompt keeps only identity and boundaries; the sentences about checkouts,
   PR events and pushed branches are emitted by the wake prompt only when the
   task's project actually has those adapters enabled.
4. **A second SOP as proof.** Keep the development SOP as default; add a
   non-development SOP and run it end to end. Chosen scenario: a research
   report — one worker researches, another reviews the draft, the requester
   signs off, then the task completes.

Nothing above touches the orchestrator's decision model; the same actions and
the same ledger vocabulary serve every domain.


## Status 2026-09-14: the ingest seam (proposal 2)

Built:

- `src/core/lib/ingest.ts` — the only door into the ledger from outside. Two request
  shapes (`open_task`, `push_event`), a vocabulary of two facts (`Created`,
  `Event`), `by` computed rather than accepted, `runtime` / `orchestrator`
  reserved, idempotency on `(source, key)`. Pure except for the append.
- `src/core/lib/adapters.ts` + `src/domain/adapters/` — a `SourceAdapter` reads one outside
  world and returns requests. It holds no ledger handle and wakes nobody.
  `src/app/adapters/index.ts` is the whole registry.
- `src/domain/adapters/github/` — intake, issue closes, PR events and branch discovery,
  plus the `connector_proxy` calls that used to sit in `src/core/actions/tick`. Deleting
  this directory leaves a Conductor that still runs tasks, with no GitHub in it.
- `src/core/actions/tick` — now three visible steps: observe (worker health, adapters),
  ingest, wake. It no longer contains a line of GitHub.
- `POST /api/apps/conductor/tasks` and `POST …/tasks/:id/events` — the same seam
  over HTTP.
- `Created.origin: TaskOrigin` replaces `Created.issue`; `originOf()` reads both,
  because an append-only ledger cannot be rewritten.

Decisions taken, and their cost:

- **Auth is guardian / loopback only.** Enough for adapters in-process, the
  agent, and the dashboard. A third-party system on the open internet still
  needs the named-API-key layer; that is the next thing this surface wants.
- **Ingest never wakes the orchestrator.** A written fact waits for the next
  `tick` (default 5 min), so the loop keeps one driver and the API cannot be
  used to drive orchestration. The response says so in `pickedUpBy`. Latency is
  the price; a webhook-fed adapter would want it lower.
- **`Reply` is not in the vocabulary.** A machine cannot speak as a person. If
  an external channel ever needs to relay a person's words, that is a deliberate
  third shape, not a loosening of `push_event`.
- **Adapters no longer de-duplicate.** They report everything they saw and the
  seam decides what is new. Verified against the live ledger: a tick over two
  open tasks with existing PR reviews, comments and checks wrote nothing.

Still open, unchanged by this: the git worktree hard dependency (proposal 1),
adapter-generated prompt notes (3), and a non-development SOP run end to end (4).


## Status 2026-09-14: workspaces as a capability (proposal 1)

Built:

- `src/core/lib/workspaces.ts` — the seam: `WorkspaceKind`, the stored `Workspace`
  shapes, the `WorkspaceProvider` interface (`prepare` / `validate` /
  `instructions` / `note`), and `handedOverWorkspace`, which is about the ledger
  rather than any kind and so does not belong to a provider.
- `src/domain/workspaces/git-worktree.ts` — the former worktree helper, now the only
  place in Conductor that runs Git. `src/core/workspaces/none.ts` prepares nothing.
  `src/app/workspaces/index.ts` is the registry.
- `projects[].workspace`, defaulting to `git-worktree`; `workingDir` required
  only when the kind needs one. The kind is copied into the `Created` binding.
- `dispatch`, `run_worker` and both prompts go through the provider. The
  orchestrator's system prompt no longer claims every worker gets a checkout;
  the wake says it when the project's provider does.

Decisions taken, and their cost:

- **Two kinds, not three.** `directory` (scratch files, no Git) was designed and
  dropped: nothing needs it yet, and an unused third provider is a third thing
  to keep true. The registry makes adding it later a file and a line.
- **The kind is a snapshot, not a pointer.** A task dispatches into the world it
  was opened in, matching how the project binding already worked. Reconfiguring
  a project does not move tasks already running.
- **Absent is still an error.** `{ kind: "none" }` is recorded explicitly so the
  runtime can keep refusing a worker whose workspace went missing, rather than
  quietly launching it in the shared checkout.
- **Not verified end to end.** Unit tests cover the seam, the config, the
  hand-over rules and both prompts; no non-development task has been run through
  a `none` project yet. That run is proposal 4, still open.

At the time, proposals 3 and 4 remained open; the 2026-09-16 decision below
drops both.

## Decision 2026-09-16: split the app, do not generalize the product

Conductor is the software-development app. Portability of this app is no longer
a goal, so proposals 3 (adapter-generated runtime notes) and 4 (a second SOP as
proof) are dropped. Their replacement is a physical `core` / `domain` / `app`
split plus a source-boundary test: core is reusable runtime, domain is GitHub,
Git worktrees and shared artifact contracts, and app is the composition root.

**Update 2026-09-21:** runtime global/project SOP configuration was removed.
Each Agent now owns its operating policy in its registered system prompt; wake
prompts carry facts and available capabilities only.

The first new domain feature after this restructure will be read-only pull
request cards in phase 2. They are intentionally not part of this change.

**Phase 2 done 2026-09-16:** read-only pull request cards now use the generic core domain-route and task-detail-panel seams.
