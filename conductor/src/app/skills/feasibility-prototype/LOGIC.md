# Logic prototype

One self-contained HTML file that lets anyone drive a state model by clicking buttons. Use it when the question is about business rules, state transitions, or data shape: things that read fine on paper and feel wrong once pushed through real cases. Examples: a connection lifecycle, a retry and dedupe order, a routing decision table, a fail-closed selection rule.

It can't answer whether a real SDK, API, or runtime behaves as the model assumes. That question goes to [INTEGRATION.md](INTEGRATION.md).

## Build

1. **Question first.** Put the brief's question in a visible intro at the top of the page.
2. **Pure module.** Write the logic in one `<script>` block as a pure reducer, an explicit state machine, or a small set of pure functions, whichever fits the question. No DOM access inside it. The page calls it; nothing flows back. This module is the part worth lifting into production.
3. **One file.** Plain HTML, CSS, and JS inline. No framework, bundler, or server. It opens by double-click.
4. **Domain language.** Buttons and state labels read like the product, not the code, so a PM or designer can use it.
5. **Layout, top to bottom:**
   - the title and the question
   - the current state as labelled fields, re-rendered after every click, with what just changed called out
   - free-play buttons, one per action, always available
   - guided scenarios, one tab each: a plain-language setup, what to watch for, and the ordered buttons to press. Each scenario resets to a known start. Cover the happy path, the awkward edge cases, and an attempt at something that should be illegal.
6. **Restrained style.** Clean type, generous spacing, one accent colour, no animation.

## Evidence

The scenarios, their observed final states, and any "that shouldn't be possible" moment. Save the file on the prototype branch so it stays re-runnable.

## Avoid

- Wiring it to a real database or service
- Mixing the page into the logic module
- Generalising for cases the question doesn't ask about
