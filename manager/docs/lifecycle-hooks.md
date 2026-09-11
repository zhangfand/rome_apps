# User-defined Prepare and Evaluate

## Scope

Manager remains the controller. This increment adds two optional agent calls
around the existing coding worker, not a business-policy engine. Git worktrees,
GitHub intake, issue-close observation, and explicit human completion are unchanged.
No new completion checker registry, automatic merge, or automatic deployment.

Configure **More → Configuration → Prepare & Evaluate**. Each hook has an
installed `app:agent` ID and user-authored instructions. The controller supplies
context and the strict return protocol. Users do not need to write a new action
or TypeScript schema just to customize preparation or assessment.

Global defaults and individual project overrides are supported. In a project,
**Use default** inherits that stage; **Disabled** explicitly disables it; **Custom
agent and instructions** replaces it. Each definition saves atomically with the
existing optimistic config revision check. Saving does not launch workers.

## Configuration shape

`manager:setup` and the guardian configuration PATCH API accept:

```json
{
  "hooks": {
    "prepare": {
      "agent": "assistant:assistant",
      "instructions": "Read the request and relevant context. Record observable acceptance criteria and constraints. Ask about material ambiguity rather than inventing scope."
    },
    "evaluate": {
      "agent": "assistant:assistant",
      "instructions": "Independently inspect the deliverable against the recorded agreement. Return specific deficiencies for rework; distinguish unavailable evidence from a failed requirement."
    }
  }
}
```

These are examples, NOT installed defaults. Select an agent that actually has
appropriate tools and permissions. Instructions are limited to 16,000 characters
per hook; the config PATCH endpoint retains its existing total body size limit.
Supply the other setup fields as normal; setup replaces configuration, whereas
PATCH is partial. Project definitions accept their own `hooks` object:

```json
{ "hooks": { "prepare": null } }
```

This disables Prepare for that project and inherits Evaluate. Omitting a project
hook restores inheritance. An empty global hooks object disables both defaults.

## Lifecycle and durability

1. Intake snapshots the resolved hook IDs and instruction text in the task's
   existing project binding. Every intake path uses this binding (chat, issue
   polling, Board). Historical tasks do not inherit newly added hooks, even on
   legacy binding migration. Edits affect future tasks only.
2. A configured Prepare runs before implementation in a fresh session. Its
   `prepared` result becomes a durable **Prepared** fact; its sequence is the
   agreement revision. Original request and later human constraints remain
   authoritative. The task detail shows the latest agreement and its criteria.
3. The coding worker gets that agreement in addition to the original request
   and history. The existing coding execution/worktree machinery is unchanged.
4. A coding worker's `ready` result launches Evaluate when configured, instead
   of passing the summary to the legacy judge. The evaluator gets a pinned
   submission sequence and agreement sequence, plus history and the workspace.
5. `accepted` creates a Report containing the assessment and original submission
   (including its links). **It never writes Completed.** `rework` records a
   Rework fact and resumes the coding session with the missing requirements.
6. `waiting` records a durable revisit time. The next eligible pass runs the same
   phase against the same submission; evaluation waits do not redo implementation.
   `blocked` records a Question. A human Reply runs Prepare again if configured,
   then work; this deliberately treats replies as possible changes of scope.

All phases use the existing detached runner, capacity limits, heartbeat lease,
and failure handling. Prepare/Evaluate use fresh sessions; only implementation
resumes its own prior session. A phase cannot accidentally resume another phase's
session. A prepare/work/evaluate sequence is not charged as three implementation
failures. Rework is bounded by the work start cap. Evaluation waiting does not
reset the work repair budget. Infrastructure failures retry the same phase;
evaluator failure budgets are scoped to the submission under review.

Phase transitions recorded as Prepared or Rework are picked up on the next
reconcile pass (at most the configured cadence in ordinary operation). Hook calls
run outside the reconciliation lock. Invalid hook output gets one format-only
repair with the same agent and role protocol, then a Question. Missing hook
bindings fail closed, never silently fall back to the coding worker.

The callback guard rejects results after newer human steering/closure even before
Lost is recorded. Evaluations also verify their durable submission/agreement
references before reporting. No live task migration or retry is performed by
installation or configuration edits.

## Reply protocols

Prepare:

```json
{
  "outcome": "prepared",
  "brief": "Actionable task description",
  "acceptanceCriteria": ["An observable condition"],
  "constraints": ["An authority or scope limit"],
  "completionCondition": "Optional description of final acceptance"
}
```

`acceptanceCriteria` must be nonempty. `constraints` may be empty.
`completionCondition` is optional descriptive context for workers/evaluators,
not an executable completion predicate. The existing issue-close/human-complete
mechanisms still govern task closure. Prepared agreements have a 64,000-character
limit; lists are capped at 100 nonblank strings each.

Evaluate:

```json
{ "outcome": "accepted", "summary": "Findings, verification limitations, and deliverable links" }
```

or:

```json
{ "outcome": "rework", "reason": "Concrete unsatisfied requirements and evidence" }
```

Both hook phases also accept the existing waiting/blocked shapes. Work only
accepts ready/waiting/blocked, Prepare cannot accept its own result, and Evaluate
cannot return a completed outcome. Role is assigned by the controller, never by
the worker's reply. Hook definitions are not accepted in result payloads.

## Example user policy for the original missing-PR problem

Use these as editable instructions if this is the desired project policy. They
are intentionally not hard-coded into Manager:

**Prepare instructions:**

> Preserve the user's scope. For implementation requests, record that delivery
> requires committed changes, a published PR in the correct repository, and
> relevant verification evidence. For scoping/research requests, record an
> accessible document or answer instead; do not expand scoping into coding.
> Clarify materially missing behavior. Do not authorize merging or deployment.

**Evaluate instructions:**

> Inspect the recorded agreement and actual deliverable. If it requires a PR,
> verify that the PR exists, targets the correct repository/base, and contains
> the submitted work; an uncommitted worktree or a success claim alone is not
> sufficient. Request rework with the exact missing requirement. If evidence is
> temporarily unavailable, return waiting rather than inventing success or
> restarting implementation. For research, assess the requested output and its
> sources. Include usable deliverable links in the accepted report. Never merge,
> deploy, close issues, or approve on behalf of a person.

## Safety and deliberately deferred work

Hook instructions tell agents to inspect rather than implement or mutate external
business state. **This is not a new read-only sandbox.** Tool access is determined
by the selected agent; use appropriately restricted agents. Manager's reply
protocol does not grant additional permissions.

The snapshot freezes agent identity and custom instructions, not the installed
agent implementation: upgrading an agent app may change that agent. Version-pinned
extension bundles and explicit adoption of new policies by existing tasks are
future work. No new system for completion detection is introduced here.

No hooks are enabled automatically. Existing tasks—including the original two
reported Manager tasks—are not restarted or retroactively reassessed. To change
an existing task, steer it explicitly with its required deliverable; editing these
settings alone does not retrofit the hook pipeline.

## Explicit backfill of existing reports

`manager:backfill` is the opt-in exception to intake-only snapshots. Only call it
on an explicit user request. Pass selected task IDs and current Report sequences,
the revision from GET `/config`, and the user's verbatim `source` message. The
action snapshots current resolved hooks into an append-only human Reply, preserving
the original project/source binding, existing worktree, task ID and every old fact.
It refuses configuration drift, skips changed/running/closed tasks, and is idempotent
for the same report. SQLite compare-and-append also guards concurrent human edits.

Backfill runs Prepare (when configured), then Evaluate against the exact previous
work submission and the new criteria, without an intervening implementation run.
Only an explicit rework verdict resumes implementation. Accepted still creates a
Report, never Completed. Subsequent ordinary human steering invalidates the old
assessment authorization but retains the explicitly adopted hooks. Backfill is not
an automatic migration and does not change any unselected task or global setting.
