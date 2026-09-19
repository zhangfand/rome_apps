# Exact-origin text messaging for first-party apps

Size: medium

Status: ready

Intent: 先在 Rome 平台中提供一项能力，让第一方应用只能把文本消息回发到此前收到入站 Talk 消息的确切授权会话，并给出可执行的 API 建议。

## Outcome

A Rome first-party app can capture a durable, opaque return capability while it
is handling an inbound Talk message, persist that capability with its own work,
and later send one plain-text message back to exactly that originating
conversation. It cannot inspect, construct, retarget, or use the capability to
message any other conversation.

The public app-runtime API is a narrow `OriginMessenger` capability, rather
than an exposed `TalkRouter` or a general channel-send action. Its recommended
surface is:

```ts
interface OriginMessenger {
  capture(): Promise<OriginCaptureResult>;
  send(input: {
    originRef: OriginRef;
    text: string;
    idempotencyKey: string;
  }): Promise<OriginSendResult>;
}

type OriginCaptureResult =
  | { kind: "captured"; originRef: OriginRef }
  | { kind: "unavailable" };

type OriginSendResult =
  | { kind: "accepted" }
  | { kind: "unavailable" }
  | { kind: "indeterminate" }
  | { kind: "invalid_request" };
```

`OriginRef` is serializable only as an opaque value. These names express the
public product contract; equivalent Rome naming is acceptable only if it
preserves this narrow capability and all its behavior.

## Decisions

- `capture()` succeeds only while the runtime-authenticated action lineage is
  handling an inbound Talk message on a provider that supports exact-origin
  text sending. It derives the origin from runtime context, not from action
  arguments or app-provided channel data. Outside that context, or on an
  unsupported provider, capture returns a definite unavailable result.
- A successful `OriginRef` is opaque and non-forgeable. Rome, not the app,
  owns the mapping to the connection and precise originating conversation. The
  reference may be stored and round-tripped by its receiving app, but apps
  never receive or submit a raw connection ID, conversation ID, provider token,
  or mutable route fields through this API.
- An origin reference is bound to the Rome instance and the issuing first-party
  app. The runtime identifies the app; it is never caller-supplied. A copied,
  tampered, foreign-app, foreign-instance, or otherwise invalid reference is
  treated as unavailable without revealing the original conversation or
  allowing a capability probe.
- `send()` creates a new plain-text message in the exact originating
  conversation. It does not promise a reply to a particular inbound message,
  a provider-specific thread anchor, delivery/read receipts, or provider
  formatting beyond the ordinary Talk text behavior.
- Before dispatch, Rome re-validates that the reference remains usable: its
  originating connection exists and is authorized, the source conversation is
  still authorized for return messaging, and the relevant Talk provider still
  supports the operation. A missing, revoked, disconnected, deleted, disabled,
  unsupported, invalid, foreign, or tampered route returns `unavailable`; it
  must never redirect to another connection, conversation, recipient, or
  provider.
- `send()` accepts plain non-empty text and an app-supplied non-empty
  idempotency key. Malformed input returns `invalid_request` before any send.
  Invalidity of the *reference* is intentionally reported as `unavailable`,
  not as a detailed validation error.
- `OriginSendResult` has these caller-visible delivery outcomes:
  - `accepted`: the provider accepted the new message. This is not a claim that
    it was read or received by a person.
  - `unavailable`: Rome definitively did not dispatch the message because the
    capability or source route was unusable. It returns no substitute target.
  - `indeterminate`: an attempt may have reached the provider but Rome cannot
    determine whether a visible message was created. The caller must not
    automatically retry it.
  - `invalid_request`: the text or idempotency key was invalid before a send
    attempt. This is not used to disclose reference validity.
- Rome owns durable idempotency, not the caller's process memory. The identity
  of one send is `(issuing app, Rome instance, originRef, idempotencyKey)`.
  It survives process/service restart while that reference is usable. Repeating
  the same identity returns the original recorded terminal result and must not
  make another provider send. Reusing a recorded key with different text is
  `invalid_request` and makes no provider send; a key cannot represent a
  different logical message. In particular, an `indeterminate`
  identity remains non-dispatchable on repeat, so a durable app outbox can
  record it for human/operator recovery without creating a duplicate.
- This capability is available to first-party app runtime code only in this
  increment. It is not an agent tool, a public HTTP API, or a generic
  cross-app/third-party messaging privilege. Rome must provide an app instance
  with the narrow `OriginMessenger` dependency rather than the public
  `TalkRouter` surface.

## Scenarios

1. A first-party app handles an inbound message from a supported Discord Talk
   conversation. During that handling lineage it captures an `OriginRef` and
   persists it. Hours later, it sends text with a new idempotency key; Rome
   posts one new message in that same Discord conversation and returns
   `accepted`.
2. The same app's durable outbox repeats that send after a process restart with
   the same origin reference, text, and idempotency key. Rome returns the
   recorded result and no second provider message appears.
3. An app tries to call `capture()` from a scheduled/background action, or an
   inbound Talk provider has not implemented exact-origin sending. It receives
   a definite unavailable capture result and has no connection or conversation
   identifiers with which to send elsewhere.
4. An app submits a copied or modified reference, or a different app/instance
   submits a reference it did not issue. `send()` returns `unavailable`, sends
   nothing, and reveals neither the target nor whether the original route ever
   existed.
5. The origin was captured correctly, but its connection is revoked or the
   conversation is no longer authorized before dispatch. `send()` returns
   `unavailable`; the app can use its own fallback behavior but Rome does not
   choose another recipient or conversation.
6. Rome loses confirmation after attempting provider dispatch. It returns
   `indeterminate`. Repeating the same key does not cause another send, and the
   app's outbox treats the request as possibly visible rather than blindly
   retrying it.
7. An app passes blank text or an invalid idempotency key. It receives
   `invalid_request`, and no provider attempt occurs.

## Out of scope

- Exposing `TalkRouter` list, subscribe, send, directory, history, or feature
  access to apps that receive this capability.
- Arbitrary connection/conversation targeting, recipient lookup, broadcasts,
  multi-recipient messaging, provider tokens, inbound message processing, or
  cross-app capability sharing.
- Attachments, rich cards/parts, HTML, message edits/deletes, reactions,
  activity indicators, and replies anchored to a particular provider message.
- Implementing a Discord or Slack adapter, changing provider authorization
  policy, or guaranteeing support for every current Talk provider. Future
  Discord and Slack Talk adapters may implement this same provider-neutral
  contract without new provider fields in the app API.
- Any change to Conductor's user-visible human-intervention notification
  behavior or to Conductor PR #2.

## Acceptance

- A first-party app can persist a successful opaque origin reference captured
  from an authenticated inbound Talk action and later send plain text only to
  that exact originating conversation, without receiving a raw route or token.
- A capture outside eligible inbound Talk context is definitively unavailable;
  an app cannot turn user/action input into an origin reference.
- Every send result clearly distinguishes provider acceptance, definite
  non-delivery due to unavailable origin, indeterminate post-attempt outcome,
  and malformed request before attempt.
- Revocation, disconnect, disabled/unauthorized source, unsupported provider,
  and invalid/foreign/tampered reference cause no provider send and no
  redirection. Invalid references reveal no target details.
- Durable retries with the same app, instance, origin reference, and
  idempotency key never create a second message and return the prior terminal
  result; repeated indeterminate requests do not dispatch again.
- The public first-increment interface accepts only opaque `originRef`, text,
  and idempotency key for sending, with no provider-specific input or
  reply-to-message anchor. It can therefore support future Discord and Slack
  Talk adapters without broadening app targeting authority.

## Evidence

Rome's current `TalkRouter` is provider-neutral but exposes arbitrary
connection/conversation listing and sending; it is therefore not an appropriate
app capability for this outcome. The existing `system:send_message` action
likewise accepts channel/recipient or thread targeting and is not an
exact-origin alternative. The related Conductor scope and prior delivery
research are recorded in
[`conductor-human-intervention-notifications/spec.md`](../conductor-human-intervention-notifications/spec.md)
at commit `56b5dd5c` and its
[`design.md`](../conductor-human-intervention-notifications/design.md) at
commit `4ab9d503`.
