# Conductor human-intervention notifications — Discord delivery discovery

**Status:** recommendation for engineering-lead selection; discovery only, no
product decision or code change made.

**Revision (2026-09-19):** the guardian's refined outcome is direct Discord
progress and human-intervention updates, preferably in the conversation thread
that started the task. This supersedes browser-local Notification as the
recommended first delivery channel. Browser notification and Rome mobile push
remain bounded fallbacks/alternatives, not this first increment.

## Recommendation

Build a **Discord-only, origin-conversation delivery route** first. Capture an
eligible Discord route when a guardian creates a Conductor task, then emit
short, deduplicated updates through Rome's existing `send_message` transport.

Limit the first increment to a task started in a Discord **DM or existing native
Discord thread**. Those routes have a durable conversation id that Rome can send
back into without guessing. A task started in an ordinary Discord channel cannot
currently retain the initiating message id required to start/reuse a reply
thread, so it must fall back to the Conductor Board rather than post an
unthreaded group update. Do not infer a recipient from a GitHub author, task
`by`, or a Slack/Discord username.

This delivers the requested same-thread behavior where the current platform can
truthfully support it, keeps group-message disclosure opt-in, and leaves a
clean route abstraction for a later Slack transport.

## Verified current capability

### Discord inbound context and identity

- Rome's Discord adapter normalizes each accepted message as `channel:
  "discord"`, the sender's `channelUserId`, display name, provider message id,
  `threadId` (the Discord channel or thread snowflake), optional
  `parentThreadId` for a native thread, thread name/type, and an actual reply
  reference when present. See platform checkout `/home/rome/work/rome-1593` at
  commit `9c9142c`, `packages/core/src/channels/discord.ts` (especially
  `dispatchMessage`) and `packages/app-runtime-sdk/src/index.ts`
  (`NormalizedMessage`, `ThreadContext`).
- The Inbox hook preserves that route in the live agent action context:
  `connectionId`, channel, `threadId`, `parentThreadId`, Rome conversation id,
  sender id, thread metadata, and `senderBondLevel`. The platform's ordinary
  reply path sends back with the inbound provider message id. See
  `rome_apps/inbox/src/hooks/channel-message/index.ts` and
  `rome_apps/inbox/src/actions/message-handler/index.ts`.
- Person mapping/policy happens before the trusted agent path. Discord also
  has a bootstrap behavior that maps the first otherwise-unmapped Discord
  sender as guardian. That makes an explicit Conductor opt-in necessary; a
  bare Discord user id or channel context is not sufficient authorization for
  recurring group-visible task updates. See
  `rome_apps/inbox/src/actions/message-handler/index.ts` and
  `packages/core/src/channels/guardian-mapping.ts`.
- Conductor currently reads `channelContext` only to choose a project, then
  stores `Created` as `{ brief, project… }`; its ledger has no channel,
  connection, thread, parent, or initiating-message route. Later scheduled
  ticks therefore cannot reply to the originating Discord thread today. See
  `conductor/src/core/actions/create/index.ts`,
  `conductor/src/core/lib/person-fact.ts`, and
  `conductor/src/core/lib/facts.ts`.

### Discord outbound reply semantics

- Rome's reusable `system:send_message` action accepts a chat channel,
  `threadId`, optional `replyToMessageId`, and returns the provider message id
  on success. It resolves a registered Talk connection and records the outbound
  transcript best-effort. See
  `/home/rome/work/rome-1593/rome_apps/system/src/actions/send-message/index.ts`
  and `packages/app-runtime-sdk/src/index.ts` (`TalkRouter`).
- For Discord, sending to a native thread sends to that thread. For a normal
  guild text channel, `replyToMessageId` causes the adapter to create/reuse a
  Discord thread rooted at that message when auto-threading is enabled; it is
  not a generic message-reference reply. Discord text is split at 2,000
  characters. See `packages/core/src/channels/discord.ts` (`sendMessage` and
  `getOrCreateThread`).
- Current Conductor agents do **not** list `system:send_message` in their
  action allow-lists, and Rome grants no actions globally. A model should not
  be given raw arbitrary message sending merely to implement task alerts. See
  `conductor/src/app/agents/*.yaml`,
  `/home/rome/work/rome-1593/packages/core/src/actions/global-actions.ts`, and
  `packages/core/src/core/agent-session.ts`.
- `ThreadContext` does not include the inbound provider message id. Consequently
  a Conductor task can capture the Discord thread/channel id now, but cannot
  later supply an anchor to create a thread for a task started in an ordinary
  channel. `system:send_message` also does not expose `connectionId` in its
  agent-facing schema, although its implementation can resolve one connection;
  a v1 must require exactly one live Discord connection rather than guess among
  several.

### Slack: related capability, not a current Rome chat channel

- Rome currently has **no** `packages/core/src/channels/slack.ts`, Slack
  `NormalizedMessage` variant, or Slack Talk integration; `system:send_message`
  does not accept `slack`. Slack is a Rome-managed OAuth connector whose raw
  Web API is available through `connector:connector_proxy`. See
  `rome_apps/connector/app.yaml`,
  `rome_apps/connector/src/api/slack-proxy.ts`, and the `send_message` schema
  above.
- The connector can POST Slack's `chat.postMessage` using Rome-managed bot
  credentials when Slack is connected, but no current Conductor path captures a
  Slack inbound channel/thread origin or turns that call into a durable delivery
  service. A non-2xx provider response (including HTTP 429) becomes an action
  error; the current proxy does not preserve `Retry-After` for a Conductor
  outbox to schedule against. See
  `rome_apps/connector/src/actions/connector-proxy/index.ts`.
- Slack's provider API can implement the same *reply-to-origin* concept once a
  Slack ingress exists: `chat.postMessage` takes `channel` and a parent
  `thread_ts`; it requires write scope and membership as applicable. Slack
  documents a general limit of about one posted message per second per channel,
  workspace-wide limits, and HTTP 429 with `Retry-After`.
  [Slack `chat.postMessage`](https://api.slack.com/methods/chat.postMessage)
  and [Slack rate limits](https://api.slack.com/apis/rate-limits) are the
  authoritative provider references.

## Proposed platform-neutral design (inferred recommendation)

The facts above support a small Conductor-owned abstraction; it is not an
existing Rome interface:

```text
ConversationRoute
  transport: "talk" | "slack-web-api"
  connectionId: opaque Rome connection id
  channel: provider slug
  conversationId: opaque provider thread/channel id
  parentConversationId?: opaque parent id
  anchorMessageId?: provider root message id
  visibility: "guardian-dm" | "guardian-authorized-group"

DeliveryIntent
  key: taskId + triggeringFactSeq + class + routeId
  class: "progress" | "action-required"
  routeId, taskId, triggeringFactSeq, safeText
```

Persist the route at task creation only after explicit guardian opt-in. Persist
`DeliveryIntent` in a Conductor-owned outbox table with a unique key, status,
provider receipt id, timestamps, and a bounded error classification. This is
not a new task-ledger `Event`: a delivery-attempt Event would itself wake the
orchestrator and create accidental decision loops. The ledger fact remains the
durable cause; the outbox is the durable delivery/accounting record.

A dispatcher, not the engineering-lead model, reads the outbox and invokes the
single narrow Conductor delivery action. That action validates the stored route
and sends through `system:send_message` for Talk transports. A later Slack
implementation can satisfy the same contract with `chat.postMessage` and
`thread_ts`, but should be a dedicated adapter/action rather than an
unstructured model call to `connector_proxy`.

### Event classes and boundaries

- **Action-required:** `Asked` with no later person fact, and the unresolved
  `runtime/circuit_breaker` event. The message says what decision is needed and
  links or directs the guardian to reply in the conversation/Board.
- **Progress/review:** an explicit `Reported` decision. Prefix it as a progress
  update; do not call it urgent or action-required. A report can invite review,
  but the current `Reported` payload has no machine-readable urgency field.
- **Never notify directly:** `Returned(blocked|waiting)`, `Failed`, `Lost`,
  `JobFailed`, `Waited`, dispatch/session facts, and raw external events. They
  first wake the lead; the lead may recover without human intervention.

This preserves the existing rule that the lead, rather than runtime status
matching, decides what a worker outcome means. It also avoids chat spam from
routine lifecycle facts. A later product decision may add an explicit delivery
class to `Reported` if “review requested” must be distinguishable from ordinary
progress.

## Delivery and security semantics

- **Dedupe/coalescing:** one outbox row per `DeliveryIntent.key`. Repeated ticks
  cannot resend it. Coalesce pending progress intents for the same route/task to
  the newest one, but never collapse distinct unanswered `Asked` facts. A new
  fact sequence can produce a new update; a later person `Reply` cancels any
  pending action-required intent for the superseded decision.
- **Success:** record `delivered` only after the provider returns a message id.
  This is provider acceptance, not a read receipt or proof the guardian saw it.
  Preserve the returned id for a later provider-specific edit/thread feature;
  do not invent it as a universal acknowledgement.
- **Failure:** route-not-found, unavailable connection, forbidden, or a missing
  opt-in is terminal and falls back to the Board. A transport exception after a
  send attempt is `outcome-unknown`; do not automatic-retry it because Discord
  may have accepted the message. Rome's Discord adapter currently logs and
  rethrows send failures; it has no Conductor-level idempotency key. Retry only
  a clearly pre-dispatch/local failure or a guardian/operator-initiated retry.
- **Rate control:** the v1 dispatcher sends at most one update per route at a
  time and coalesces progress. Do not depend on undocumented Discord retry
  behavior. A future Slack dispatcher must honour Slack's one-message-per-
  second-per-channel guidance and `Retry-After`; the present connector proxy is
  insufficient for that because it discards 429 response headers.
- **Authorization and privacy:** capture a route only from a guardian turn and
  an explicit Conductor “send updates here” choice. Default to Discord DMs;
  a group/thread requires explicit guardian authorization because every member
  can see the content. Store provider ids as opaque route data, never tokens.
  Send a concise task title/status/required decision—not raw worker detail,
  repository paths, secrets, credentials, or full ledger history. Provider
  messages and Rome action executions are durable records, so this minimization
  applies to both display and storage.
- **No guarantee:** this is not mobile push, read tracking, delivery exactly
  once, or cross-platform identity resolution. Discord may reject a send, a
  thread may be archived/deleted, and an uncertain network outcome may already
  have produced a visible post. The Board and ledger remain authoritative.

## Recommended smallest first increment

**Discord origin-thread updates for guardian-authorized Discord DMs and native
threads, with Board fallback.**

1. At `conductor:create_task`, capture an opt-in Discord `ThreadContext` route
   only when `senderBondLevel === "guardian"`, exactly one Discord connection
   is active, and the context is a DM or native thread. Persist the opaque
   connection/thread ids with the task; do not capture ordinary group-channel
   messages because the anchor message id is unavailable.
2. Add the unique delivery outbox and a narrow Conductor dispatcher. Enqueue
   only after `Asked`, `Reported`, or circuit-breaker facts are durably written;
   use the fact sequence in the key. The dispatcher calls the bounded platform
   send path and records its receipt/status without appending a wake-causing
   ledger fact.
3. Render `Asked`/circuit breaker as action-required and `Reported` as a
   progress update. If no eligible route, connection, or permission remains,
   retain the Board state and surface a delivery-fallback diagnostic there.

Acceptance checks:

- A task opened from a guardian Discord DM or native thread receives one update
  in that same provider conversation for each eligible fact; polling/restarts do
  not duplicate it.
- A guardian reply cancels the pending action-required update and Conductor
  continues through its existing reply path.
- A task opened in a normal Discord channel, GitHub, web chat, or without
  opt-in sends no group message and remains visible on the Board.
- A rejected/unknown send never changes task state or spuriously wakes the lead;
  the outbox records the distinction and offers no automatic ambiguous retry.
- Tests cover route capture, opt-in/visibility rejection, native-thread
  dispatch, outbox uniqueness/coalescing, response-after-queue cancellation,
  successful receipt, pre-dispatch failure, and unknown failure.

## Later increments and decision

- **Slack:** first add a real Slack Talk/ingress adapter that supplies the
  workspace connection, channel id, parent `thread_ts`, sender identity, and
  authorization context. Then implement the `slack-web-api` route behind the
  same outbox contract, including 429 scheduling. A raw connector call alone is
  not an equivalent conversational transport.
- **Ordinary Discord channels:** expose/capture the inbound provider message id
  in `ThreadContext` (or a trusted conversation lookup), then use it as the
  Discord thread anchor. Do not fake thread affinity before that exists.
- **Browser/mobile:** browser Notification and Rome `system:send_notification`
  remain optional guardian-directed fallbacks. Rome mobile push is separate from
  Discord conversation delivery and cannot target an origin thread.

**Person-owned scope decision:** are direct progress and action-required
messages authorized only in the guardian's Discord DM/native threads, or may
Conductor post them to explicitly selected shared Discord threads? The
recommended default is DM/native-thread only; shared-channel delivery needs an
explicit per-route visibility consent and a content policy.
