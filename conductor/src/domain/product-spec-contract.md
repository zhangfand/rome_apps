# Product Spec Contract

This is the authoritative contract for product specs in this workflow. Agent
prompts define responsibilities; they do not redefine this artifact.

## Location and identity

- The canonical artifact is `<slug>/spec.md` in the project's agent work
  repository. It must be committed and pushed before handoff.
- The document starts with a title and these fields:

  `Size: small | medium | large`

  `Status: draft | ready`

  `Intent: <the person's request in their own words>`

- A path, commit, and status identify the handoff. A chat summary is not a
  substitute for the file.

## Size semantics

Size describes product scope and coordination complexity, not lines of code,
elapsed time, or implementation difficulty.

- `small` — one bounded behavior change with a clear existing precedent. Its
  scenarios and acceptance can be understood as one implementation slice, with
  no meaningful product decomposition.
- `medium` — one coherent outcome with several interacting scenarios,
  boundaries, or product decisions. Engineering may need an explicit design or
  coordinated changes, but the result is still useful as one delivery.
- `large` — a broad outcome containing multiple meaningful increments, major
  cross-cutting behavior, or substantial product uncertainty. The spec must
  name an appetite and independently valuable increments so the engineering
  lead can plan and materialize work without treating the whole scope as one
  undifferentiated change.

Choose the smallest size whose definition remains honest. Change it when
settled scope crosses one of these boundaries.

## Product content

Every spec contains:

- **Outcome** — the observable result from the person's perspective.
- **Scenarios** — concrete examples of behavior, including important edge or
  failure behavior when it affects the product.
- **Out of scope** — the boundary of this change.
- **Acceptance** — observable evidence by which downstream Agents can judge the
  delivered behavior.

Add **Decisions**, **Open questions**, precedent, evidence, terminology, or
alternatives only when they carry information needed for this change.
**Appetite** and **Increments** are required for a large spec and otherwise
optional. The spec defines product behavior and constraints, not an
implementation plan; it should remain true through a behavior-preserving
refactor.

## Status semantics

- `draft` means at least one product decision, scope boundary, scenario, or
  acceptance condition is not settled. Any person-owned question is explicit
  and option-shaped.
- `ready` means the file alone is a safe downstream contract: the outcome is
  settled, no admitted open question remains, scenarios and scope agree,
  acceptance covers the intended behavior, and every person-owned decision has
  been incorporated.
- A person's answer does not promote a draft by itself. The producer must
  incorporate the answer into the file, update its status, commit, and push it.

## Producer and consumer obligations

- The PM owns the product meaning and is the producer unless a Job explicitly
  names another producer.
- The engineering lead decides whether a spec is required and accepts only a
  handoff that satisfies this contract.
- Coding, design, review, and verification Agents consume the cited version of
  the file. They do not reconstruct intent from a summary or silently settle a
  draft's open product question.
- Discoveries that change observable behavior or scope return to the product
  contract; implementation detail belongs in the engineering plan instead.
