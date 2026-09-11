# Conductor

A fork of Manager where the task workflow is a **prompt**, not a state machine.

Manager decides what happens next in `reconcile.ts`: a `switch` on the latest
fact kind, with phases, retry caps and hook wiring in code. Conductor keeps the
same bones — an append-only ledger, isolated worktrees, heartbeat-supervised
workers, GitHub issue intake — and replaces the decision code with an
**orchestrator agent** that reads a task's whole ledger plus a standard
operating procedure (SOP) and records one decision per wake. Change the SOP and
the same app runs a different kind of work.

## The three parties

```
person / GitHub ──► ledger ◄── worker (via run_worker)
                      ▲
                      │ reads everything, writes one decision
                 orchestrator
```

- **Runtime** (`tick`, `orchestrate`, `run_worker`, `dispatch`): observes and
  transcribes. Expires silent workers (`Lost`), takes labeled issues in
  (`Created`), records closed issues (`Event`), launches workers, records what
  they said (`Returned` / `Failed`), and wakes the orchestrator for any open
  task with facts it has not decided on. It decides nothing about a task.
- **Orchestrator** (`agents/orchestrator.yaml`): woken per task. Gets the SOP,
  every fact on the task, the agents it may use and the free worker slots.
  Records exactly one of `Dispatched / Asked / Reported / Waited / Completed /
  Cancelled / Noted` (optionally preceded by `stop` → `Lost`).
- **Conductor** (`agents/conductor.yaml`): the front desk in chat. Turns what a
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
  worktree per worker, heartbeat leases.
- **Safety valve**: `maxDecisionsPerTurn` decisions since a person last spoke,
  after which the runtime writes a `circuit_breaker` Event and stops waking
  the task until someone replies.

## The prompts, layered

| layer | says | lives in |
|---|---|---|
| orchestrator system prompt | who it is, its responsibility and limits, how workers cooperate (what they see, what they return), what each tool means, "you only speak through the ledger" | `src/agents/orchestrator.yaml` — domain-free |
| SOP | the goal and quality bar (not "a PR" but "a PR independently verified against the request"), what *done* means, the domain's hard lines, the shape the work usually takes | `src/lib/sop.ts` default; config / per project |
| wake prompt | facts only: ledger, live worker, free slots, agents, `seenSeq` | built by `src/lib/prompts.ts` |

The SOP is deliberately not a recipe. It does not enumerate what to do when
a worker fails / blocks / waits; the ledger can hold combinations no list
foresees, and a model with the goal in front of it handles them better than
one matching cases. Behaviour is bounded by tools instead: the orchestrator
has no shell, no GitHub, no channel to a worker — every action it owns
writes one fact.

## Setup

```
conductor:setup {
  projects: { playground: { workingDir: "/abs/path", repo: "owner/name", intakeLabel: "conductor" } },
  sop?: "...",            // omit for the built-in software-development SOP (src/lib/sop.ts)
  workerAgents?: { "coding:coding": "...", "assistant:assistant": "..." },
  maxWorkers?: 3, intervalMinutes?: 5, reuseSessions?: true, maxDecisionsPerTurn?: 25
}
```

The SOP is editable on the Configuration page; a project may carry its own
`sop` to override the global one.

## External events the runtime records

`tick` polls GitHub and writes one `Event` per observation, once (keyed in
`payload.data.key`): `issue_closed`; on any PR mentioned in the task's facts —
`pr_review`, `pr_review_comment`, `pr_comment`, `checks_completed`
(success/failure per head), `pr_merged`, `pr_closed`; and `pr_opened` for any
open PR whose head branch is `conductor/<taskId>/…` that no fact mentions yet
(a worker declared Lost may still have pushed). What an event means for the
task is the orchestrator's call.

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
