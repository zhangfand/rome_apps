# Discord notices for Conductor human intervention

Size: medium

Status: ready

Intent: 探索 Conductor 在需要人工介入时主动推送通知的方案；由团队选择合适的探索方向，并提出可执行的建议。

## Outcome

When a Conductor task that originated in Discord genuinely needs its guardian to
act, the guardian receives one concise, actionable notice in the approved
origin Discord conversation when that route is still usable. The notice tells
them what action is needed and how to respond. Conductor does not use Discord
for routine task updates.

The Conductor Board remains the authoritative place to view and act on every
request. If Discord delivery is unavailable or not authorized, the request is
available on the Board rather than being sent somewhere else.

## Decisions

- This first increment is **Discord only**. It applies to tasks created from a
guardian's Discord turn that has an explicitly approved return route. A return
route is bound to that originating Discord connection and conversation; it is
not inferred from a user name, task author, repository identity, or another
chat service.
- A direct-message route is the default. An existing native Discord thread may
be used only when the guardian has explicitly approved posting the task's
action requests in that shared conversation. This consent recognizes that
other thread members can see the notice. Conductor must not create a new public
thread or post an unthreaded group notice merely to notify someone.
- A valid route is an approved guardian route to an existing Discord DM or
native thread, with an available authorized connection and permission to post.
A valid native-thread route receives the notice in that same thread; a DM route
receives it in that same DM conversation.
- “Human intervention” means Conductor cannot responsibly continue without a
specific guardian decision, answer, approval, or other stated action. It also
includes a failure only when Conductor explicitly turns that failure into such
a guardian-action request. Routine stage/progress reports, successful
completion, ordinary failure/status reporting, recoverable worker/runtime
conditions, and internal delivery diagnostics are not intervention notices.
- Notice content is limited to the task identity or concise title, the needed
action, and a safe way to answer in the conversation or use the Board. It must
not expose raw worker logs, repository paths, credentials, secrets, or full
ledger history.
- A particular unresolved intervention produces at most one visible Discord
notice. Repeated scheduling, retries, or service restarts must not create
additional visible notices for it. A later, distinct guardian-action request
may produce a new notice. If the guardian answers before its notice is sent,
that pending notice is not sent.
- A provider result that is uncertain after an attempted send is treated as
possibly visible and is not automatically resent. This favors avoiding a
duplicate action request over claiming exactly-once delivery.
- If a route is absent, revoked, deleted/archived, unauthorized, or otherwise
unavailable, Conductor does not retarget the request to another Discord
conversation or channel and does not automatically backfill the missed notice
if the route later recovers. The Board shows the outstanding action and that
Discord delivery was unavailable; later, newly raised action requests may use
a newly valid approved route.

## Scenarios

1. A guardian creates a task from an approved Discord DM. Later, Conductor
   needs the guardian to choose between stated options. The guardian gets one
   concise action-required message in that same DM and can reply there or act
   on the Board.
2. A guardian explicitly approves notices in the existing native Discord
   thread from which they create a task. When an approval is needed, the notice
   appears in that same native thread, not in its parent channel or a different
   conversation.
3. A task is created from a Discord conversation without an approved eligible
   route, from an ordinary channel that cannot be safely replied to as the
   originating thread, or from any non-Discord surface. When it needs a
   guardian, no Discord notice is sent; the Board presents the action instead.
4. Conductor records a need for intervention, then polls again or restarts
   before delivery. The guardian sees no more than one notice for that same
   unresolved request. If the guardian responds before dispatch, no stale
   notice is posted.
5. Discord rejects delivery, the connection is no longer usable, or the
   outcome of an attempted send cannot be known. Task state and the outstanding
   Board request remain intact. No automatic duplicate or alternate-channel
   post is made, and the Board makes the delivery fallback apparent.
6. A worker reports progress, a task completes, or Conductor handles a failure
   without needing the guardian. Discord stays silent. If the failure instead
   creates a clear action request for the guardian, it follows the rules above.

## Out of scope

- Progress, stage, completion, or ordinary failure notifications.
- Slack, browser notifications, mobile push, email, or any other transport.
- Cross-platform identity lookup, selecting an alternative recipient, read
  receipts, delivery guarantees, or exactly-once provider delivery.
- Adding support for ordinary Discord channel messages that lack a safe
  existing-thread return route.
- Automatic reposting of an undelivered/stale action request after a route
  recovers, and manual resend controls.

## Acceptance

- For an approved guardian Discord DM or approved native-thread route, a
  qualifying unresolved guardian-action request produces one safe, actionable
  notice in the originating conversation.
- No Discord message is produced for any non-intervention lifecycle event,
  including progress, completion, and failures that do not explicitly ask the
  guardian to act.
- A shared Discord thread is used only with explicit guardian approval; an
  ineligible, missing, or non-Discord route never causes a public/group post or
  identity-based retargeting.
- The same unresolved request is not visibly duplicated by repeated processing
  or restart, and a reply that resolves it before dispatch prevents its notice.
- Route or delivery failure leaves the request actionable on the Board and
  visibly records Discord as unavailable, without changing task state,
  auto-resending after an uncertain attempt, or sending to another channel.
- A new, separately stated guardian-action request can notify through a valid
  approved route even if an earlier request fell back to the Board.

## Evidence

The Discord route and reply constraints, existing Talk capability, authorization
risks, and Board-fallback recommendation are documented in
[`design.md`](design.md), particularly the discovery at commits `9595ac25`,
`3e3a757a`, and `4ab9d503`. That research found durable same-conversation
routing for Discord DMs/native threads, but no current Slack Talk channel or
safe ordinary-channel thread anchor; this spec deliberately confines the first
increment to those supported Discord routes.
