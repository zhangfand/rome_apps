---
name: feasibility-prototype
description: Build a prototype that answers the riskiest open question in an engineering approach before production work starts. Branches for state logic, UI shape, and real integration boundaries (SDKs, APIs, auth, runtimes).
---

# Feasibility prototype

A prototype is the smallest code that answers one question the approach depends on. The question decides the artifact. A prototype that answers "no" has done its job.

## Input

The question comes from your own reading of the code, or from the Job. A product spec is not required. When the Job cites a prototype brief, read it at the cited commit and do not edit it. Otherwise state the questions and how to tell each answer at the top of your handoff, so the person can check you answered the right question.

## Pick the branch

Each branch has its own file in this skill's directory, `~/.rome/*/apps/installed/conductor/active/src/app/skills/feasibility-prototype/`. Read the one you pick before building.

- **Does this state model or rule set hold up?** → [LOGIC.md](LOGIC.md). One self-contained HTML file that drives a pure state module through the awkward cases.
- **What should this look like?** → [UI.md](UI.md). Structurally different variants on the real page, switchable with `?variant=`.
- **Does the outside world behave the way the approach assumes?** → [INTEGRATION.md](INTEGRATION.md). The thinnest real vertical slice through the SDK, API, auth, or runtime boundary, with a recorded trace.

Choose by what a wrong assumption would break, and state the choice in the handoff. When the brief names a real boundary, the branch is integration, even when logic or UI questions also exist: a logic or UI prototype that never touches the real boundary cannot settle it.

## Rules for every branch

1. **Marked until approved.** Work on a `prototype/<slug>` branch, as a draft PR when a PR is needed to share it. Put `prototype` in the names of files that exist only to demonstrate. Do not merge it as a prototype. After the person approves it, a production Job evolves it into the production change: keep what fits, rewrite what does not, and remove what exists only to demonstrate.
2. **One command to try.** A person starts it with one command, or by opening one file. Put the command first in the handoff.
3. **Surface the state.** After every action, variant switch, or boundary call, show the full relevant state or the event it produced. The person has to see the evidence, not take the worker's word for it.
4. **No polish.** No test suite, no error handling beyond what keeps it runnable, no abstractions for later cases. Don't hold the handoff for CI or review bots.
5. **Stop when answered.** Once the pass or fail observations are in hand, stop building. Report a partial answer as partial, not as done.
6. **Never fake the answer.** When the environment can't exercise the question (missing credentials, no test account, no network), don't mock the thing being asked about. Answer `not run` and name the one-time check that would settle it.

## Handoff

Keep it short, in this order:

1. **Try it:** the branch or draft PR, the one command, and any one-time setup.
2. **Answer:** one row per question.

   | Question | Answer | Evidence |
   | --- | --- | --- |
   | … | yes / no / partial / not run | trace, screenshot, or observed state, with date |

3. **Problems found:** what the prototype revealed that the approach or spec must absorb.
4. **Design demonstrated:** the architecture or mechanism the prototype shows, including any part worth reusing in production and any part that must be rewritten.
5. **Estimate:** what the production work now looks like, and how it splits into pull requests when it exceeds one.
