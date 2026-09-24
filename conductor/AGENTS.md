# Conductor — guidance for agents changing this app

Read `README.md` for the architecture. This file lists the design principles a
change must keep, and how to verify one.

## Design principles

1. **The workflow is a prompt, not a state machine.** Agent system prompts
   state each Agent's responsibility, quality bar, hard lines, and handoff
   boundaries. They do not enumerate what to do in each case; bound behaviour
   with tools and vocabulary instead of recipes.
2. **The runtime observes; Agents decide.** Runtime code transcribes facts,
   keeps freshness, schedules Jobs, and enforces infrastructure limits
   (slots, leases, the circuit breaker). It never makes a workflow decision
   on a Task's behalf.
3. **The ledger is the one source of truth.** It is append-only; commands that
   depend on state are conditional writes against the newest fact the caller
   saw.
4. **Handoffs carry references, not content.** Anything one Agent produces
   for another (a worker's report, a product spec, review evidence, a
   snapshot) lives in a durable artifact pinned by repository, path, and
   commit. A fact, a wake prompt, or a Job instruction carries only a short
   summary, structured fields, and that reference. The next Agent reads the
   artifact when it needs the content; no Agent restates another's output.
   This keeps prompts small, stops lossy paraphrase, and avoids paying for
   the same text in every context it passes through.
   - Worker replies: the reply block holds the generic result (`status`,
     `summary`) and a job-specific structured `detail`. The runtime stores the
     free-form report in the work repository and the Returned fact cites it.
   - A coordinator writes instructions only for what no artifact already
     carries.
   - Without a work repository, content falls back to the ledger; do not
     design a feature that needs the inline copy.
5. **Keep coherent work with one worker.** The Agent that first reads the code
   decides what the request needs (product definition, a prototype, or
   implementation), and the coder that opened a pull request answers its
   review. Add a handoff only when a different responsibility is needed.
6. **Layer dependencies.** `src/core/` never imports `src/domain/` or
   `src/app/`, and `src/domain/` never imports `src/app/`
   (`src/core/boundary.test.ts`). Domain features reach core through
   `CoreComposition` seams.

## Verifying a change

- `pnpm exec tsc --noEmit` and `pnpm exec rstest` from this directory.
- `src/app/agents/agents.test.ts` pins the load-bearing wording of each Agent
  prompt. When you change a policy, change its test in the same commit, so the
  test states the new policy rather than being deleted.
- Changing the stored worker roster defaults needs a migration entry in
  `src/app/config.ts` for the previous exact roster.
