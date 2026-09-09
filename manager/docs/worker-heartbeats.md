# Worker heartbeats

## Scope

Manager-only wrapper liveness, especially recovery after a container/host or
wrapper process dies without writing Returned/Failed. No core modifications,
model ping prompts, new routine, or production task repair during installation.
The existing scheduled reconciliation does the observation.

## Storage and lifecycle

Migration 0002 adds `manager__worker_health` to the app-owned SQLite database.
Each row is keyed by `worker_id`, with `task_id`, a unique wrapper `owner_id`,
`last_heartbeat_at`, and `expires_at` (UTC Unix milliseconds). Owner IDs prevent
another invocation of the same worker from taking over or renewing its lease.
They are not authentication credentials and are not exposed by the health API.
Historical rows are retained for inspection; terminal status comes from facts.

New Started facts carry `heartbeatProtocol: 1` (independent of replyProtocol).
The wrapper atomically claims its row BEFORE workspace validation/summon and
starts a 30-second timer, renewing a 3-minute lease throughout the initial run,
resume fallback, and reply-protocol repair. Only the wrapper renews it.
The timer stops on success, failure, unexpected exceptions, or rejected renewal.
`finally` stops it before the final reconcile call. DB write errors are logged
and retried on the next interval without pretending a write succeeded.

A crash between Started and launch is covered by a 3-minute startup grace even
without Opened or an initial heartbeat. Delayed dispatches beyond grace cannot
claim the worker. A replacement always has a new worker ID.

## Observation and races

Before external polling, reconciliation examines outstanding monitored workers.
Expiry is rechecked against current health and facts in a SQLite IMMEDIATE
transaction. It appends one Lost with last-heartbeat/expiry evidence (or the
missing-startup-heartbeat reason). It does not write fake person Replies.
Re-folding then applies the existing worker-slot and retry-cap rules; Lost
workers' sessions and worktrees are not reused under the existing policy.

Both Lost observation and Returned/Failed use transactional terminal guards.
A renewal or terminal result that commits first prevents stale observation from
writing Lost. Lost committing first prevents late results from reopening that
worker. A lease cannot renew after expiry, and duplicate dispatches cannot claim
an existing worker ID. No heartbeat is refreshed on startup, by the reconciler,
or by read-only API access.

Unreadable health storage is unknown, not absent: log and leave the worker alone.
A healthy monitored worker is not killed by the old total-worker-age cap.
Historical Started facts without heartbeatProtocol retain that legacy behavior;
there is no backfill and no forced restart of in-flight workers on upgrade.

## Timing

A lease expires 3 minutes after its last successful heartbeat (or 3 minutes
after Started if the wrapper never began). Detection waits until a reconcile
can run after that deadline: with the existing 5-minute cadence, approximately
3–8 minutes since the last beat, plus restart downtime, lock contention, and
scheduler delays. No guaranteed recovery happens while the whole service is down.

## What this does NOT establish

`alive` means the wrapper is renewing its lease, NOT proof of model progress.
A hung agent whose wrapper still responds is outside this mechanism. Event-loop
stalls, DB outages, and large wall-clock jumps can produce lease expiry even if
the old agent survives. Clock timestamps are all from the same host in this
single-instance deployment.

An expired lease is therefore suspicion of loss, not OS proof of death. The
current Manager retry policy already replaces Lost workers in isolated worktrees;
this change retains that policy. The result guard prevents duplicate ledger
outcomes but DOES NOT cancel a surviving agent or fence its external side effects
(e.g. GitHub writes). Tasks requiring strict exactly-once external effects need
idempotency/cancellation or an authoritative core execution check before retry.

## Inspection

`GET /api/apps/manager/worker-health` (guardian only) lists outstanding workers
with `taskId`, `workerId`, `status` (`legacy`, `starting`, `alive`, `expired`),
`lastHeartbeatAt` if present, and `expiresAt`. This API is read-only; failure is
an error response, not a list of dead workers. The Manager ledger continues to
show Lost and the ordinary retry/question history. No visual dashboard redesign.

## Tests

`pnpm test` includes:
- real SQLite migration and separate-connection tests, durable restart recovery,
  and a SIGKILLed fixture wrapper; no real model/task launch;
- heartbeat cadence/cleanup/error tests with controlled timers;
- wrapper wiring through quiet summon, failure, resume fallback, and reply repair;
- startup gap, duplicate claim, late renewal, completion/loss ordering, missing
  health storage, legacy workers, terminal tasks, retry caps, healthy long runs;
- guardian-only read API with no writes or leaked owner IDs.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before installing. The native
better-sqlite3 dev dependency is for real database regression tests only.
