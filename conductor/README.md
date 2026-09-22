# Conductor

A fork of Manager where the task workflow is a **prompt**, not a state machine.

Manager decides what happens next in `reconcile.ts`: a `switch` on the latest
fact kind, with phases, retry caps and hook wiring in code. Conductor keeps the
same bones — an append-only ledger, isolated worktrees, heartbeat-supervised
workers, GitHub issue intake — and replaces the decision code with an
**engineering-lead agent** that receives the task ledger plus current facts and
records one decision per wake. Agent system prompts own the workflow; the
runtime only supplies current facts.

## Layout and dependency rule

- `src/core/` is the domain-neutral runtime: ledger, configuration parser,
  repositories, action implementations, API implementation and generic seams.
- `src/domain/` is Conductor's software-development domain: GitHub, Git
  worktrees and shared artifact contracts.
- `src/app/` is the composition root: runtime entries, registries, agents and
  defaults. `src/web/App.tsx` plays the same role for the web app; reusable UI
  is under `src/web/core/`.

Core never imports domain or app, and domain never imports app. The boundary is
checked by `src/core/boundary.test.ts`. A future employee app copies `src/core/`
verbatim and supplies its own domain and app composition.

## Task, Job and Run

```
person / any source ──► Task ledger ◄── Job result ── Worker Run
                             ▲                 ▲
                             │                 │ runtime dispatches
                 engineering lead ── creates Job
```

A **Task** is the durable outcome and may pass through many agents. It is not
assigned wholesale to one agent. The engineering lead creates a bounded
**Job** for a logical agent; lower-level runtime infrastructure dispatches that
Job into a concrete **Run**, selecting or resuming the Worker Session,
preparing the workspace and enforcing global capacity. One Job may have more
than one Run/attempt over its lifetime.

- **Runtime** (`tick`, `orchestrate`, `run_worker`, the Job scheduler): observes and
  transcribes. Expires silent workers (`Lost`), asks every source adapter what
  it saw, hands the batch to the ingest seam (`Created` / `Event`), dispatches
  pending Jobs, records what workers said (`Returned` / `Failed`), and wakes the
  orchestrator for any open task with facts it has not decided on. It decides
  nothing about a task.
- **Engineering lead** (`src/app/agents/engineer-lead.yaml`): the software-domain
  orchestrator, woken per task. It decides whether product definition needs PM,
  consumes a ready spec, maintains the evolving engineering plan, materializes
  only runnable tasks, judges review evidence and owns delivery through
  ready-to-merge. It records exactly one decision per wake.
- **PM and execution workers**: PM owns product definition and returns a durable
  `Status: ready` spec. Coding and verification workers receive bounded
  handoffs; their returns are claims the lead reconciles with evidence.
- **Conductor** (`src/app/agents/conductor.yaml`): the front desk in chat. Turns what a
  person says into `Created / Reply / Completed / Cancelled`.

## Ledger vocabulary

| by | kinds |
|---|---|
| person (`<channel user>` or `github:<login>`) | `Created`, `Reply`, `Completed`, `Cancelled` |
| `orchestrator` | `JobCreated`, `Asked`, `Reported`, `Completed`, `Cancelled`, `Noted` |
| `runtime` | `Dispatched`, `JobFailed`, `Lost`, `Event` |
| worker id | `Opened`, `Returned`, `Failed` |
| `conductor:ledger-compactor` | `Snapshot` |

`Returned` is semi-structured: `status ∈ succeeded | failed | blocked |
waiting | unparsed`, a one-paragraph `summary`, free `detail`. Nothing is
rejected; an unparseable reply is recorded as `unparsed` with the raw text.

Historical ledgers may also contain `Waited` decisions from the retired timed-wait
action. They remain readable so existing Tasks and history do not need a data
migration, but no registered action creates new ones. Open Tasks normally rest
after a decision until a person, worker, child Task, or source adapter writes a
new fact.

## Agent Instance

Each Task coordinator is a first-class, Conductor-owned **Agent Instance**.
The Instance has an opaque durable id; its Task/coordinator identity and its
single resumable Agent Session identity are stored as mappings rather than
encoded into that id. The first wake sends bounded Task context and binds the
Session returned by `system:summon`. Later wakes resume that exact Session and
send only facts after the Task binding's delivered cursor.

This first experiment is deliberately one-to-one: one Agent Instance owns one
Agent Session. Conductor does not rotate or silently replace that Session. A
resume rejection marks the Instance broken so the failure is visible instead
of creating a second Session under the same identity. Per-invocation Rome trace
sessions remain separate accounting records and are grouped beneath the Task's
stable coordinator Instance in the Usage UI.

The append-only ledger has its own bounded-context mechanism. When the raw
segment after the newest `Snapshot` reaches either 24,000 conservatively
estimated tokens or 80 facts, `conductor:ledger-compactor` (the medium model
tier) writes a new `Snapshot` fact through an optimistic sequence boundary.
Raw facts remain untouched. A coordinator that has not already consumed the
prefix receives the canonical `Created` fact, the newest Snapshot, and facts
after the Snapshot's covered sequence. Snapshot facts are context, not
coordinator decisions or runtime events, and never wake a Task by themselves.
When the project has an agent work repository, the same summary is also
committed to `_conductor/tasks/<task-id>/snapshot.md`; the Snapshot fact pins
the exact repository commit and remains authoritative.

## What code still enforces (and why it is not workflow)

- **Freshness** (`fold.ts` → `needsAttention`): wake the orchestrator when
  there are facts after its last decision, when a legacy `Waited` is due, or
  after a `stop` with no follow-up. That is all the fold knows.
- **Two ledger writes**: observations append; state-dependent commands compare
  and append. A conditional write identifies a Task plus the global `seq` of
  the newest fact the caller saw on that Task. Unrelated Tasks never conflict.
  A stale caller receives the current Task seq and only the intervening facts,
  then decides again. Coordinator decisions and person reply/complete/cancel
  commands all use this same primitive.
- **Job scheduling, slots and isolation**: the lead chooses a Job's logical
  agent and instructions; runtime chooses the Worker Session, workspace and
  slot. `maxWorkers`, one live Run per task, one workspace per worker, and
  heartbeat leases are infrastructure constraints.
- **Safety valve**: `maxDecisionsPerTurn` decisions since a person last spoke,
  after which the runtime writes a `circuit_breaker` Event and stops waking
  the task until someone replies.
- **A narrow door** (`src/core/lib/ingest.ts`): what the outside may write, below.

## The prompts, layered

| layer | says | lives in |
|---|---|---|
| Agent system prompts | each Agent's responsibility, quality bar, hard lines and handoff boundaries | `src/app/agents/*.yaml` — app-owned |
| wake prompt | first turn: complete ledger and contracts; resumed Instance: new facts and current execution state; always includes `seenSeq` | built by `src/core/lib/prompts.ts` |

Agent policy is deliberately responsibility-oriented, not a recipe. It does
not enumerate what to do when a worker fails / blocks / waits; the ledger can
hold combinations no list foresees, and a model with the goal in front of it
handles them better than one matching cases. Behaviour is bounded by tools
instead: the engineering lead has no hidden channel to a worker. `dispatch`
records a `JobCreated`
decision; runtime separately records `Dispatched` when it chooses the concrete
Run. `create-tasks` is reserved for genuinely separate outcomes and records
the bounded child Tasks named by that decision—not PM/coding/review stages of
one Task.

## Lead-owned task materialization

The runtime does not store or schedule a dependency graph. For complex work the
engineering lead keeps a living plan in the project's agent work repository and
calls `create-tasks` only for bounded items it judges executable now. Each child
records its parent, stable plan-item id, and optional spec/plan references. When
a child completes, the runtime observes that fact on the parent; the lead then
reconciles the actual result and decides what, if anything, becomes runnable
next. Obsolete created work is cancelled or superseded rather than deleted.

## Checkpoint replay for prompt experiments

`conductor:fork_task` starts a fresh Task from a historical checkpoint without
copying the source ledger or resuming its Agent Sessions. The caller supplies a
sanitized checkpoint seed and a registered coordinator Agent id, so prompt
variants can be compared against the same product/prototype state without
leaking later decisions, worker state, or credentials. Replay planning is
isolated under `_experiments/replays/<new-task-id>/design.md` in the project work
repository; promotion into the canonical workstream remains an explicit human
decision. The Task detail page exposes the same flow as **Replay from
checkpoint**.

## Setup

Open **Settings** → **Projects** in the app to add, edit, inspect, or
remove projects. The form accepts a permanent lowercase slug, an absolute
working directory, a workspace kind, GitHub repository and intake settings,
and the default-project choice. A GitHub repository may be entered as
`owner/name` or a `github.com` URL. If its target directory
is missing or empty, **Clone here** runs `gh repo clone`; existing non-empty
directories are never replaced. Project deletion is blocked when open tasks
are pinned to it until the UI's explicit force confirmation. Existing tasks
keep the project snapshot recorded when they were created.

Each project also gets a private agent work repository named
`<project>-work`, checked out beside the code repository. It holds product
specs, engineering designs, and other coordination artifacts. **New
repository** opens a dedicated flow that creates a private GitHub repository,
clones it locally, and saves it on the project. **Set up** makes the currently
selected repository ready, creating it when needed and cloning it locally.
Repository fields keep manual entry for new repositories and also provide a
searchable selector populated from every repository visible to the connected
GitHub identity.

The same settings remain available programmatically:

```
conductor:configure_conductor {
  projects: {
    playground: {
      workingDir: "/abs/path",
      github: { repo: "owner/name", intakeLabel: "conductor" },
      workRepo: { repo: "owner/playground-work", workingDir: "/abs/playground-work" }, // optional; derived by default
    },
    research:   { workspace: "none" },
  },
  workRepoOwner?: "owner", // default owner for derived <project>-work repositories
  github?: { intakeLabel: "conductor" },
  workerAgents?: { "conductor:pm": "...", "coding:coding": "...", "assistant:assistant": "..." },
  maxWorkers?: 3, intervalMinutes?: 5, reuseSessions?: true, maxDecisionsPerTurn?: 25
}
```

### Jev front-desk shadow

Conductor can evaluate each `conductor:conductor` turn with TypeSafe Jev beside
the existing LLM front desk. Shadow mode never rewrites the prompt, calls a
person action, or changes the reply: the LLM remains authoritative. After the
turn, Conductor records Jev's typed intent / task / project decision together
with the person fact the LLM actually wrote, if any.

Shadow evaluation is enabled in app configuration by default but makes no
external request unless Rome has a `TYPESAFE_API_KEY`. Add or replace it from
Conductor's **Shadow** page. Rome stores the guardian-entered value as an app
key, never returns the value to Conductor's UI, injects it into the app runtime,
and reloads the shadow hook without a restart. An operator-supplied process
environment variable with the same name takes precedence. Disable the
experiment with:

```json
{
  "frontdeskShadow": { "enabled": false, "model": "jev-latest" }
}
```

Run `conductor:frontdesk_shadow_report` to inspect recent decisions, agreement
with the LLM's ledger write, latency, token usage, and estimated Jev input cost.
The report treats a no-write LLM turn as agreement with Jev's `ask_status`,
`other`, or `ambiguous` intents; it cannot yet distinguish those three from the
ledger alone. Shadow rows include the user's input and compact open-task state,
so enabling the experiment sends that state to TypeSafe and keeps a local copy
for evaluation.

### PM worker

`conductor:pm` is a specialist worker whose complete role, judgment boundary,
durable spec contract and Conductor handoff live in its system prompt. The
engineering lead sends it work whose product
behavior, scope or acceptance is not yet safe for engineering. It researches the codebase read-only and writes
`<slug>/spec.md` to the project's agent work repository. Questions return as a
blocked worker result; the lead asks the person and resumes the same PM
session. A successful return names a pushed, `Status: ready` spec that a coding
worker can consume.

> **Dependency note:** `@rome-os/ui` is temporarily linked to a local
> unpublished build (`"@rome-os/ui": "link:/app/packages/ui"`, version 0.3.1)
> for the new page/layout-form/list-row components the settings rework uses.
> `link:` symlinks the package's prebuilt `dist/` and skips its `prepare` build,
> so a `--prod` install does not try to recompile it. Switch it back to `^0.3.1`
> once that release is published to the registry.

## Where facts come from: the ingest seam

Nothing outside Conductor appends to the ledger. A source — the GitHub poll, an
order system, a mailbox, a person with curl — hands `src/core/lib/ingest.ts` a
request, and the seam decides whether a fact is written and which one. Three properties
follow, and they are why the loop can be trusted with input it did not author:

| property | what it means |
|---|---|
| a narrower vocabulary than the ledger | a source may `open_task` (`Created`) or `push_event` (`Event`). There is no shape that produces `JobCreated`, `Dispatched`, `Reported`, `Waited` or `Completed`, so no input can make the coordinator or runtime appear to have acted. A person's `Reply` is excluded too: replies come from the guardian's own routes, not from a machine claiming to be a person. |
| authorship is computed, never accepted | `by` is derived — `source` or `source:actor` for a `Created`, always `runtime` for an `Event`. `runtime` and `orchestrator` are reserved slugs; an Event can never read as a person speaking and reset the circuit breaker. |
| idempotency is the seam's job | one task per `(source, key)` ever; one event per `(source, key)` per task. Planning and append share one SQLite write reservation, so concurrent intake sees the winner rather than writing from the same stale snapshot. |

`tick` never treats a source specially — it iterates the registry in
`src/app/adapters/index.ts`, hands the batch to the seam, then wakes. Over HTTP the same seam is two routes, guardian /
loopback only for now:

```
POST /api/apps/conductor/tasks
  { source, brief, key?, actor?, cite?, url?, title?, data?, projectId? }
  → { status: recorded|duplicate, taskId, seq?, pickedUpBy }

POST /api/apps/conductor/tasks/:id/events
  { source, type, summary, key?, cite?, data? }
  → { status: recorded|duplicate, taskId, seq?, pickedUpBy }
```

Neither route wakes the orchestrator. The next `tick` finds the facts the way it
finds every other one, so the loop keeps exactly one driver.

## Workspaces

Where a worker works is a per-project capability, not a fact of life.
`projects[].workspace` picks one:

| kind | what a worker gets | for |
|---|---|---|
| `git-worktree` (default) | its own worktree cut from `workingDir`, on branch `conductor/<taskId>/<workerId>`, handed on to the next worker if it ended cleanly | code |
| `none` | nothing; the prompt says nothing about where to work | tasks whose work is not files — reading, researching, reviewing, answering |

`workingDir` is required for every kind but `none`. The kind is copied into the
ledger at `Created`, so a task runs its whole life in the world it was opened
in, even if the project is reconfigured later.

Be honest about what this is: `system:summon` takes no working directory, so a
worker runs wherever its agent runs. A provider controls what exists on disk
before the worker starts and what the prompt tells it. `git-worktree` is real
isolation because the tree is real and the prompt points at it; `none` is the
absence of both, not a sandbox.

The runtime still fails closed. A `Dispatched` fact always records the Job and a workspace,
`{ kind: "none" }` included, so a worker with no workspace *by design* never
looks like one whose worktree went missing — the second is still refused.

`src/domain/workspaces/` holds domain providers such as `git-worktree`; the generic `none` provider lives in `src/core/workspaces/`. Adding a kind is an implementation plus a line in `src/app/workspaces/index.ts`.

## Source adapters

`src/domain/adapters/<source>/` is one outside world. An adapter reads it and
returns ingest requests; it holds no ledger handle, writes no fact and wakes nobody.
Adding a source is a directory plus a line in `src/app/adapters/index.ts` — no
change to the loop, the ledger or the prompts.

**`github`** — everything this app knows about issues, pull requests, reviews,
checks and branch names lives under `src/domain/adapters/github/` and nowhere
else.
It reports, once each: a task per issue carrying the intake label
(`Created`, author `github:<login>`); `issue_closed` on any issue an open task
names; on any PR mentioned in the task's facts — `pr_review` (one event for a
submitted review together with all of its inline comments), `pr_comment`,
`checks_completed` (success/failure per
head), `pr_merged`, `pr_closed`; and `pr_opened` for any open PR whose head
branch is `conductor/<taskId>/…` that no fact mentions yet (a worker declared
Lost may still have pushed). What an event means for the task is the
orchestrator's call.

Task detail also shows read-only cards for up to ten pull requests mentioned in
the task. Each card reads GitHub's title and state, branches, diff and file
counts, discussion and review-comment totals, the latest decisive review per
reviewer, and check runs for the current head. The browser refreshes these
cards every 60 seconds while visible. This status read never writes a fact or
changes GitHub; if someone merges externally, the card reflects it on refresh
and the normal adapter reports `pr_merged` to the ledger on the next tick.

## Scenarios exercised on the playground repo (2026-09-11)

| scenario | what happened |
|---|---|
| review feedback on the PR | `pr_review` Event → orchestrator resumed the implementer's session with the feedback (and "rebase, CI was just added") → green → independent re-check → report |
| CI turned red (main tightened a check, "Update branch" re-ran it) | `checks_completed: failure` Event → resumed implementer with a diagnostic brief that allowed "unrelated/transient → report, don't change code" → fix → green → it chose a second independent verification on its own → report |
| requirements changed mid-flight (Reply while a worker was live) | worker happened to return 16 s later; the orchestrator saw both facts in one wake and resumed the same worker to revise the open PR to the new API |
| worker died mid-run (heartbeat lease expired) | `Lost` → fresh worker 39 s later → PR; the "dead" worker was in fact still running and opened a duplicate PR; `pr_opened` surfaced it and the report named the duplicate and the verified one |

Two runtime mechanisms came out of these: a one-shot nudge in `orchestrate`
when the orchestrator narrates a decision instead of recording it, and the
`pr_opened` discovery above. Neither encodes workflow.

## A run, as recorded (issue → merged PR)

```
#1  Created     github:zhangfand   issue #1 taken in
#2  JobCreated  orchestrator       j-… for coding:coding
#3  Dispatched  runtime            j-… as worker w-…
#5  Returned    w-…                succeeded: PR #2 at fc621e0
#6  JobCreated  orchestrator       j-… for assistant:assistant (read-only verify)
#7  Dispatched  runtime            j-… as worker w-…
#9  Returned    w-…                waiting: CI pending / no checks recorded
#10 Asked       orchestrator       does this repository have CI?
#11 Reply       zhangfan           "no CI here, proceed"
#12 Reported    orchestrator       PR #2 delivered, please review and merge
#13 Event       runtime            github/issue_closed (completed)
#14 Completed   orchestrator       evidence: Event #13, PR #2
```
