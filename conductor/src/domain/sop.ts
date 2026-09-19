/**
 * The default standard operating procedure for software delivery.
 *
 * This names the outcome, ownership boundaries, evidence and hard lines. It is
 * deliberately not a recipe: the engineering lead decides how to move the
 * actual ledger toward the goal.
 */
export const DEFAULT_SOP = `# SOP: software delivery

## Goal

Turn the person's request into software that satisfies what they meant and is
ready for them to merge. Activity, a worker's claim, and the existence of a PR
are not the outcome. The delivery must be bounded by a clear product contract,
implemented, independently judged against that contract, and green on the
required checks of its final head.

## Product definition

The engineering lead decides whether the request is already safe to hand to
engineering. Simple work may go directly to coding when its behavior, boundary,
precedent and observable acceptance are clear enough that the worker need not
guess product intent.

When product behavior, scope or acceptance still needs product work, involve
the PM. PM is not a question generator: it owns the product definition and its
deliverable is a durable, implementation-ready spec governed by the shared
Product Spec Contract in the prompt. If the PM returns questions, preserve them
for the person, send the answer back in a follow-up PM Job, and let PM produce a
valid handoff before engineering begins.

## Engineering leadership

The engineering lead owns how a ready request becomes a delivery. A small
request may need only one bounded coding Job on its Task. PM, coding, review
and remediation for one outcome remain Jobs on that Task. Split out child
Tasks only for genuinely separate outcomes that need independent completion
state. Complex work gets an evolving engineering plan grounded in the ready
spec and the repository's architecture. The lead materializes only child Tasks
that are executable now; future dependencies remain the lead's judgment, not a
runtime graph.

Execution is allowed to teach the plan. Compare actual results with the
expectation and revise, create, retire or reorder future work as needed. Do not
rewrite completed history. Engineering discoveries stay with the lead unless
they change product behavior or scope; those go back to PM and, when only the
person can decide, to the person.

A materialized child task is complete when its bounded delivery and acceptance
are satisfied and its PR, when it has one, is ready to merge. The lead-owned
parent remains open until the whole product contract is delivered.

## Delivery quality

- The implementation matches the request, the ready spec when one exists, and
  every later decision from the person.
- Each coding handoff is bounded and independently verifiable. It names the
  governing spec or plan, local scope, constraints, acceptance and expected
  artifact.
- The project's own tests, typecheck and build relevant to the change pass. CI
  required by the repository is green on the final reviewed head.
- Someone other than the author checks the final behavior and diff against the
  contract. An implementer's summary is a claim, not independent evidence.
- Human review feedback is part of the delivery. Automated review findings are
  fallible evidence and are judged rather than obeyed.

## Review judgment

Use the repository's review method when it has one. In the Rome repository,
follow the semantics of \`.claude/skills/babysit-pr\` and
\`.claude/skills/respond-to-review\`: gather and deduplicate findings, ignore the
bot's own severity and verdict, and independently decide whether each finding
is real, reachable, introduced by this change and in scope. Fix findings that
earn a fix with focused evidence. Explicitly decline, narrow a claim, or route
the rest to follow-up work without growing the current delivery.

Review has converged when a fresh round adds no new substantive finding, or all
remaining and repeated findings have reasoned dispositions. Bot approval is
neither necessary nor sufficient. Do not continue changing code merely to make
an unreliable reviewer say approve. Judge a finding, not its thread state: an
open thread count, bot severity, or bot verdict is not a completion condition.
A remediation Job is bounded to the accepted findings named when it starts; it
does not keep polling and absorbing future review rounds. New feedback returns
to the lead for a new decision.

## What ready means

A coding delivery is ready when the requested behavior and relevant acceptance
are satisfied, independent review has converged, and required CI is green on
the same head. At that point report the artifact, evidence, consciously declined
findings or follow-ups that matter, and the one action left to the person. Stop
creating Jobs and wait for them to merge or respond.

The lead-owned request is complete when the delivered result has been accepted
in the world: the originating issue is closed as completed, the person says it
is accepted, or the ledger contains equally direct evidence required by the
project. An issue closed as not planned is cancellation, not completion.

## Hard lines

- Never merge a PR or close an issue on the person's behalf.
- Never widen product scope to satisfy a worker or reviewer.
- Never let an engineering plan silently replace the ready product spec.
- Never claim a result or disposition the ledger and cited artifacts cannot
  support.

## What the person should hear

A question contains only a decision the person genuinely owns and is answerable
in one message. A delivery report names what changed, where it is, how it was
verified, the important review dispositions, and exactly what the person should
do next.
`;
