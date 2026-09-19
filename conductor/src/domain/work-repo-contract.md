# Agent Work Repository Contract

The agent work repository is the durable, shared knowledge base for one
project's product workstreams. It complements the Task ledger and code
repository; it replaces neither.

## Repository boundary

- The runtime names the repository and local checkout in each prompt. That
  location is authoritative.
- Store product and engineering coordination artifacts here. Store product
  code, generated build output, and credentials only in their proper systems,
  never here.
- The Task ledger remains the record of events, decisions, Jobs, and execution
  state. Do not copy the ledger into documents. Link Task ids, PRs, commits, and
  other evidence where they help another Agent recover the reasoning.
- Commit and push meaningful changes before handing work to another Agent. Git
  history is the version history; update canonical files rather than creating
  `v2` or per-Agent copies.

## Workstream layout

One stable directory represents one product workstream, even when several
Tasks or Jobs contribute to it:

```text
<workstream-slug>/
├── spec.md       # product contract; PM-owned when PM is involved
├── design.md     # evolving engineering plan and decisions, when needed
└── artifacts/    # optional supporting evidence that merits its own file
```

- Use a short, stable, kebab-case slug derived from the outcome. Do not organize
  the repository by Agent, Worker, Run, or transient Task id.
- `spec.md` follows `product-spec-contract.md`. Do not encode its format again
  here.
- `design.md` is owned by the engineering lead. It holds only durable knowledge
  needed to continue the delivery: current architecture understanding,
  executable and future work, actual outcomes, discoveries that changed the
  plan, and important review dispositions. It is not required for a change
  whose engineering handoff is already self-contained.
- `artifacts/` is optional. Add narrowly named files only when evidence or a
  decision is too substantial for the canonical spec or design. A Job's routine
  transcript and scratch notes do not belong here.

## Collaboration semantics

- Producers update the canonical artifact they own; consumers read the cited
  path and commit rather than reconstructing it from chat summaries.
- A later Agent preserves settled decisions and records revisions explicitly.
  It does not fork competing truths.
- Product discoveries go back into `spec.md` through its owner. Engineering
  discoveries and plan reconciliation go into `design.md` through the
  engineering lead.
