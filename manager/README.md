# Manager

A long-running agent: it keeps working on your tasks across sessions, and its
correctness never depends on a session continuing.

Tell it what you want in chat, or label an issue in a repository it watches.
It records the task in an append-only ledger, puts a coding session on it,
retries what fails, asks you when it is stuck, and reports when there is
something to look at. A task ends when you say so, or when its GitHub issue is
closed — as completed, or as not planned.

This is a prototype of the "long-running agent, revision 3" model. Almost all of
it is plain TypeScript; a model runs at exactly two points.

## The two model call sites

**The language boundary.** You chat with the `manager` agent
(`src/agents/manager.yaml`). Its only ledger-writing tools are `manager:create`,
`manager:reply`, `manager:complete`, and `manager:cancel`, plus the read-only
`manager:snapshot`. The agent picks which task your words are about and how to
word the fact; the app stamps who said it and cites the message. When the words
map to none of those, the agent answers in chat and writes nothing. Its system
prompt carries no scheduling logic — no caps, no retries, no age.

**The judge.** `src/lib/judge.ts` is the optional result grader. The runtime first
routes the validated worker outcome: `waiting` schedules a revisit, `blocked`
asks a person, and only `ready` reaches the judge. The default judge accepts a
nonempty summary without a legacy `BLOCKED:` line; it does not independently
verify the task's delivery requirements. Those are the worker's responsibility.
Swapping in a model-graded judge remains a change to that one file.

**The return protocol.** Every new worker is taught the exact JSON contract in
`src/lib/worker-reply.ts`, on fresh starts and resumes. `system:summon` returns
its final reply to `run_worker`, which validates it and allows one format-only
repair in the same session. A second invalid reply becomes a `Failed` fact
marked `reply_protocol`, then a Question — never an implicit success or an
unbounded retry. See [docs/worker-replies.md](docs/worker-replies.md).

Everything else — when to take a task, when to start a worker, how many at once,
when to retry, when to ask, when to stop — is `src/lib/reconcile.ts`, a pure
function from a ledger snapshot to a list of writes.

## The ledger

One table, `manager__facts`, append-only. Nothing updates or deletes a fact.
A task's state and position are folded from its facts every time they are
needed, so a pass can die between any two writes without corrupting anything.

Facts are named by one rule: a participle is something that happened, a noun is
something somebody said.

| Kind | Written by | Payload |
| --- | --- | --- |
| `Created` | a person, or `github:<login>` | `brief`, `issue?` — the issue it was taken in from |
| `Taken` | the runtime | — |
| `Completed` | a person, or `github` | `reason?`, `issues?` — the closed issues, when `github` wrote it |
| `Cancelled` | a person, or `github` | `reason?`, `issues?` — the issues closed as not planned, when `github` wrote it |
| `Started` | the runtime | `workerId`, `prompt`, `resumeSessionId?`, `replyProtocol?`, `workspace?` |
| `Opened` | the worker | `workerId`, `romeSessionId`, `sessionType` — the worker's Rome session, recorded the moment it exists so the dashboard can open a live worker |
| `Restarted` | the worker | `workerId`, `rejectedSessionId`, `error`, `prompt` |
| `Returned` | the worker | `workerId`, `reply`, `sessionId?`, validated `result?`, `repair?` |
| `Failed` | the worker | `workerId`, `error`, `sessionId?`, `failureKind?`, `reply?`, `repair?` |
| `Lost` | the runtime | `workerId`, `why` |
| `Deferred` | the runtime | `workerId`, `reason`, `resumeAfter` (ISO time) |
| `Question` | the runtime | `why` |
| `Report` | the runtime | `what`, `evidence` |
| `Reply` | a person | `text` |

Every fact a person writes carries `by` (who) and `source` (their words or the
action, verbatim).

A follow-up worker on a task resumes the session the last Returned or Failed
worker left, so it keeps that context (and the provider's prompt cache) rather
than re-reading the repository cold; a Lost worker's session is never resumed,
because a "stopped" worker may still be in it. When the runner refuses a
resume, the worker writes `Restarted` and runs fresh with a full brief. See
[docs/session-reuse.md](docs/session-reuse.md); `reuseSessions: false` in
`manager:setup` turns it off.

**States** are about ownership: Created, Taken, Completed, Cancelled. A task
ends from Created or Taken on a person's word, or when its issue closes
(below); the runtime never ends one on its own reading of a worker's result.
**Positions** live inside Taken and are never stored: `working` (the runtime's
last word is a Started), `waiting` (a Deferred), `stuck` (a Question), `reported`
(a Report). The runtime never leaves Taken on its own.

`waiting` means the runtime still owns unfinished work, no worker is running,
and a durable revisit time is recorded. On the first reconciliation tick at or
after that time with a free slot, the runtime appends Started and resumes the
worker. Until then, even if overdue, it stays waiting. The **worker**, not the
runtime, checks whether external work is ready and can yield waiting again.
The existing reconcile routine supplies the ticks — there is no new per-task
routine, event watcher, or PR/CI logic in the scheduler. Normal waits reset the
failure-attempt budget and consume no live worker slot. Human steering and
terminal facts still take precedence.

## Worker worktrees

Every new worker gets an isolated Git worktree **before** its `Started` is
recorded and its agent is launched. `workingDir` is the **source** project,
not the shared directory workers edit. If it points inside a repository (for
example `packages/app`), workers use that same subdirectory in their worktree.
The source must be inside a non-bare Git repository with at least one commit.

- New tasks get separate branches (`manager/<taskId>/<workerId>`) and checkouts
  under `.manager-worktrees/<repo-key>/` next to the repository. The recorded
  `workspace` carries the root, working directory, initial branch, base commit,
  and repository identity; it is also in the worker read model and ledger.
- A new tree starts from the first locally available ref in this order:
  `origin/HEAD`, local `main`, local `master`, then `HEAD`. Manager does not fetch;
  update the source repository's refs when a newer base is needed. Uncommitted
  source changes and unrelated checked-out feature branches are not copied.
- A follow-up reuses the latest worker's tree only after **Returned or Failed**,
  preserving its branch and dirty files even with `reuseSessions: false`.
  A running or **Lost** worker never hands its tree to a replacement: it may
  still be writing. The replacement starts from the normal base; prior work
  remains in the old tree and task history for recovery.
- Legacy sessions that ran in the shared checkout start fresh with a full
  history when migrated. Existing running workers are not moved mid-run.
- Missing/changed worktrees, repository mismatches, and creation errors become
  ordinary `Failed` outcomes under the existing retry cap. There is no fallback
  to the source checkout and no destructive reset, clean, stash, or deletion.
- Worktrees remain after return, failure, or task closure for follow-ups and
  recovery. Cleanup is manual once the worker has actually stopped and its
  work is saved. Dependencies are installed per tree, not shared or copied.

The isolated directory is repeated in fresh, resumed, and fallback prompts.
Rome's summon still cannot set the agent process cwd or sandbox its tools:
Manager creates and validates the real worktree, then instructs the worker to
move there and keep all work there. This is checkout isolation, not a security
boundary. See the platform limit below.

## Taking in from GitHub

A chat is not the only way to ask. An open issue carrying the intake label
(`ready-for-agent` by default) in a watched repository is the same ask,
written where the code lives. Every reconcile pass lists each repo in
`intakeRepos` for open issues with that label and appends a `Created` for any
that has no task yet:

- `by` is the issue's author, as `github:<login>` — the issue is a person's
  words, so its author is the fact's author, the way a chat message's is.
- `brief` is the issue's title and body, ending in a `GitHub issue: <url>` line,
  so the close watch below picks it up with nothing more said. Bodies past
  6000 characters are cut with a pointer back to the issue.
- `source` cites the issue, the way a chat fact cites the message.
- `payload.issue` records the URL, number, title, author, and label.

One task per issue, ever. An issue that already has a task — opened from it
here, or opened in chat by a person who named it in the brief — is never taken
in again, even after that task ends; re-labeling does not reopen work. Pull
requests, which answer on the same endpoint, are not asks and are skipped.
Steering stays in chat: issue comments are not read, and nothing is posted
back to the issue.

The poll goes through `connector:connector_proxy` (toolkit `github`), up to
five pages of 100 per repo per pass. A repo that cannot be read is logged and
skipped until the next tick. An empty `intakeRepos` — the default — turns
intake off.

## Ending from GitHub

The issue a person names in the brief — `https://github.com/owner/repo/issues/N`
or `owner/repo#N` — is the source of truth for whether the work is wanted and
whether it is done. Every reconcile pass polls GitHub for each open task's
issues and, once every one is closed, appends the ending GitHub reported:

| GitHub says | Ledger gets |
| --- | --- |
| closed, `state_reason: completed` (or none, on older closes) | `Completed` by `github` |
| closed, `state_reason: not_planned` or `duplicate` | `Cancelled` by `github` |

The fact cites the issues as `source`, the way a person's fact cites their
message, and lists them in `payload.issues`. A brief naming several issues
ends when all are closed: Cancelled if every one was dropped, Completed if any
was done.

Only the brief counts — an issue a worker mentions is the worker's claim, not
the person's ask. The task ends whatever its position; a worker still running
on it is stopped by the usual terminal-task rule (recorded as `Lost`, since
Rome cannot yet cancel a run — see Known gaps). Merging a pull request does
nothing by itself; close the issue, or let a `Closes #N` in the PR do it.

The poll goes through `connector:connector_proxy` (toolkit `github`), so the
app never holds a token. If GitHub is not connected or a call fails, the pass
logs it and leaves the task open until the next tick. `closeOnIssueClosed:
false` in `manager:setup` turns the poll off.

## Setting it up

```jsonc
// manager:setup — the only required field is the source project directory.
{
  "workingDir": "/absolute/path/to/your/project",
  "workerAgent": "coding:coding",  // default
  "startCap": 2,                   // starts since the last person fact or successful deferral
  "maxWorkers": 3,                 // workers running at once, across tasks
  "ageCapHours": 3,                // silence before a worker is declared lost
  "intervalMinutes": 5,            // how often reconcile runs
  "reuseSessions": true,           // follow-up workers continue the last session
  "closeOnIssueClosed": true,      // end a task when the issue in its brief closes
  "intakeRepos": ["owner/name"],   // repos whose labeled issues become tasks; default none
  "intakeLabel": "ready-for-agent" // the label an issue must carry to be taken in
}
```

`setup` stores the config and registers one routine, `Manager: reconcile`,
deduplicated on its routine key. Rome's scheduler accepts `FREQ=MINUTELY` down
to one minute, so five minutes is a choice rather than a floor; the app snaps an
arbitrary interval to a cadence the RRULE-to-cron conversion reproduces exactly.

Then talk to the `manager` agent, or call `manager:create` directly:

```jsonc
{ "brief": "add rate limiting to the upload endpoint", "source": "<the person's message>" }
```

`manager:reconcile` also runs at the end of every person-fact action and at the
end of every worker, so a new fact is acted on immediately rather than at the
next tick. A waiting return records a future deadline, so it does not create an
immediate restart loop. New GitHub intake briefs require handling automated
review feedback and required checks before returning ready. Existing briefs
and reports are not rewritten or automatically restarted on upgrade.

## Known gaps

These are limits of what Rome exposes to an app today, not choices.

- **No detached agent run.** `system:summon` runs an agent to completion and
  returns its reply; it has no detached mode. The app gets detachment one level
  up: the runtime dispatches `manager:run_worker` with `{ detached: true }`, and
  that action holds the blocking summon. The worker is a Rome execution the
  runtime does not wait for, which is what the model needs — but Rome sees an
  action, not a session it can report on.
- **No way to stop a worker.** Nothing in `@rome-os/app-runtime` cancels a
  detached execution or an agent session. `ActionEngine.cancel(rootExecutionId)`
  exists in core and takes exactly the id `runAction` hands back, but no
  `system:*` action and no `RomeAppContext` method reaches it. So a stop is
  recorded as `Lost(why="stopped by runtime")` and the runtime stops reading
  that worker; the worker itself runs to the end. A late reply from a stopped
  worker is dropped, because the Lost already closed it. Closing this gap needs
  a `system:cancel_execution` action or a `cancel(executionId)` on
  `RomeAppContext`.
- **No working directory on summon.** `RunParams.workingDir` exists on the agent
  runner, but `system:summon` does not pass it through, and an app must go
  through summon to run another app's agent. Manager creates and validates an isolated Git worktree, then states its
  directory in every worker brief. The actual process cwd is still not
  enforced by the platform.
- **No boot-time restart detection.** An app cannot ask whether an execution it
  launched is still alive, so the runtime cannot write `Lost(why="host restart")`
  on boot. The age cap covers the same case: a worker silent past `ageCapHours`
  gets `Lost(why="silent past cap")` and is retried. The cost is latency, up to
  the cap, on a restart.
- **No person id in an action.** `getCurrentActionContext()` gives the calling
  session, agent, and channel thread, but core deliberately drops the resolved
  `SessionActor` before the context reaches app code. So a fact from a chat is
  stamped `by="guardian"` unless the channel names its sender, and the agent is
  required to pass the person's message verbatim as `source`. A guardian id
  would need `SessionActor` threaded through the projection in
  `packages/core/src/actions/context.ts`.

## The dashboard

The app ships a read-only web UI at `/apps/manager`. It is the same fold as
`manager:snapshot`, rendered:

- **Tasks** — every task with its state and position, the open Question or
  newest Report it is waiting on, or its automatic revisit reason/time, its live worker, and how many starts it has
  spent since you last spoke. Click a task for its full history and worker list
  (`/apps/manager/<taskId>`).
- **Workers** — every Started fact ever written, with the terminal fact that
  closed it (Returned / Failed / Lost), its duration, and its outcome.
- **Ledger** — the raw fact stream, newest first, filterable by kind and author.
  Expand a row for its `source`, evidence, or the worker brief.

The API behind it is two GET routes, `state` and `tasks/:id`
(`src/api/index.ts`), both computed from `src/lib/view.ts`. Nothing in the UI
writes: the four person verbs and the runtime remain the only writers.

## Layout

```
src/
├── agents/manager.yaml        the language boundary, one of two model call sites
├── api/index.ts               the dashboard's read routes
├── web/                       the dashboard (React, @rome-os/ui)
├── lib/
│   ├── facts.ts               the ledger's vocabulary
│   ├── fold.ts                facts -> states and positions
│   ├── view.ts                fold -> the dashboard's read model
│   ├── reconcile.ts           snapshot -> the list of writes and launches
│   ├── judge.ts               the other model call site
│   ├── intake.ts              labeled issues -> Created facts
│   ├── observe.ts             closed issues -> Completed / Cancelled facts
│   ├── worktree.ts            isolated Git checkout creation and validation
│   ├── worker-start.ts        prepare workspace and persist the exact brief
│   ├── prompt.ts              the worker's brief
│   ├── worker-reply.ts        shared return schema, prompt contract, bounded repair
│   ├── config.ts              settings and the routine's trigger
│   ├── identity.ts            who a person's fact is stamped with
│   └── person-fact.ts         stamp, append, reconcile
├── db/
│   ├── schema.ts              facts, config, locks
│   └── repositories/          the only way into those tables
└── actions/
    ├── setup                  config + the reconcile routine
    ├── reconcile              the runtime loop; applies reconcile's list
    ├── run-worker             one worker, dispatched detached
    ├── create reply complete cancel   the person's four verbs
    └── snapshot               read-only
```

The pure logic is unit-tested next to it — `fold.test.ts`, `reconcile.test.ts`,
`judge.test.ts`, `config.test.ts`, `observe.test.ts`, `intake.test.ts`. None of them touches a database: `reconcile`
takes a snapshot value and returns actions, and the action layer applies them.
Run them with `pnpm test`.
