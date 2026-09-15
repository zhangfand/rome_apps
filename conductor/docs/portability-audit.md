# Portability audit: what in the runtime is still software-development-specific

Date: 2026-09-11. No code was changed for this audit.
Updated 2026-09-14: proposal 2 is done — see "Status" at the end.

The core loop — ledger, fold, decisions with `seenSeq`, `tick` / `orchestrate`,
worker heartbeats, the semi-structured worker reply — knows nothing about git,
GitHub, PRs or CI. Development specifics live in three "world adapters" that
are currently baked in rather than pluggable, plus some prompt wording.

| area | file(s) | status | what is dev-specific |
|---|---|---|---|
| Worker workspace | `actions/dispatch`, `lib/worktree.ts` | **hard dependency** | Every dispatch creates a git worktree from `project.workingDir`; a project without a git repo cannot dispatch at all. This is the one real blocker for non-dev use. |
| Worker prompt framing | `lib/prompts.ts` → `workspaceInstructions` | dev wording in every worker prompt | Worktree / branch / LFS instructions are appended unconditionally. |
| ~~Task intake~~ | ~~`lib/intake.ts`, `actions/tick`~~ | **done 2026-09-14** | Any source opens a task through `lib/ingest.ts`, over HTTP or as an adapter. GitHub moved to `adapters/github/`. |
| ~~External events~~ | ~~`lib/observe.ts`, `lib/observe-prs.ts`~~ | **done 2026-09-14** | Same seam; `POST tasks/:id/events` and adapter polls are one path. |
| Facts | `lib/facts.ts` | neutral since 2026-09-14 | `Created.origin` (TaskOrigin) replaced the GitHub-shaped `issue`, which is still read for facts already in the ledger. `Dispatched.workspace` is still git-shaped. |
| Config | `lib/config.ts` | dev defaults | `projects[].workingDir` required and must be an absolute path; `repo` / `intakeLabel`; default `workerAgents` are `coding:coding` + `assistant:assistant`; default SOP is software development. |
| Orchestrator system prompt | `agents/orchestrator.yaml` | dev wording | "runs in an isolated checkout", "GitHub issue closing; on a PR … reviews, comments, checks, merge", "may have pushed a branch or opened a PR". |
| Front-desk agent, UI | `agents/conductor.yaml`, `web/` | dev wording | Mentions GitHub issue intake; repo badge on task rows. |
| `create` action | `actions/create` | harmless | Duplicate check by GitHub issue URL in the brief. |

## Proposed changes (not done)

1. **Workspace as a per-project capability.** `projects[].workspace:
   "git-worktree" | "directory" | "none"`. `none`: dispatch creates nothing and
   the worker prompt carries no workspace block. `directory`: a plain scratch
   directory per worker, no git. `git-worktree`: today's behaviour.
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

- `src/lib/ingest.ts` — the only door into the ledger from outside. Two request
  shapes (`open_task`, `push_event`), a vocabulary of two facts (`Created`,
  `Event`), `by` computed rather than accepted, `runtime` / `orchestrator`
  reserved, idempotency on `(source, key)`. Pure except for the append.
- `src/lib/adapters.ts` + `src/adapters/` — a `SourceAdapter` reads one outside
  world and returns requests. It holds no ledger handle and wakes nobody.
  `src/adapters/index.ts` is the whole registry.
- `src/adapters/github/` — intake, issue closes, PR events and branch discovery,
  plus the `connector_proxy` calls that used to sit in `actions/tick`. Deleting
  this directory leaves a Conductor that still runs tasks, with no GitHub in it.
- `actions/tick` — now three visible steps: observe (worker health, adapters),
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
