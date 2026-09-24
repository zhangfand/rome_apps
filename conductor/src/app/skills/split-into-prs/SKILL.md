---
name: split-into-prs
description: Split work that exceeds one reviewable pull request into the independent pull requests that can open today while keeping main releasable after each one.
---

Split the work into the pull requests that can open today. When an approved prototype exists, use it as an incomplete reference implementation and keep its code where it already fits. Main stays releasable after each PR.

Every PR is one of two kinds:
- behavior: proves at least one scenario of the request end to end, from the entry point a person uses to the effect they observe. Name the scenarios it proves.
- preparatory: changes no observable behavior. Refactors, modules nothing calls yet, backwards-compatible schema additions, an adapter capability with no entry point. Name the scenario it prepares for.

Pick every PR that needs nothing unmerged and touches no file another PR in this round touches. Prefer a preparatory PR when the behavior PR would exceed 400 lines of non-test diff. The PR that wires the entry point opens only when everything it needs is on main.

Every PR, behavior or preparatory, carries at most 400 lines of hand-written non-test diff. Generated files and lockfiles do not count. When a candidate exceeds the limit, keep only the smallest coherent part that unlocks the next decision and leave abstractions needed only by later, unplanned behavior out of this round.

Open the PRs that can open now. For each, give the Conventional Commit title, the kind, the scenarios proven or prepared for, and the test that proves it. List every PR that cannot open yet under `next` in your reply's `detail`, with what it waits on; do not plan beyond what the request needs.

When every scenario of the request is already proven on main, open nothing and say so.
