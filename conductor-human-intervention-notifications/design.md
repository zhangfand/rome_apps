# Conductor human-intervention notifications — discovery recommendation

**Status:** recommendation for engineering-lead selection; no product decision or code change made.

## Recommendation

Ship a deliberately narrow first delivery: **browser notifications from the
already-open Conductor web app, addressed to the current guardian**, with the
existing Board as the durable inbox and reply surface.  This is a local push
(signal appears without the guardian navigating to the Board) rather than a
background/offline Web Push service.  It is the pragmatic first channel because
Conductor already has a browser client polling `GET state` every 10 seconds,
a guardian-only reply route, and a visible **Needs you** queue. Its own app
code/configuration has no browser-push subscription, service worker, outbound
notification configuration, or recipient-directory model.

Do not claim delivery while the browser app is closed. A verified Rome platform
mobile-push action exists (documented below), but it is not a browser
`Notification` primitive and is neither granted to Conductor's agents nor
authorized for automatic event-driven use today. If closed-tab browser delivery
is required, it remains a separate Web Push/service-worker increment; if native
mobile/off-app delivery is wanted and explicitly authorized, prefer the Rome
platform action over building a second mobile-push service.

## Evidence (facts)

- An explicit human question is written as an `Asked` decision by
  `conductor:ask_person`; `report_to_person` similarly writes `Reported` and
  says it leaves the task awaiting a reply or external event.  See
  `conductor/src/core/actions/ask/index.ts`,
  `conductor/src/core/actions/report/index.ts`, and their action manifests.
- A worker can return `blocked`, `waiting`, `failed`, or `unparsed`; the lead
  then decides what happens next.  `run_job` records `Returned`/`Failed` and
  immediately reconciles; the worker-status vocabulary is in
  `conductor/src/core/lib/facts.ts` and the recording path is
  `conductor/src/core/actions/run-worker/index.ts`.
- A lost heartbeat becomes `Lost`; a failed pending-job materialization becomes
  `JobFailed`. Both are fresh input to the coordinator, not automatically a
  person request. See `conductor/src/core/actions/tick/index.ts`,
  `conductor/src/core/lib/job-scheduler.ts`, and
  `conductor/src/core/lib/fold.ts`.
- The circuit breaker writes `Event(runtime/circuit_breaker)` and deliberately
  stops future wakes until a person speaks. The Board classifies that as
  `needs-you`. See `conductor/src/core/actions/orchestrate/index.ts`,
  `conductor/src/core/lib/facts.ts`, and
  `conductor/src/web/core/lib/facts.ts`.
- The Board already presents `Asked`, `Reported`, and circuit-breaker tasks in
  **Needs you**, with answer/reply controls; the detail page polls each task
  every 8 seconds. The app-level feed polls `state` every 10 seconds. See
  `conductor/src/web/core/components/board.tsx`,
  `conductor/src/web/core/components/task-detail.tsx`, and
  `conductor/src/web/App.tsx`.
- Person replies are guardian-only over HTTP and go through
  `conductor:record_person_reply`, which stamps the person from action context
  and wakes reconciliation. The only reliable default identity is `guardian`;
  the runtime deliberately does not expose a guardian/user id to app code.
  See `conductor/src/core/api/index.ts`,
  `conductor/src/core/lib/person-fact.ts`, and
  `conductor/src/core/lib/identity.ts`.
- The **Conductor app** config and package dependencies contain no browser
  notification subscription, service worker, app-owned outbound notification
  configuration, or recipient settings. Its only configured external connector
  is GitHub used for **GET** polling through `connector:connector_proxy`; see
  `conductor/package.json`, `conductor/src/app/config.ts`, and
  `conductor/src/domain/adapters/github/client.ts`. The Rome-platform mobile
  capability discovered after this initial analysis is recorded in the next
  section.

## Rome platform capability supplement (verified 2026-09-19)

### What exists

Rome **does** provide a reusable, Rome-owned mobile-push primitive:
`system:send_notification`. The System app registers it in
`/home/rome/work/rome-1593/rome_apps/system/app.yaml`; its action definition is
`rome_apps/system/src/actions/send-notification/`. The platform checkout was at
commit `9c9142c` during this inspection.

Its agent-callable schema is exactly `{ body?: string }` (unknown keys rejected).
The title is fixed to **Rome**; there is no recipient, device id, task id, URL,
click target, priority, scheduling, or idempotency-key argument. The instance's
main process holds the instance token and `NotifyClient` POSTs to Rome Cloud
`/api/notify`; a worker only receives the classified outcome. See
`rome_apps/system/src/actions/send-notification/index.ts`,
`rome_apps/system/src/actions/send-notification/action.yaml`,
`packages/core/src/lib/notify-client.ts`, and
`packages/core/src/actions/service-proxies.ts`.

Rome Cloud derives the guardian account from that instance credential and fans
out to its registered **native mobile** devices through APNs (iOS) and FCM
(Android). No caller can name another account/device. Registered mobile clients
ask the device OS for permission and register a provider token; permission denial
is not re-prompted during that session. See
`docs/architecture/notification-delivery.md`,
`packages/mobile/src/push-registration.ts`, and `packages/mobile/README.md`.

This is not browser Web Push: the inspected platform has mobile registration
for APNs/FCM, while a search of platform source for `PushManager`, `Web Push`,
`push subscription`, and production `serviceWorker` found no browser-push
implementation (the only service-worker hit is the dashboard's mock server).
It therefore cannot make a closed Conductor browser tab receive a notification.

### Delivery, safety, and availability constraints

- `ok` returns `{attempted, sent, failed}` and means the provider accepted the
  send, **not** that the guardian saw it. The action exposes `no_devices`,
  `sent_zero`, `no_token`, `unconfigured`, `instance_reenrollment_required`,
  and `notification_outcome_unknown` as errors.
- Rome deliberately provides no queue or automatic retry. A timeout, network
  failure, malformed broker response, or post-dispatch cancellation is
  `outcome_unknown`: it may already arrive and must not be retried without a
  new explicit authorization. These rules are in the action manifest and
  `docs/architecture/notification-delivery.md`.
- `body` may appear on a lock screen and is retained in the action invocation.
  Rome Cloud owns normalization/fallback and length enforcement, but the
  no-secret rule is behavioral rather than a filter. The manifest instructs
  callers to use a concise attention cue (up to 500 Unicode code points before
  call), never raw task content or credentials.
- The action manifest calls this **USER-DIRECTED**: an agent may call it only
  after the guardian explicitly asks or authorizes notification. This is a
  documented action contract, not a `requiresApproval` flag or an input field
  that mechanically proves consent.
- It is registered by the System app but **not globally granted**: platform
  `GLOBALLY_GRANTED_ACTIONS` is empty. Conductor's `conductor`,
  `engineer-lead`, and `pm` agent YAML allow-lists do not contain
  `system:send_notification`. The action registry uses that allow-list for both
  tool display and execution. Therefore it is a platform capability but is not
  currently callable by a Conductor agent without an explicit grant or a
  purpose-built Conductor action. See
  `packages/core/src/actions/global-actions.ts`,
  `packages/core/src/core/agent-session.ts`, and
  `conductor/src/app/agents/{conductor,engineer-lead,pm}.yaml`.

### How this changes the recommendation

Keep browser-native `Notification` as the smallest **loaded-web-app** slice: it
needs only Conductor's web ownership boundary and can reuse its state polling.
It does not use Rome Cloud and should not be described as offline or
cross-device delivery.

For a later, explicitly guardian-authorized **native mobile/off-app** slice,
use `system:send_notification` rather than building a duplicate APNs/FCM
service. The narrow boundary is:

1. **Conductor owns** the durable attention predicate, opt-in/authorization
   record, fact-sequence dedupe, one safe summary body, and recording an
   attempt/outcome for operator visibility. It must suppress precursor worker
   failures exactly as this document's predicate specifies.
2. **Rome platform owns** guardian-account resolution, device registration,
   provider credentials, APNs/FCM fan-out, and provider-outcome classification.
   Conductor must not store mobile tokens or recipient/device identities.
3. Do not expose the raw system action to the lead and rely on prompt judgment
   for automatic sends. A narrowly scoped Conductor action invoked only after a
   persisted opt-in is safer; alternatively an explicit action grant plus a
   binding agent policy is required. In either design, never auto-retry
   `outcome_unknown`, and make the platform's lack of deep-link/task-id support
   explicit in acceptance.

## What counts as “needs a human”

Use a derived, intentionally conservative predicate, evaluated after a fresh
state fetch:

1. `lastDecision.kind === "Asked"` and no later person fact; **or**
2. `lastDecision.kind === "Reported"` and no later person fact; **or**
3. the latest unresolved safety event is `runtime/circuit_breaker`.

Notify only after the coordinator has recorded one of these durable facts.
Do **not** notify directly for `Returned(blocked|waiting)`, `Failed`, `Lost`,
or `JobFailed`: those facts wake the coordinator, which may recover, retry, or
wait without human involvement.  Notifying before that decision would create
false alarms and duplicate the lead's responsibility.

`Waited` is excluded in v1 because it encodes a scheduled/external revisit,
not an action requested from the guardian. It can become a later reminder
policy, with its own escalation decision.

## Proposed v1 flow

1. The existing coordinator writes `Asked`/`Reported`, or runtime writes the
   circuit-breaker `Event`, to the append-only ledger.
2. A loaded Conductor web client fetches `GET state` on its existing cadence.
   It derives the predicate above from the returned task summaries; no new
   runtime wake, ledger fact, or worker action is introduced.
3. When browser permission is `granted`, the client sends a `Notification`
   with a concise title, task id/title, and “Open Conductor to reply” body.
   A click routes to `/<taskId>`, where the existing guardian-only reply API is
   used. Do not put worker prompts, secrets, or long report details in the OS
   notification.
4. The Board remains authoritative even if permission is denied, notification
   display fails, or the browser is inactive. It continues to show the task in
   **Needs you**, and the app chrome count can surface it when the app is open.
5. After a reply, the current server path records `Reply` and triggers a
   detached reconciliation. The next state fetch no longer matches the
   predicate, so no explicit “acknowledge notification” protocol is needed for
   this v1.

### Dedupe, recipient, authorization, failure, retry

- **Dedupe key:** `taskId + ":" + attentionFact.seq`. Store it in
  browser `localStorage` after `Notification` succeeds. A changed `Asked` or
  `Reported` fact has a new sequence number and can notify again; repeated
  polls and rerenders cannot. Use browser `tag: conductor:<taskId>` so OS UI
  collapses superseded notices for one task.
- **Recipient:** only the current authenticated guardian who has opted in in
  that browser profile. Do not infer a route from `Created.by` (for example,
  `github:<login>`) or attempt to notify issue authors: current app identity
  and authorization do not prove an external messaging destination.
- **Authorization:** request browser permission only from a guardian-initiated
  UI control (not on page load), and only invoke it after the client has loaded
  the normal app state. The notification carries a task URL but must not expose
  data that is unavailable after click; existing task/reply APIs remain the
  authorization boundary.
- **Failure/retry:** an exception or `permission === "default"` leaves the
  key unrecorded, so the next successful foreground poll may retry. For
  `denied`, stop automatic prompts/notices and show a nonblocking Board hint
  explaining that the durable queue is still available. Cap an unacknowledged
  key at one browser notification per app load to avoid a failure loop.
  There is no durable delivery acknowledgement, retry while closed, or
  cross-device fan-out in this slice; metrics must call that out rather than
  interpreting “attempted” as “received.”

## Minimal rollout, observability, and tests

- Add a per-browser opt-in toggle and an experiment/feature flag defaulting
  off. Keep it guardian-scoped only; no server-side recipient preference is
  needed for v1.
- Emit structured client telemetry (or the platform's equivalent) for:
  eligibility, permission state, attempted, shown, click, denied, and thrown
  error; include task id, attention fact sequence/kind, and no message body.
  Report the Board's current needs-you count as a comparison, not delivery
  evidence.
- Start with developer/test installs. Promote only after observing zero
  duplicate notices for poll/reload cycles and no increase in unanswered
  questions caused by browser denial.
- Unit-test the pure eligibility function and dedupe-key selection: Asked,
  Reported, circuit breaker, later Reply, Waited, worker blocked, job failure,
  a changed question, and closed task.
- Component-test permission states, one notification per key across rerenders,
  replacement on a newer attention fact, click navigation, and failure/denial
  fallback. Preserve existing Board and reply API tests.

## Bounded alternatives

1. **Rome mobile push (preferred off-app phase after explicit authorization).**
   Rome already provides `system:send_notification` for the guardian's
   registered iOS/Android devices, so Conductor should use that transport rather
   than owning APNs/FCM credentials. It is not currently in Conductor's agent
   allow-list; it has no deep link/idempotency key and no automatic retry, so
   Conductor still owns consent, fact dedupe, safe body construction, and the
   no-retry policy for ambiguous outcomes.
2. **Browser Web Push + service worker.** This is the separate choice when the
   requirement is a closed browser tab rather than the Rome mobile app. It
   needs service-worker hosting, VAPID/key management, subscription storage,
   unsubscribe/privacy handling, and an API/background sender; neither
   Conductor nor the inspected Rome platform supplies it.
3. **Post a GitHub issue comment/`@mention`.** GitHub is already configured for
   intake and authenticated reads, so it can be valuable for GitHub-originated
   tasks. It excludes chat-originated work, can leak internal task context into
   a repository, requires write scopes and rate-limit/error handling, and
   overloads the issue as a notification channel. Keep it as an opt-in future
   adapter, not the default human-intervention path.
4. **Email/Slack/other chat provider.** Appropriate only after the product
   defines ownership, verified recipient mapping, consent, credential storage,
   and reply identity semantics. No such connector is configured here; adding
   one now would obscure the core “when do we need a human?” contract.

## Concrete implementation slices and acceptance checks

1. **Attention classifier and UI inbox alignment.** Extract a shared pure
   classifier from the existing web `hasOutstandingPersonDecision`/
   `isSafetyEvent` semantics. Acceptance: it returns exactly the three v1
   causes above, ignores worker/runtime precursor facts, and Board behavior is
   unchanged for existing fixtures.
2. **Guardian-controlled browser-notification adapter.** Add the toggle,
   permission request, client-side dedupe store, notification display/click
   behavior, and unavailable fallback. Acceptance: permission is never asked
   automatically; one unchanged attention fact yields at most one notice per
   browser profile/app load; a later reply suppresses it; a later question
   re-notifies; denied/error leaves the Board usable.
3. **Telemetry and rollout guard.** Add metrics and the feature flag, then
   exercise a manual test matrix in Chromium/Safari/Firefox where supported.
   Acceptance: dashboards distinguish eligible/attempted/shown/clicked/denied
   and document that closed-app delivery is unsupported.
4. **Decision gate for off-app delivery.** Before any automatic Rome mobile
   push work, obtain explicit guardian authorization to receive a notification
   after a Conductor attention fact; choose the safe cue and whether browser-
   closed-tab delivery is separately required. Acceptance: either close scope at
   browser-local notices, authorize the Rome native-mobile transport, or approve
   the separate browser Web Push subscription/outbox increment.

## Assumptions and remaining decision

- **Assumption:** “主动推送” can initially mean an OS/browser notification while
  Conductor is open; the request did not state an offline/mobile SLA. Rome's
  native mobile push is available for a later authorized scope, but is not a
  substitute for browser Web Push.
- **Assumption:** today there is one guardian security boundary, rather than a
  multi-user task-assignment model. This follows the documented identity
  limitation but should be validated by the platform owner before rollout.
- **Person-owned decision:** whether the guardian explicitly authorizes
  automatic Rome native-mobile notifications after an attention fact, and
  whether closed-browser delivery is also required. The former chooses the
  existing Rome transport; the latter may require a separate browser Web Push
  scope. Neither changes the recommended browser-local first increment.
