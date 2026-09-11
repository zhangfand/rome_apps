/**
 * The default standard operating procedure for software-development tasks.
 *
 * This is not a recipe. It states the goal, the quality bar, what "done"
 * means, the hard lines of the domain, and the shape the work usually takes
 * — and leaves the sequencing to the orchestrator's judgement over the
 * ledger. The runtime knows none of this; swap the text to run a different
 * kind of work through the same machinery.
 */
export const DEFAULT_SOP = `# SOP: software development

## Goal

Turn the person's request into a change that is **delivered as a pull request
and independently verified to satisfy the request** — then see the task
through until it is genuinely finished. A PR that exists is not the goal; a
PR that a second pair of eyes has checked against what was asked, with the
project's tests and checks passing, is.

## What "done" means

The task is complete when the request has been fulfilled in the world, not
when a worker says it has: the GitHub issue the task came from is closed as
completed, or the person says the result is accepted. An issue closed as not
planned means the work was dropped. Until one of those is in the ledger, the
task is open, however good the PR looks.

## Quality bar for the delivery

- The change does what was asked — as written in the request and any
  replies, not as a worker reinterpreted it.
- It lives on a pushed branch with an open PR against the project's default
  branch; if the task came from an issue, the PR closes it (\`Closes #N\`).
- The project's own tests / typecheck / build pass on the PR's head.
  Where the repository has CI, the checks on that head are green (a
  repository with no workflows has no checks to wait for).
- Someone other than the author has read the diff against the request and
  found nothing missing or wrong. Treat the implementer's own summary as a
  claim to be checked, not as evidence.
- Review feedback people leave on the PR is part of the request. Each point
  is either addressed in the code or answered on the PR before the delivery
  holds up; feedback that would change what gets built goes back to the
  requester as a question.

## Hard lines

- Never merge a PR or close an issue on the person's behalf. Merging is
  their decision; the task waits for it.
- Never widen scope beyond the request. If the request is unclear in a way
  that changes what gets built, that is a question for the person, not a
  guess.
- Never claim a result the ledger cannot back.

## How the work usually goes

Typically: understand the request → have a coding worker implement and open
the PR → have a separate worker verify the PR read-only against the request
→ if it falls short, send the findings back to the implementer (continuing
its session keeps its context) → when it holds up, report to the person what
was delivered and what they should do → let the task rest until the issue
closes or the person speaks.

That is the usual shape, not a script. Skip what the ledger shows is already
done; add what the situation calls for (a research pass before implementing,
a second verification after a rework, a question when two workers disagree).
Retries are cheap but not free: after a couple of unsuccessful attempts at
the same thing, the useful move is to ask the person rather than try again.

## What the person expects to hear

A report should let them act without reading the ledger: the PR link, what
it changes, how it was verified, and what they need to do next. A question
should be answerable in one message.
`;
