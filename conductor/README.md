# Conductor

A fork of Manager where the task workflow is a **prompt**, not a state machine.

Manager decides what happens next in `reconcile.ts`: a `switch` on the latest
fact kind, with phases, retry caps and hook wiring in code. Conductor keeps the
same bones — an append-only ledger, isolated worktrees, heartbeat-supervised
workers, GitHub issue intake — and replaces the decision code with an
**orchestrator agent** that reads a task's whole ledger plus a standard
operating procedure (SOP) and records one decision per wake. Change the SOP and
the same app runs a different kind of work.

## Layout and dependency rule

- `src/core/` is the domain-neutral runtime: ledger, configuration parser,
  repositories, action implementations, API implementation and generic seams.
- `src/domain/` is Conductor's software-development domain: GitHub, Git
  worktrees and the default software-development SOP.
- `src/app/` is the composition root: runtime entries, registries, agents and
  defaults. `src/web/App.tsx` plays the same role for the web app; reusable UI
  is under `src/web/core/`.

Core never imports domain or app, and domain never imports app. The boundary is
checked by `src/core/boundary.test.ts`. A future employee app copies `src/core/`
verbatim and supplies its own domain and app composition.

## The three parties

```
person / any source ──► ingest seam ──► ledger ◄── worker (via run_worker)
                                          ▲
                                          │ reads everything, writes one decision
                                     orchestrator
```

- **Runtime** (`tick`, `orchestrate`, `run_worker`, `dispatch`): observes and
  transcribes. Expires silent workers (`Lost`), asks every source adapter what
  it saw, hands the batch to the ingest seam (`Created` / `Event`), launches
  workers, records what they said (`Returned` / `Failed`), and wakes the
  orchestrator for any open task with facts it has not decided on. It decides
  nothing about a task.
- **Orchestrator** (`src/app/agents/orchestrator.yaml`): woken per task. Gets the SOP,
  every fact on the task, the agents it may use and the free worker slots.
  Records exactly one of `Dispatched / Asked / Reported / Waited / Completed /
  Cancelled / Noted` (optionally preceded by `stop` → `Lost`).
- **Conductor** (`src/app/agents/conductor.yaml`): the front desk in chat. Turns what a
  person says into `Created / Reply / Completed / Cancelled`.

## Ledger vocabulary

| by | kinds |
|---|---|
| person (`<channel user>` or `github:<login>`) | `Created`, `Reply`, `Completed`, `Cancelled` |
| `orchestrator` | `Dispatched`, `Asked`, `Reported`, `Waited`, `Completed`, `Cancelled`, `Noted`, `Lost` (stop) |
| `runtime` / worker id | `Opened`, `Returned`, `Failed`, `Lost`, `Event` |

`Returned` is semi-structured: `status ∈ succeeded | failed | blocked |
waiting | unparsed`, a one-paragraph `summary`, free `detail`. Nothing is
rejected; an unparseable reply is recorded as `unparsed` with the raw text.

## What code still enforces (and why it is not workflow)

- **Freshness** (`fold.ts` → `needsAttention`): wake the orchestrator when
  there are facts after its last decision, when a `Waited` is due, or after a
  `stop` with no follow-up. That is all the fold knows.
- **Optimistic concurrency**: every decision action takes `seenSeq`; if the
  ledger moved, the decision is refused with the new facts and the
  orchestrator decides again.
- **Slots and isolation**: `maxWorkers`, one live worker per task, one
  workspace per worker, heartbeat leases.
- **Safety valve**: `maxDecisionsPerTurn` decisions since a person last spoke,
  after which the runtime writes a `circuit_breaker` Event and stops waking
  the task until someone replies.
- **A narrow door** (`src/core/lib/ingest.ts`): what the outside may write, below.

## The prompts, layered

| layer | says | lives in |
|---|---|---|
| orchestrator system prompt | who it is, its responsibility and limits, how workers cooperate (what they see, what they return), what each tool means, "you only speak through the ledger" | `src/app/agents/orchestrator.yaml` — app-owned |
| SOP | the goal and quality bar (not "a PR" but "a PR independently verified against the request"), what *done* means, the domain's hard lines, the shape the work usually takes | `src/domain/sop.ts` default; config / per project |
| wake prompt | facts only: ledger, live worker, free slots, agents, `seenSeq` | built by `src/core/lib/prompts.ts` |

The SOP is deliberately not a recipe. It does not enumerate what to do when
a worker fails / blocks / waits; the ledger can hold combinations no list
foresees, and a model with the goal in front of it handles them better than
one matching cases. Behaviour is bounded by tools instead: the orchestrator
has no shell, no GitHub, no channel to a worker — every action it owns
writes one fact.

## Setup

```
conductor:setup {
  projects: {
    playground: { workingDir: "/abs/path", github: { repo: "owner/name", intakeLabel: "conductor" } },
    research:   { workspace: "none", sop: "..." },
  },
  github?: { intakeLabel: "conductor" },
  sop?: "...",            // omit for the built-in software-development SOP (src/domain/sop.ts)
  workerAgents?: { "coding:coding": "...", "assistant:assistant": "..." },
  maxWorkers?: 3, intervalMinutes?: 5, reuseSessions?: true, maxDecisionsPerTurn?: 25
}
```

The SOP is editable on the Configuration page; a project may carry its own
`sop` to override the global one.

## Where facts come from: the ingest seam

Nothing outside Conductor appends to the ledger. A source — the GitHub poll, an
order system, a mailbox, a person with curl — hands `src/core/lib/ingest.ts` a
request, and the seam decides whether a fact is written and which one. Three properties
follow, and they are why the loop can be trusted with input it did not author:

| property | what it means |
|---|---|
| a narrower vocabulary than the ledger | a source may `open_task` (`Created`) or `push_event` (`Event`). There is no shape that produces `Dispatched`, `Reported`, `Waited` or `Completed`, so no input can make the runtime appear to have decided something. A person's `Reply` is excluded too: replies come from the guardian's own routes, not from a machine claiming to be a person. |
| authorship is computed, never accepted | `by` is derived — `source` or `source:actor` for a `Created`, always `runtime` for an `Event`. `runtime` and `orchestrator` are reserved slugs; an Event can never read as a person speaking and reset the circuit breaker. |
| idempotency is the seam's job | one task per `(source, key)` ever; one event per `(source, key)` per task. A retried webhook, a poll that lists the same issue twice, and two adapters watching one system all write once. |

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

The runtime still fails closed. A `Dispatched` fact always records a workspace,
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
names; on any PR mentioned in the task's facts — `pr_review`,
`pr_review_comment`, `pr_comment`, `checks_completed` (success/failure per
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
#2  Dispatched  orchestrator       w-… as coding:coding
#4  Returned    w-…                succeeded: PR #2 at fc621e0
#5  Dispatched  orchestrator       w-… as assistant:assistant (read-only verify)
#7  Returned    w-…                waiting: CI pending / no checks recorded
#8  Waited      orchestrator       15 min
#9  Reply       zhangfan           "no CI here, proceed"
#10 Reported    orchestrator       PR #2 delivered, please review and merge
#11 Event       runtime            github/issue_closed (completed)
#12 Completed   orchestrator       evidence: Event #11, PR #2
```
