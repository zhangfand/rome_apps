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
  state. Do not manually copy the ledger into documents; the runtime-owned
  `_conductor/` artifacts described below are the sole exception. Link
  Task ids, PRs, commits, and other evidence where they help another Agent
  recover the reasoning.
- Commit and push meaningful changes before handing work to another Agent. Git
  history is the version history; update canonical files rather than creating
  `v2` or per-Agent copies.

## Workstream layout

One stable directory represents one product workstream, even when several
Tasks or Jobs contribute to it:

```text
.
├── <workstream-slug>/
│   ├── product-spec.md   # product contract; PM-owned when PM is involved
│   ├── prototype-brief.md # optional: questions a prototype must answer
│   ├── technical-spec.md # optional: durable engineering knowledge
│   └── artifacts/    # optional supporting evidence that merits its own file
├── _conductor/           # runtime-owned Task context
│   └── tasks/<task-id>/snapshot.md
├── _experiments/         # isolated, non-canonical replay/prompt experiments
│   └── replays/<task-id>/technical-spec.md
└── _evidence/        # runtime-owned snapshots of external payloads
```

- Use a short, stable, kebab-case slug derived from the outcome. Do not organize
  the repository by Agent, Worker, Run, or transient Task id.
- `product-spec.md` follows `product-spec-format.md`. Do not encode its format again
  here.
- `prototype-brief.md` follows `prototype-brief-format.md`. It is optional:
  a prototype normally states its questions in its own handoff. When a Job
  cites one, the prototype worker reads it at the cited commit.
- `technical-spec.md` follows `technical-spec-format.md`. It is optional and
  holds only durable knowledge needed to continue a delivery that spans
  several pull requests: current architecture understanding, executable and
  future work, actual outcomes, discoveries that changed the plan, and
  important review dispositions. It is not required for a change whose
  engineering handoff is already self-contained.
- `artifacts/` is optional. Add narrowly named files only when evidence or a
  decision is too substantial for the canonical spec or design. A Job's routine
  transcript and scratch notes do not belong here.
- `_evidence/` is runtime-owned. It stores structured external payloads that
  are too large for the Task ledger, keyed by stable source identity rather
  than Task, Agent, or Run id. Agents may read these files but must not edit
  them. Ledger events cite the repository path and the exact Git commit; the
  compact ledger envelope remains authoritative for ordering and deduplication.
- `_conductor/tasks/<task-id>/snapshot.md` is runtime-owned and overwritten
  whenever Conductor writes a newer ledger `Snapshot` fact. The reference-only
  Snapshot fact cites its exact repository commit and remains authoritative for
  identity, ordering, and ledger coverage; this pinned file contains the
  compacted state body. Agents may read this file but must not edit it.
- `_experiments/replays/<task-id>/technical-spec.md` is used only by a Task replay that
  explicitly names that path. It isolates prompt/decomposition experiments
  from the canonical workstream `technical-spec.md`. A replay may update its own file,
  but never promotes it automatically; a person chooses a winning experiment
  before an engineering lead reconciles useful decisions into the canonical
  workstream.

## Collaboration semantics

- Producers update the canonical artifact they own; consumers read the cited
  path and commit rather than reconstructing it from chat summaries.
- A later Agent preserves settled decisions and records revisions explicitly.
  It does not fork competing truths.
- Product discoveries go back into `product-spec.md` through its owner. Engineering
  discoveries and plan reconciliation go into `technical-spec.md` through the
  engineering lead.
