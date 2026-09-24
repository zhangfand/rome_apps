# Integration prototype

The thinnest real vertical slice through the boundary the approach depends on: an SDK, an external API, an OAuth or credential flow, a webhook or event delivery, a runtime or process boundary. Use it when the risk is that the outside world won't behave the way the design assumes.

Examples:
- Can Rome run one streamed agent turn and one tool-call round trip through the Pi SDK, while Pi keeps the credentials?
- Does a real Slack OAuth grant plus a signed DM or @mention event reach Rome and produce a reply in the right thread?

## Build

1. **Name the boundary.** List the real calls the question depends on, in the order the production flow makes them. Everything else is scaffolding.
2. **Go through it for real.** Call the real SDK, API, or runtime with a test account, sandbox workspace, or dedicated credentials. Stub only what the question isn't asking about, and name every stub in the handoff. A stub in place of the boundary turns this into a logic prototype and leaves the question open.
3. **Thinnest slice.** One path end to end: trigger → boundary → observable effect. No settings UI, fallback policy, or configurability unless the question is about them. A script, a CLI entry point, or a temporary route is enough.
4. **One command.** Add a named entry point, such as a `prototype:<slug>` package script or a single `node`/`tsx` file. The handoff lists the credentials or accounts it needs and where they come from.
5. **Record a trace.** Print each boundary call and its result as a timestamped event line: request shape, response or event received, the IDs used for correlation. Save one redacted run on the prototype branch.
6. **Push the risky edges.** After the happy path, run the scenarios the design most depends on: cancellation, retries and duplicate delivery, signature or permission failure, timeouts, a revoked credential. Include the ones that are cheap to trigger; name the rest as unverified.
7. **Record versions.** Note the SDK or package versions, API versions, and the environment (local, staging, which account) in the handoff.

## Safety

- Never run a prototype as, beside, or against the person's production instance, and never borrow its cloud identity, tokens, or relay. Start a running system only in the project's development environment.
- Never print, log, commit, or persist credentials, tokens, or secrets. Redact them from traces. If the design needs a credential to stay owned by another system, check that and report it as evidence.
- Use test workspaces, sandbox accounts, and side-effect-free calls. Never message real people or change shared production state to answer a prototype question.
- When a test account or credential is missing, stop, answer `not run`, and name exactly what access would let the prototype run. The Lead can ask the person for it.

## Evidence

The redacted trace, the pass or fail observation for each scenario, the versions, and a short walkthrough or screenshot when the effect is visible in another product (a Slack thread, a provider dashboard).

## Avoid

- Mocking the boundary under question
- Building production scaffolding (settings UI, migrations, config surface) before the boundary is proven
- Treating "the code compiles against the SDK types" as evidence that the SDK behaves
