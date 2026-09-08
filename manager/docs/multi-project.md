# Multiple projects, one Manager

Implemented on `feat/manager-multi-project`, in the `manager-multi-project`
worktree. Integrates the Board, worker worktrees, and structured waiting features.

## Configuration

`manager:setup` accepts either the legacy `workingDir` + `intakeRepos` shape, or:

```json
{
  "projects": {
    "rome": {
      "repo": "owner/rome",
      "workingDir": "/home/rome/.rome/default/projects/rome"
    },
    "manager": {
      "repo": "owner/apps",
      "workingDir": "/home/rome/.rome/default/projects/apps/manager"
    }
  },
  "defaultProject": "rome",
  "intakeLabel": "ready-for-agent",
  "maxWorkers": 3
}
```

Repository names above are examples. This feature installation does **not**
change the existing repo watches or enable a second repository automatically.
Setup replaces configuration; include any nondefault caps/settings to retain.
Do not mix `intakeRepos` with `projects`. A supplied legacy `workingDir` is
ignored when `projects` is present; the compatibility directory comes from
`defaultProject` (first project if omitted).

Each project has an absolute source `workingDir`, optionally a `repo`,
`intakeEnabled` (default true when repo exists), `intakeLabel` (otherwise the
global label), and `projectLabel`. Omit repo for chat-only projects, or set
`intakeEnabled: false` to keep manual/Board use without automatic intake.

Projects sharing a watched repo must have distinct `projectLabel`s, such as
`project:manager` and `project:inbox`. An issue must carry **both** its intake
label and project label. Missing or multiple matching routes produce no task;
fix the labels and the next poll retries. Repos and labels compare
case-insensitively. Different repos can use the same issue number safely.

## Human intake

`manager:snapshot` exposes the configured project map and selected chat project,
plus each task's durable binding. The Manager agent distinguishes new work from
questions or follow-ups, then calls:

```json
{
  "projectId": "manager",
  "brief": "Add project filtering to Manager.",
  "source": "<the human's exact message>"
}
```

Explicit project wins. Without it, create checks the selected chat directory
against configured directories (or project name when no directory is available).
An unmapped/ambiguous directory fails without writing anything. With no selection,
a single configured project is automatic; multiple projects require a choice.
`defaultProject` is **not** permission to guess an ambiguous human request.

The runtime stamps the author and stores `projectId` and a source-directory/repo
snapshot on `Created`. It reconciles after releasing the shared configuration
lock. If a pass is already running, create returns a retryable busy error and
writes nothing. Replies/complete/cancel use task id, never resolve a new project.
Chat and Board creation reject issues already tracked by any task, even closed
ones. Automatic intake uses the same case-insensitive issue identity.

## GitHub and Board

Each reconcile pass polls configured label conjunctions and transcribes matching
issues into the same bound `Created` facts, attributed to `github:<author>`.
The code rechecks the issue's returned labels against **all** routes rather than
trusting which query returned it. Duplicate poll results are deduplicated; PRs
are ignored. A failure in one repo does not prevent polling the others.
Comments are not steering input. Existing issue-close observation is unchanged.

Board Implement is a human ask and doesn't require the intake label, but it
still resolves by issue repo and optional project label, including manual-only
projects. An unmapped or ambiguous issue returns a routing error instead of
launching in the default checkout. The Board keeps its independent repository
selector. The dashboard project filter scopes Tasks, Workers, Ledger, attention
cards and counts; filtering happens before ledger pagination. Historic project
ids remain selectable even after removal from configuration.

## Durable routing and migration

- Before replacing settings, setup acquires the reconcile lock and appends a
  `Bound` fact for every legacy task using the **old** configuration. Reconcile
  also performs this idempotent migration before intake/scheduling.
- `Bound` is metadata: it changes neither task position nor retry budget nor the
  latest scheduling event. Historical facts are never rewritten. A partial
  migration can be retried safely. No project-specific SQL migration is needed.
- A task retains its source binding after configuration/default changes or
  project removal. Changes apply to new tasks, not existing work. To intentionally
  retarget work, stop the old task and create a new explicit ask; no retarget API
  is provided.
- Worktree preparation uses the task's pinned source directory. `Started`
  records the project, exact workspace, and exact prompt. Safe sequential runs
  reuse the same dirty tree/session; mismatched, deleted, legacy or Lost trees
  retain the existing fail-closed rules. Resume rejection gets a fresh full
  brief still bound to that workspace, never the current default repo.
- One ledger, one reconcile routine, one global `maxWorkers` budget remain.
  One task targets one project; cross-repo work needs separate tasks.

## Working on Manager itself

A Manager-targeted worker edits an isolated apps-repo worktree and works inside
its `manager` subdirectory. The installed bundle stays untouched during coding.
Worker workspace instructions forbid upgrading the running Manager unless the
task explicitly authorizes deployment. Code review and deployment are separate
decisions. The existing platform limitation remains: summon does not enforce
process cwd; the runtime creates/validates the worktree and directs the worker
there in its prompt.

## Verification

Unit and action-boundary tests cover configuration validation, explicit/selected/
ambiguous human routing, shared-repo labels, duplicate intake, provider failures,
Board routing, legacy migration ordering/idempotence, global capacity, and scoped
dashboard counts. Real temporary Git repositories exercise two simultaneous
targets, dirty-tree/session continuity after default changes, fallback prompts,
and cross-repo reuse rejection. Tests never launch a live worker or add fake
tasks to the live ledger. Run `pnpm typecheck`, `pnpm test`, `pnpm build`.
