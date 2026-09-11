import { type EventFact, type Fact, type NewFact, RUNTIME } from "./facts.js";
import type { LedgerSnapshot, TaskView } from "./fold.js";

/**
 * Pull requests as a source of external events. A task that has produced a
 * PR (its URL appears in some fact) is watched: a review, a comment, a
 * completed check run, or a merge on that PR becomes one Event on the task,
 * once. As with issues, the runtime transcribes; the orchestrator decides
 * what a "changes requested" review or a red check means for the task.
 */

export interface PullRef {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

const PR_RE = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g;

/** Every PR URL mentioned anywhere on the task's facts, de-duplicated. */
export function pullRefsIn(task: TaskView): PullRef[] {
  const seen = new Map<string, PullRef>();
  for (const fact of task.facts) {
    for (const m of textOf(fact).matchAll(PR_RE)) {
      const url = `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`;
      if (!seen.has(url)) seen.set(url, { owner: m[1], repo: m[2], number: Number(m[3]), url });
    }
  }
  return [...seen.values()];
}

function textOf(fact: Fact): string {
  switch (fact.kind) {
    case "Returned": return `${fact.payload.summary}\n${fact.payload.detail ?? ""}`;
    case "Reported": return fact.payload.report;
    case "Reply": return fact.payload.text;
    case "Noted": return fact.payload.note;
    case "Event": return fact.payload.summary;
    default: return "";
  }
}

export function pullsToWatch(snapshot: LedgerSnapshot): Array<{ taskId: string; refs: PullRef[] }> {
  return snapshot.tasks.flatMap((task) => {
    if (task.state !== "open") return [];
    const refs = pullRefsIn(task);
    return refs.length ? [{ taskId: task.id, refs }] : [];
  });
}

/** Keys of PR events already on the task, so each one is written once. */
export function recordedKeys(task: TaskView): Set<string> {
  return new Set(
    task.facts
      .filter((f): f is EventFact => f.kind === "Event" && f.payload.source === "github")
      .map((f) => String(f.payload.data?.key ?? "")),
  );
}

/** What the poll learned about one PR. Everything optional: a failed sub-request just yields fewer events. */
export interface PullObservation {
  state?: "open" | "closed";
  merged?: boolean;
  mergedAt?: string;
  headSha?: string;
  reviews?: Array<{ id: number; user: string; state: string; body: string; submittedAt?: string }>;
  reviewComments?: Array<{ id: number; user: string; path?: string; line?: number; body: string }>;
  comments?: Array<{ id: number; user: string; body: string }>;
  checks?: { total: number; completed: number; runs: Array<{ name: string; status: string; conclusion?: string; url?: string }> };
}

export function pullEvents(task: TaskView, ref: PullRef, seen: PullObservation): NewFact[] {
  const recorded = recordedKeys(task);
  const out: NewFact[] = [];
  const event = (type: string, key: string, summary: string, data: Record<string, unknown>) => {
    if (recorded.has(key)) return;
    recorded.add(key);
    out.push({
      taskId: task.id, kind: "Event", by: RUNTIME, source: `conductor:tick, polling ${ref.url}`,
      payload: { source: "github", type, summary, data: { key, url: ref.url, ...data } },
    });
  };

  for (const r of seen.reviews ?? []) {
    if (r.state === "COMMENTED" && !r.body.trim()) continue; // a review shell around inline comments
    event("pr_review", `review:${r.id}`, `${r.user} reviewed ${ref.url} (${r.state.toLowerCase().replace("_", " ")})${r.body.trim() ? `: ${clip(r.body)}` : ""}`,
      { reviewer: r.user, state: r.state, body: r.body, submittedAt: r.submittedAt });
  }
  for (const c of seen.reviewComments ?? []) {
    event("pr_review_comment", `rc:${c.id}`, `${c.user} commented on ${ref.url}${c.path ? ` at ${c.path}${c.line ? `:${c.line}` : ""}` : ""}: ${clip(c.body)}`,
      { author: c.user, path: c.path, line: c.line, body: c.body });
  }
  for (const c of seen.comments ?? []) {
    event("pr_comment", `ic:${c.id}`, `${c.user} commented on ${ref.url}: ${clip(c.body)}`, { author: c.user, body: c.body });
  }
  if (seen.checks && seen.headSha && seen.checks.total > 0 && seen.checks.completed === seen.checks.total) {
    const failed = seen.checks.runs.filter((r) => r.conclusion && !["success", "neutral", "skipped"].includes(r.conclusion));
    const conclusion = failed.length ? "failure" : "success";
    event("checks_completed", `checks:${seen.headSha}:${conclusion}`,
      `checks on ${ref.url} head ${seen.headSha.slice(0, 7)} finished: ${conclusion}${failed.length ? ` — ${failed.map((r) => `${r.name} (${r.conclusion})${r.url ? ` ${r.url}` : ""}`).join(", ")}` : ` (${seen.checks.total} run${seen.checks.total === 1 ? "" : "s"})`}`,
      { headSha: seen.headSha, conclusion, runs: seen.checks.runs });
  }
  if (seen.merged) {
    event("pr_merged", `merged:${ref.url}`, `${ref.url} was merged${seen.mergedAt ? ` at ${seen.mergedAt}` : ""}`, { mergedAt: seen.mergedAt, headSha: seen.headSha });
  } else if (seen.state === "closed") {
    event("pr_closed", `closed:${ref.url}`, `${ref.url} was closed without merging`, { headSha: seen.headSha });
  }
  return out;
}

function clip(text: string, max = 400): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function pullApiPaths(ref: PullRef): { pull: string; reviews: string; reviewComments: string; comments: string; checks: (sha: string) => string } {
  const base = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  return {
    pull: `${base}/pulls/${ref.number}`,
    reviews: `${base}/pulls/${ref.number}/reviews?per_page=100`,
    reviewComments: `${base}/pulls/${ref.number}/comments?per_page=100`,
    comments: `${base}/issues/${ref.number}/comments?per_page=100`,
    checks: (sha) => `${base}/commits/${sha}/check-runs?per_page=100`,
  };
}

/**
 * PRs a task does not know about yet. Worker branches are named
 * `conductor/<taskId>/<workerId>`, so any open PR from such a branch belongs
 * to the task — including one opened by a worker the runtime had already
 * declared Lost, whose reply was dropped. Recording it as an Event keeps the
 * ledger honest about what exists in the repository.
 */
export function unknownTaskPulls(task: TaskView, openPulls: ReadonlyArray<{ url: string; headRef: string }>): NewFact[] {
  const known = new Set(pullRefsIn(task).map((r) => r.url));
  const recorded = recordedKeys(task);
  const out: NewFact[] = [];
  for (const pr of openPulls) {
    if (!pr.headRef.startsWith(`conductor/${task.id}/`)) continue;
    if (known.has(pr.url) || recorded.has(`pr_opened:${pr.url}`)) continue;
    const workerId = pr.headRef.split("/")[2];
    out.push({
      taskId: task.id, kind: "Event", by: RUNTIME, source: "conductor:tick, listing pull requests on the task's branches",
      payload: { source: "github", type: "pr_opened", summary: `${pr.url} is open from this task's branch ${pr.headRef} (worker ${workerId}); no fact on this task mentioned it yet`,
        data: { key: `pr_opened:${pr.url}`, url: pr.url, branch: pr.headRef, workerId } },
    });
  }
  return out;
}
