import type { AdapterPollContext, AdapterPollResult, SourceAdapter } from "../../../core/lib/adapters.js";
import type { ConductorConfig } from "../../../core/lib/config.js";
import type { LedgerSnapshot } from "../../../core/lib/fold.js";
import type { IngestRequest } from "../../../core/lib/ingest.js";
import { githubGet } from "./client.js";
import { githubProject, githubRepo, githubRoot, intakeRoutes } from "./config.js";
import { claimedIssues, intakeApiPath, type IntakeIssue, intakeRequests, MAX_INTAKE_PAGES, toIntakeIssue } from "./intake.js";
import { issueEvents, type IssueStatus, issuesToWatch } from "./issues.js";
import { pullApiPaths, pullEvents, type PullObservation, pullsToWatch, unknownTaskPulls } from "./pulls.js";
import { issueApiPath } from "./refs.js";

/**
 * GitHub, as one source among several.
 *
 * Everything this app knows about issues, pull requests, reviews, checks and
 * branch names is reachable from this directory and nowhere else. The adapter
 * reads GitHub through `connector_proxy` and returns ingest requests; it holds
 * no ledger handle, writes no fact and wakes nobody. Deleting this directory
 * would leave a Conductor that still runs tasks — with no GitHub in it.
 *
 * A failed sub-request costs its own observations for this pass and nothing
 * more: fewer requests, never a wrong one.
 */
export const githubAdapter: SourceAdapter = {
  source: "github",

  enabled(config: ConductorConfig): boolean {
    return Object.values(config.projects).some((project) => Boolean(githubProject(project)));
  },

  async poll(ctx: AdapterPollContext): Promise<AdapterPollResult> {
    const requests: IngestRequest[] = [];
    requests.push(...await pollIntake(ctx));
    requests.push(...await pollIssueCloses(ctx));
    requests.push(...await pollTaskBranches(ctx));
    requests.push(...await pollPulls(ctx));
    return { requests, claimed: claimedIssues(ctx.snapshot) };
  },
};

/** One GET per page per watched repository: issues carrying an intake label. */
async function pollIntake(ctx: AdapterPollContext): Promise<IngestRequest[]> {
  const routes = intakeRoutes(ctx.config);
  if (routes.length === 0) return [];
  const issues: IntakeIssue[] = [];
  const polls = [...new Map(routes.map((r) => [JSON.stringify([r.repo, r.labels]), r])).values()];
  for (const { repo, labels } of polls) {
    for (let page = 1; page <= MAX_INTAKE_PAGES; page += 1) {
      const rows = await githubGet(ctx, intakeApiPath(repo, labels.join(","), page), { repo, page });
      if (!Array.isArray(rows)) break;
      for (const row of rows) {
        const issue = toIntakeIssue(repo, (row ?? {}) as Record<string, unknown>);
        if (issue) issues.push(issue);
      }
      if (rows.length < 100) break;
    }
  }
  return intakeRequests({ issues, label: githubRoot(ctx.config).intakeLabel, routes });
}

/** One GET per issue an open task names. */
async function pollIssueCloses(ctx: AdapterPollContext): Promise<IngestRequest[]> {
  const watches = issuesToWatch(ctx.snapshot);
  if (watches.length === 0) return [];
  const statuses = new Map<string, IssueStatus>();
  const wanted = new Map(watches.flatMap((w) => w.refs.map((ref) => [ref.url, ref] as const)));
  for (const ref of wanted.values()) {
    const issue = (await githubGet(ctx, issueApiPath(ref), { issue: ref.url })) as Record<string, unknown> | undefined;
    if (!issue || issue.pull_request) continue;
    statuses.set(ref.url, {
      state: issue.state === "closed" ? "closed" : "open",
      closedAt: typeof issue.closed_at === "string" ? issue.closed_at : undefined,
      stateReason: typeof issue.state_reason === "string" ? issue.state_reason : undefined,
    });
  }
  const byId = taskIndex(ctx.snapshot);
  return watches.flatMap((watch) => {
    const task = byId.get(watch.taskId);
    return task ? issueEvents(task, watch.refs, statuses) : [];
  });
}

/** One GET per aspect per PR the task's facts mention. */
async function pollPulls(ctx: AdapterPollContext): Promise<IngestRequest[]> {
  const watches = pullsToWatch(ctx.snapshot);
  if (watches.length === 0) return [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const login = (v: unknown) => str((v as { login?: unknown } | null)?.login) || "unknown";

  const observed = new Map<string, PullObservation>();
  const byId = taskIndex(ctx.snapshot);
  const out: IngestRequest[] = [];
  for (const watch of watches) {
    const task = byId.get(watch.taskId);
    if (!task) continue;
    for (const ref of watch.refs) {
      let seen = observed.get(ref.url);
      if (!seen) {
        const paths = pullApiPaths(ref);
        const pull = (await githubGet(ctx, paths.pull, { pull: ref.url })) as Record<string, unknown> | undefined;
        if (!pull) continue;
        seen = {
          state: pull.state === "closed" ? "closed" : "open",
          merged: pull.merged === true,
          mergedAt: str(pull.merged_at) || undefined,
          headSha: str((pull.head as { sha?: unknown } | undefined)?.sha) || undefined,
        };
        const reviews = await githubGet(ctx, paths.reviews, { pull: ref.url });
        if (Array.isArray(reviews)) seen.reviews = reviews.map((r) => ({ id: Number(r.id), user: login(r.user), state: str(r.state), body: str(r.body), submittedAt: str(r.submitted_at) || undefined }));
        const rcs = await githubGet(ctx, paths.reviewComments, { pull: ref.url });
        if (Array.isArray(rcs)) seen.reviewComments = rcs.map((c) => ({ id: Number(c.id), user: login(c.user), path: str(c.path) || undefined, line: typeof c.line === "number" ? c.line : undefined, body: str(c.body) }));
        const ics = await githubGet(ctx, paths.comments, { pull: ref.url });
        if (Array.isArray(ics)) seen.comments = ics.map((c) => ({ id: Number(c.id), user: login(c.user), body: str(c.body) }));
        if (seen.headSha) {
          const checks = (await githubGet(ctx, paths.checks(seen.headSha), { pull: ref.url })) as { check_runs?: unknown } | undefined;
          if (checks && Array.isArray(checks.check_runs)) {
            const runs = checks.check_runs.map((r) => ({ name: str(r.name), status: str(r.status), conclusion: str(r.conclusion) || undefined, url: str(r.html_url) || undefined }));
            seen.checks = { total: runs.length, completed: runs.filter((r) => r.status === "completed").length, runs };
          }
        }
        observed.set(ref.url, seen);
      }
      out.push(...pullEvents(task, ref, seen));
    }
  }
  return out;
}

/** One list per repository: open PRs whose head branch names one of our tasks. */
async function pollTaskBranches(ctx: AdapterPollContext): Promise<IngestRequest[]> {
  const open = ctx.snapshot.tasks.filter((t) => t.state === "open" && githubRepo(t.project));
  if (!open.length) return [];
  const byRepo = new Map<string, typeof open>();
  for (const task of open) {
    const repo = githubRepo(task.project)!.toLowerCase();
    byRepo.set(repo, [...(byRepo.get(repo) ?? []), task]);
  }
  const out: IngestRequest[] = [];
  for (const [repo, tasks] of byRepo) {
    const [owner, name] = repo.split("/");
    const rows = await githubGet(ctx, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=open&per_page=100`, { repo });
    if (!Array.isArray(rows)) continue;
    const pulls = rows.flatMap((r) => {
      const url = typeof r.html_url === "string" ? r.html_url : "";
      const headRef = typeof r.head?.ref === "string" ? r.head.ref : "";
      return url && headRef ? [{ url, headRef }] : [];
    });
    for (const task of tasks) out.push(...unknownTaskPulls(task, pulls));
  }
  return out;
}

function taskIndex(snapshot: LedgerSnapshot) {
  return new Map(snapshot.tasks.map((task) => [task.id, task]));
}
