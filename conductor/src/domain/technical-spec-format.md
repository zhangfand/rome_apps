# Technical spec format

A **technical spec** records how a product spec gets built: the approach, the contracts between the parts, the answers prototypes found, and every choice the engineer made. It is the engineer's working record and the source of each PR's Design & Invariants section. Unlike the product spec, it names mechanism.

## File

- Path: `<slug>/technical-spec.md` in the project's work repo, beside the product spec. Links into the code repo follow the product spec's rule.
- Title: the product spec's title.
- Header, one line each: `Product spec: product-spec.md`, `Status: designing | building | in review | done | blocked`. A blocked technical spec names what it waits for in one line under Status.

## Sizes

The product spec's size decides the technical spec's sections.

| Product spec size | Technical spec |
| --- | --- |
| small | No technical spec file. The PR's Design & Invariants section is the technical spec, and decisions go in the PR description. |
| medium | Approach, Contracts when the work crosses a module, app, or package boundary, Prototypes when a prototype ran or could not, Decisions, Tasks when the work overflows. |
| large | medium, plus Model. |

A section the size does not require is absent, never empty.

## Sections

### Approach

One paragraph: the path through the code, named by the precedent it follows or departs from.

> Prefer: "Sending joins the `wechat_user` connection the way LinkedIn replies joined the LinkedIn session (#325): the outbox row is written first, the connection sends it, and history reconciliation clears it."
> Over: "We will add a send method and wire it up."

### Model

Only for a feature that adds state: its nouns, their verbs, and the rules as numbered invariants, in the vocabulary format of the `system-modeling` skill. Five nouns or fewer. Each term is defined by the property that must hold.

### Contracts

Every interface one part of the work depends on another part for: a type, an action, a route, a table, an event. One entry each, with its shape and the invariant it keeps. Tasks may run in parallel only against contracts listed here.

### Prototypes

One row per prototype: the question, the answer, the evidence. The prototype itself is deleted. A question this environment could not test gets the answer `not run` and names the one-time check that settles it.

| Question | Answer | Evidence |
| --- | --- | --- |
| Does WeChat accept a send to a contact with no chat? | Yes | Throwaway script against the sandbox account, 2026-09-18 |

### Decisions

Same table and statuses as the product spec's Decisions, with ids `E1`, `E2`, and so on. A row that revises a product spec decision names the product spec row it revises. Every row here is owned by `engineer`. A choice only the person can own is a question, not a row.

### Tasks

Present only when the build does not fit one context. Each task is a vertical slice that ends in its own PR.

```
### T2: <what a person can do after this task ships>
Proves: <product spec scenario names>
Uses: <contract names>
Blocked by: <task ids, or none>
Files: <the entry points a fresh context reads first>
```

- A task proves at least one product spec scenario, except a first task that only lands a contract others depend on.
- A task reads the product spec, this technical spec, and its Files, and nothing else. When it needs more to start, the technical spec is missing a contract.
- Fewer tasks are better. Split only where one context would overflow, and prefer sequential tasks over parallel ones unless the parallel tasks share no contract under change.

## Done

A technical spec is done when every product spec scenario is proven on an open PR, every Prototype's code is gone, and no Decision is `asked`.
