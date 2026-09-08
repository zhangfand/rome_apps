# Worker session reuse

Status: implemented 2026-09-07 (decided the same day).

## Why

Every worker today is started cold: `run_worker` calls `system:summon` with only
`{ agentName, prompt }`, and `buildWorkerPrompt` packs the task's whole history
into that prompt. A retry, a judge rejection, or a person's steer therefore
re-reads the repository from scratch and pays the full context again.

`system:summon` already accepts `sessionId` to resume a session and returns the
session it ran in (`{ result, sessionId, romeSession }`). Threading that through
the ledger lets a follow-up worker continue where the last one stopped, which
keeps the prior context — and the provider's prompt cache — warm.

## Rule

A follow-up worker on a task resumes the session of the newest worker on that
task whose run ended with **Returned or Failed**. It starts fresh when the
newest worker ended with **Lost**.

Lost is excluded because "stop" is not a real cancel: Rome has no app-facing
way to end a detached execution, so a worker the runtime recorded as Lost may
still be running in its session. Resuming that session concurrently would race
with it. Returned and Failed both mean the summon call itself finished, so the
session is idle.

If no eligible session exists (first worker, or the last one was Lost), the
worker starts fresh exactly as it does today.

## Ledger changes

Facts stay append-only; two payloads grow.

| Fact      | New field                    | Meaning                                              |
|-----------|------------------------------|------------------------------------------------------|
| `Started` | `resumeSessionId?: string`   | Session this worker continues; absent = fresh start. |
| `Returned`| `sessionId: string`          | Session the worker ran in, as summon reported it.    |
| `Failed`  | `sessionId?: string`         | Same; absent if summon failed before a session existed. |

One new execution fact kind:

| Fact        | Payload                                                     | Written by |
|-------------|-------------------------------------------------------------|------------|
| `Restarted` | `{ workerId, rejectedSessionId, error, prompt }`            | the worker (via `run_worker`), when a resume is rejected and it starts a fresh session instead |

`Restarted` is neither terminal nor a runtime kind: it does not close the
worker and does not move the task's position. It sits between a `Started`
that asked to resume and that worker's outcome, so the ledger says plainly
"w2 was told to resume X; X was rejected because …; w2 ran fresh with this
prompt instead." It renders in the task timeline the moment it happens, not
when the worker finishes hours later.

The ledger records both what a worker was given (`prompt`, `resumeSessionId`)
and what it left behind (`sessionId`), so a wake that re-reads the facts makes
the same choice.

## Fold

`TaskView` gains `resumableSession?: { workerId, sessionId }`: walk facts in
order; on `Returned`/`Failed` with a `sessionId`, set it; on `Lost`, clear it;
on `Restarted`, clear it if it names `rejectedSessionId`. No new state or
position — this is derived like everything else.

## Reconcile

`start(task, reason)` reads `task.resumableSession` and, when present and
`config.reuseSessions` is on, writes `resumeSessionId` onto the `Started`
fact. Every launch path benefits:

- `Returned` + judge rejected → resume, reason "the last result was not accepted"
- `Failed` under the start cap → resume, reason is the error
- `Reply` after a Report/Question → resume the worker that reported/asked
- `Reply` while a worker is running → that worker is stopped (Lost), so the
  replacement starts fresh (unchanged from today)
- `Lost` (silent past age cap) → fresh

One subtlety: a pass reads its snapshot *before* it writes. When the same pass
writes a `Lost` (age cap, or a stop on Reply/terminal) and then starts a
replacement, the snapshot's `resumableSession` may still name the session the
lost worker is running in. `reconcile` tracks the tasks it wrote a `Lost` on
during the pass and starts those fresh, so the fold's rule holds within a pass
as well as across passes.

## Prompt

`buildWorkerPrompt` takes a `resumed` flag. A resumed worker gets only the
delta: the facts newer than the resumed worker's own `Started`, plus the
reason. The session already holds the brief and earlier history; repeating it
would defeat the cache. The delta still ends with the same instructions about
the Returned summary and the `BLOCKED` prefix.

## run_worker

Pass `sessionId: started.payload.resumeSessionId` to `system:summon`. Read
`sessionId` from summon's output and stamp it on the `Returned` fact; on a
thrown/errored summon, stamp it on `Failed` when available.

### Fallback when a resume is rejected

The runner can refuse a resume (session gone, agent changed, session file
corrupt). `run_worker` must not record that as an ordinary `Failed`: the next
pass would retry, the retry would inherit the same stale `sessionId`, and the
task would burn its start cap on a session that cannot come back.

Instead, `run_worker` falls back explicitly and observably:

1. Summon with `sessionId` rejects. `run_worker` classifies the error as a
   resume rejection (the runner's "session not found"/"cannot resume" class —
   *not* an agent that ran and then threw). In practice `system:summon`
   swallows the session manager's error and reports
   `Summoned agent "…" did not provide a durable Rome session` (verified
   live with a bogus id); that phrasing is in the classifier too, and is safe
   because the classifier is only consulted when a resume was requested.
2. It builds a **full** brief with `buildWorkerPrompt({ resumed: false })` —
   the delta prompt on the `Started` assumes context the fresh session does not
   have.
3. It appends `Restarted { workerId, rejectedSessionId, error, prompt }` on the
   worker's behalf, and logs a `warn` with the same fields.
4. It summons again with no `sessionId` and the full prompt, and proceeds as
   normal; the eventual `Returned`/`Failed` carries the *new* `sessionId`.

Only one fallback per worker. If the fresh summon also fails, that is a real
`Failed`.

Fold treats `Restarted` as evidence that `rejectedSessionId` is dead: it
clears `resumableSession` if it still points there, so no later worker asks
for it again. `describeFact` renders it as
`worker w2: resume of session X rejected (error); started a fresh session`,
which is what a later worker's brief and the chat summary show.

## Config

`reuseSessions: boolean`, default `true`, set in `manager:setup` and stored with
the rest of `ManagerConfig`. Turning it off restores today's cold-start
behaviour without touching the ledger.

## Tests

- fold: `resumableSession` set by Returned/Failed, cleared by Lost and by a
  Restarted naming it, absent on a fresh task; Restarted does not close the
  live worker.
- reconcile: each launch path above emits the expected `resumeSessionId` (or
  none); `reuseSessions: false` never emits one.
- prompt: resumed brief contains only facts after the resumed worker's Started.
- run_worker: sessionId forwarded to summon and written back on Returned/Failed.
- run_worker fallback: a rejected resume appends Restarted with the full prompt
  and the rejected id, re-summons without sessionId, and the outcome carries
  the new session; a second failure is a plain Failed; a non-resume error is
  a plain Failed with no Restarted.
- facts: `describeFact` output for Restarted.

## Non-goals

- Sharing a session across tasks. Sessions are per task; a worker's context
  belongs to one brief.
- Resuming a Lost worker's session, until Rome can actually cancel a run.
