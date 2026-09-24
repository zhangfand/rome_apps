# Prototype brief format

A **prototype brief** states what a prototype must find out before production work starts. It names the question and how to tell the answer, not how to build the prototype; the prototype worker chooses that.

## File

- Path: `<slug>/prototype-brief.md` in the project's work repo, beside the product spec.
- The engineering lead writes and pushes it before creating the prototype Job, and the Job cites its path and commit. The worker reads it at that commit and never edits it.
- When the question changes after a prototype round, revise the same file; git history keeps the earlier question.
- Answers do not go here. They go in the technical spec's Prototypes section.

## Content

```markdown
# <product spec title>: prototype brief
Product spec: product-spec.md

Question: <one falsifiable sentence: the thing that, if false, changes the approach>
Hypothesis: <what we expect to be true>
Real boundary: <the SDK, API, auth flow, or runtime the answer depends on; `none` when it is a question of logic or UI shape>
Scenarios: <the few cases a person should be able to run, happy path first, then the awkward ones>
Pass: <observations that confirm the hypothesis>
Fail: <observations that refute it>
Non-goals: <what this prototype deliberately skips>
```

A brief carries one question, or at most three when one artifact can answer them all. Rank them by how much a "no" would change the plan, riskiest first.
