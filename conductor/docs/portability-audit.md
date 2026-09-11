# Portability audit: what in the runtime is still software-development-specific

Date: 2026-09-11. No code was changed for this audit.

The core loop — ledger, fold, decisions with `seenSeq`, `tick` / `orchestrate`,
worker heartbeats, the semi-structured worker reply — knows nothing about git,
GitHub, PRs or CI. Development specifics live in three "world adapters" that
are currently baked in rather than pluggable, plus some prompt wording.

| area | file(s) | status | what is dev-specific |
|---|---|---|---|
| Worker workspace | `actions/dispatch`, `lib/worktree.ts` | **hard dependency** | Every dispatch creates a git worktree from `project.workingDir`; a project without a git repo cannot dispatch at all. This is the one real blocker for non-dev use. |
| Worker prompt framing | `lib/prompts.ts` → `workspaceInstructions` | dev wording in every worker prompt | Worktree / branch / LFS instructions are appended unconditionally. |
| Task intake | `lib/intake.ts`, `actions/tick` | optional, GitHub-only | Sources are chat and GitHub-labeled issues. No generic way for another system to open a task. |
| External events | `lib/observe.ts`, `lib/observe-prs.ts`, `actions/tick` | optional, GitHub-only | `issue_closed`, PR reviews / comments / checks / merge, `pr_opened` by branch prefix. Only run when a repo is configured; nothing else can push an Event. |
| Facts | `lib/facts.ts` | mostly neutral | `Created.issue` (IssueOrigin) and `Dispatched.workspace` are git/GitHub-shaped optional fields. |
| Config | `lib/config.ts` | dev defaults | `projects[].workingDir` required and must be an absolute path; `repo` / `intakeLabel`; default `workerAgents` are `coding:coding` + `assistant:assistant`; default SOP is software development. |
| Orchestrator system prompt | `agents/orchestrator.yaml` | dev wording | "runs in an isolated checkout", "GitHub issue closing; on a PR … reviews, comments, checks, merge", "may have pushed a branch or opened a PR". |
| Front-desk agent, UI | `agents/conductor.yaml`, `web/` | dev wording | Mentions GitHub issue intake; repo badge on task rows. |
| `create` action | `actions/create` | harmless | Duplicate check by GitHub issue URL in the brief. |

## Proposed changes (not done)

1. **Workspace as a per-project capability.** `projects[].workspace:
   "git-worktree" | "directory" | "none"`. `none`: dispatch creates nothing and
   the worker prompt carries no workspace block. `directory`: a plain scratch
   directory per worker, no git. `git-worktree`: today's behaviour.
2. **Generic task and event entry points.** `POST /api/apps/conductor/tasks`
   and `POST /api/apps/conductor/tasks/:id/events` (API-key protected) so any
   system — an order system, a mailbox, a ticketing tool — can open tasks and
   push Events. GitHub polling becomes one adapter among several. This is also
   the general answer to "how do external events enter the ledger".
3. **Adapter-generated runtime notes in the orchestrator prompt.** The system
   prompt keeps only identity and boundaries; the sentences about checkouts,
   PR events and pushed branches are emitted by the wake prompt only when the
   task's project actually has those adapters enabled.
4. **A second SOP as proof.** Keep the development SOP as default; add a
   non-development SOP and run it end to end. Chosen scenario: a research
   report — one worker researches, another reviews the draft, the requester
   signs off, then the task completes.

Nothing above touches the orchestrator's decision model; the same actions and
the same ledger vocabulary serve every domain.
