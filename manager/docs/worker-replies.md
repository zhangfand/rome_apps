# Worker replies and waiting

Implemented in the `feat/manager-worker-waiting` worktree. The runtime schedules;
the worker checks external conditions. The Manager *agent* is only the language
boundary for a person's requests, not a relay between workers and the runtime.

## Contract

`prompt.ts` includes the shared schema and instructions from `worker-reply.ts`
on every start, resume, and fresh-session fallback. Return one JSON object,
without fences or surrounding prose:

```json
{"outcome":"ready","summary":"Result location, changes, and verification evidence"}
```

```json
{"outcome":"waiting","reason":"What is pending, where to check, and what to continue","revisitAfterSeconds":300}
```

```json
{"outcome":"blocked","question":"The concrete human decision required"}
```

The outcome names and fields are exact. Extra fields are rejected. Text must
be nonblank and at most 32,000 characters per field. Revisit delays are whole
seconds between 60 and 86,400 inclusive, without coercion or clamping. These
bounds prevent zero-delay spin and accidental extreme timers, not legitimate
longer tasks: a worker can yield repeatedly.

The brief defines delivery. The protocol prompt does **not** require PRs,
reviews, or CI for every task. For GitHub intake, those requirements live in
`deliveryTerms()` in `intake.ts`. A worker records relevant PR/head/check
pointers in its reason; the runtime stores that text without interpreting it.

## Returning and resuming

1. Reconcile appends `Started` with `replyProtocol: 1`, and launches `run_worker`.
2. `run_worker` calls `system:summon`. The worker's final text returns normally
   through that call. The worker neither sends a message to the Manager agent
   nor writes the ledger directly.
3. `run_worker` parses and validates the text against the schema also printed
   in the prompt. If invalid, it resumes that same session for **one format-only
   repair**, instructing it not to call tools or repeat the work. No session
   means no safe format repair. Repair does not create another task attempt.
4. A valid reply is stored as `Returned` with both the raw reply and its parsed
   `result`. The runner also retains the original invalid output and error if
   a repair was needed. Invalid output after repair becomes `Failed` with
   `failureKind: reply_protocol`; reconciliation asks once instead of restarting
   the same format-error loop. Ordinary execution failures retain capped retries.
5. Reconcile routes the result:
   - `ready`: grade its summary, then Report. This does not complete the task.
   - `blocked`: Question immediately. A person owes the next move.
   - `waiting`: Deferred with reason and `resumeAfter`, calculated from the
     **Returned fact's timestamp**, not the current reconciliation tick.
6. On the first existing scheduled tick with `now >= resumeAfter` and a free
   worker slot, reconcile appends Started and launches the worker. The usual
   session reuse/fallback applies. If capacity is unavailable, it stays waiting.
7. The worker checks the pending condition and does work, yields again, or
   declares ready/blocked. No external-condition check occurs in the runtime.

## Invariants and recovery

- States remain Created, Taken, Completed, Cancelled. `waiting` is a position
  inside Taken, derived from Deferred, just as reported is derived from Report.
- Returned ends the worker run. Deferred does not occupy a worker slot.
- Deferred resets the failure-attempt budget. Repeated successful waiting runs
  never hit the failure cap; genuine failures after resumption still do.
- Replaying a Returned after a crash produces the same deadline. Replaying a
  Deferred waits or starts once; subsequent ticks see Started, not Deferred.
- Existing reconciliation serialization and worker-outcome guards still apply.
  Human steering can resume before the timer. Completed/Cancelled never resume.
  A late outcome from a Lost worker is dropped, including a pending format repair.
- The existing platform gap remains: a crash between appending Started and
  dispatching its launch is recovered by the worker age cap, not a new mechanism.
- The dashboard/API/snapshot expose the reason and eligible-after time. Waiting
  is not Needs you, even if there was an older Report or Question on the task.
- Worker checks are intentionally time-driven. This does not add webhook
  subscriptions, per-task routines, or runtime review/CI adapters.

## Upgrade behavior

No SQL migration is required: fact kinds and payloads are stored as text/JSON.
`replyProtocol` is optional only to identify historical Started facts. Workers
launched under the old prose contract finish under that contract, including
ones still in flight during install. All subsequent starts/resumes use v1.
Existing reports are not reopened; existing briefs are not rewritten. Steering
an old task can explicitly extend its delivery requirements. New GitHub intake
briefs include the review/CI handoff requirements.

## Tests

`pnpm typecheck` and `pnpm test` cover schema rejection/acceptance, bounded repair,
the actual run_worker/summon boundary with stubbed provider and ledger IO,
durable deadlines, capacity, repeated waits, retry caps, session reuse/fallback,
legacy workers, human steering and termination, and dashboard projections.
These tests do not create live tasks, run coding sessions, or change PRs.
