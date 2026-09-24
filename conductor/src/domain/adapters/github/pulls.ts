import type { Fact } from "../../../core/lib/facts.js";
import type { LedgerSnapshot, TaskView } from "../../../core/lib/fold.js";
import type { PushEventRequest } from "../../../core/lib/ingest.js";
import type { JsonArtifactDraft } from "../../work-repo-artifacts.js";

/**
 * Pull requests as a source of external events. A task that has produced a
 * PR (its URL appears in some fact) is watched: a review, a comment, a
 * completed check run, or a merge on that PR becomes one Event on the task,
 * once. This module reports everything the poll saw and keys each observation;
 * the ingest seam is what makes "once" true. As with issues, the adapter
 * transcribes; the orchestrator decides what a "changes requested" review or a
 * red check means for the task.
 */

export interface PullRef {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

const PR_RE = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g;

/** Every PR URL mentioned anywhere on the task's facts, de-duplicated by latest mention. */
export function pullRefsIn(task: TaskView): PullRef[] {
  const seen = new Map<string, PullRef>();
  for (const fact of task.facts) {
    for (const m of textOf(fact).matchAll(PR_RE)) {
      const url = `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`;
      // Moving an existing key keeps the list oldest-mentioned to newest-mentioned,
      // which lets bounded readers prefer the PRs the task spoke about most recently.
      seen.delete(url);
      seen.set(url, { owner: m[1], repo: m[2], number: Number(m[3]), url });
    }
  }
  return [...seen.values()];
}

function textOf(fact: Fact): string {
  switch (fact.kind) {
    case "Returned": return `${fact.payload.summary}\n${fact.payload.detail ?? ""}`;
    case "Reported": return fact.payload.report;
    case "Reply": return fact.payload.text;
    case "ACK": return fact.payload.summary;
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

/** What the poll learned about one PR. Everything optional: a failed sub-request just yields fewer events. */
export interface PullObservation {
  state?: "open" | "closed";
  merged?: boolean;
  mergedAt?: string;
  headSha?: string;
  reviews?: Array<{ id: number; user: string; state: string; body: string; submittedAt?: string; raw?: Record<string, unknown> }>;
  reviewComments?: Array<{ id: number; reviewId?: number; user: string; path?: string; line?: number; body: string; raw?: Record<string, unknown> }>;
  comments?: Array<{ id: number; user: string; body: string }>;
  checks?: { total: number; completed: number; runs: Array<{ name: string; status: string; conclusion?: string; url?: string }> };
}

export interface PullEventPlan {
  request: PushEventRequest;
  /** Full review evidence to commit before this request may enter the ledger. */
  artifact?: JsonArtifactDraft;
}

export function pullEvents(task: TaskView, ref: PullRef, seen: PullObservation, reviewAuthors: readonly string[]): PullEventPlan[] {
  const out: PullEventPlan[] = [];
  const event = (type: string, key: string, summary: string, data: Record<string, unknown>, artifact?: JsonArtifactDraft) => {
    out.push({
      request: {
        op: "push_event", source: "github", taskId: task.id, type, key, summary,
        cite: `conductor:reconcile_tasks, polling ${ref.url}`,
        data: { url: ref.url, ...data },
      },
      ...(artifact ? { artifact } : {}),
    });
  };

  const allowedReviewAuthors = new Set(reviewAuthors.map(normalizeLogin));
  const commentsByReview = groupReviewComments((seen.reviewComments ?? []).filter((comment) => allowedReviewAuthors.has(normalizeLogin(comment.user))));
  const capturedCommentIds = recordedReviewCommentIds(task);
  const recordedKeys = recordedGithubEventKeys(task);
  for (const r of seen.reviews ?? []) {
    if (!allowedReviewAuthors.has(normalizeLogin(r.user))) continue;
    const comments = commentsByReview.get(r.id) ?? [];
    commentsByReview.delete(r.id);
    // GitHub may reveal the authenticated reviewer's own draft. Its comments
    // are not an outside action yet, and recording the stable review id now
    // would suppress the eventual submitted state.
    if (r.state === "PENDING") continue;
    const reviewKey = `review:${r.id}`;
    if (!recordedKeys.has(reviewKey)) {
      // GitHub models a submitted review and all of its inline comments as one
      // action. Keep that boundary in the ledger instead of turning one review
      // into N comment events (and N noisy history rows).
      if (r.state === "COMMENTED" && !r.body.trim() && comments.length === 0) continue;
      event("pr_review", reviewKey, reviewSummary(ref, r, comments), {
        reviewId: r.id,
        reviewer: r.user,
        state: r.state,
        submittedAt: r.submittedAt,
        headSha: seen.headSha,
        ...reviewCommentIndex(comments),
      }, reviewArtifact(ref, seen.headSha, r, comments));
      continue;
    }

    // Upgrade/network-failure compatibility: older versions recorded the
    // review shell and each comment separately. Normally all comments are
    // already captured. If the comment read failed during that old poll, keep
    // the missing feedback without re-announcing the whole review.
    const missing = comments.filter((comment) => !capturedCommentIds.has(comment.id));
    if (missing.length) eventReviewCommentBatch(r.id, missing);
  }
  // A comment should carry pull_request_review_id, but retain feedback from an
  // incomplete GitHub response instead of dropping it.
  for (const [reviewId, comments] of commentsByReview) {
    const missing = comments.filter((comment) => !capturedCommentIds.has(comment.id));
    if (missing.length) eventReviewCommentBatch(reviewId, missing);
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

  function eventReviewCommentBatch(reviewId: number, comments: PullReviewComment[]) {
    event("pr_review_comments", `review-comments:${reviewId}`, reviewCommentsSummary(ref, comments), {
      reviewId,
      authors: [...new Set(comments.map((comment) => comment.user))],
      headSha: seen.headSha,
      ...reviewCommentIndex(comments),
    }, reviewCommentArtifact(ref, seen.headSha, reviewId, comments));
  }
}

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

type PullReview = NonNullable<PullObservation["reviews"]>[number];
type PullReviewComment = NonNullable<PullObservation["reviewComments"]>[number];

function groupReviewComments(comments: readonly PullReviewComment[]): Map<number, PullReviewComment[]> {
  const groups = new Map<number, PullReviewComment[]>();
  for (const comment of comments) {
    // GitHub supplies this for every review comment. A negative synthetic id
    // keeps malformed rows together without colliding with a real review.
    const reviewId = comment.reviewId && comment.reviewId > 0 ? comment.reviewId : -1;
    groups.set(reviewId, [...(groups.get(reviewId) ?? []), comment]);
  }
  return groups;
}

function recordedGithubEventKeys(task: TaskView): Set<string> {
  const keys = new Set<string>();
  for (const fact of task.facts) {
    if (fact.kind !== "Event" || fact.payload.source !== "github") continue;
    const key = fact.payload.data?.key;
    if (typeof key === "string") keys.add(key);
  }
  return keys;
}

function recordedReviewCommentIds(task: TaskView): Set<number> {
  const ids = new Set<number>();
  for (const fact of task.facts) {
    if (fact.kind !== "Event" || fact.payload.source !== "github") continue;
    const data = fact.payload.data;
    const legacyKey = typeof data?.key === "string" ? /^rc:(\d+)$/.exec(data.key) : undefined;
    if (legacyKey) ids.add(Number(legacyKey[1]));
    if (Array.isArray(data?.commentIds)) {
      for (const id of data.commentIds) if (typeof id === "number") ids.add(id);
    }
  }
  return ids;
}

function reviewSummary(ref: PullRef, review: PullReview, comments: readonly PullReviewComment[]): string {
  const state = review.state.toLowerCase().replaceAll("_", " ");
  const inline = comments.length ? `; ${commentCountSummary(comments.length)}` : "";
  return `${review.user} reviewed ${ref.url} (${state}${inline})`;
}

function reviewCommentsSummary(ref: PullRef, comments: readonly PullReviewComment[]): string {
  const authors = [...new Set(comments.map((comment) => comment.user))].join(", ");
  return `${authors} left ${commentCountSummary(comments.length)} on ${ref.url}`;
}

function commentCountSummary(count: number): string {
  return `${count} inline review comment${count === 1 ? "" : "s"}`;
}

function reviewCommentIndex(comments: readonly PullReviewComment[]) {
  return {
    commentCount: comments.length,
    commentIds: comments.map((comment) => comment.id),
  };
}

function reviewArtifact(ref: PullRef, headSha: string | undefined, review: PullReview, comments: readonly PullReviewComment[]): JsonArtifactDraft {
  return {
    path: reviewArtifactPath(ref, String(review.id)),
    value: {
      schema: "conductor.github.pull-review/v1",
      source: "github",
      pullRequest: pullIdentity(ref, headSha),
      review: {
        id: review.id,
        reviewer: review.user,
        state: review.state,
        body: review.body,
        ...(review.submittedAt ? { submittedAt: review.submittedAt } : {}),
      },
      comments: comments.map(reviewCommentValue),
      providerPayload: {
        review: review.raw ?? null,
        comments: comments.map((comment) => comment.raw ?? null),
      },
    },
  };
}

function reviewCommentArtifact(ref: PullRef, headSha: string | undefined, reviewId: number, comments: readonly PullReviewComment[]): JsonArtifactDraft {
  return {
    path: reviewArtifactPath(ref, reviewId > 0 ? `${reviewId}-comments` : "unbound-comments"),
    value: {
      schema: "conductor.github.pull-review-comments/v1",
      source: "github",
      pullRequest: pullIdentity(ref, headSha),
      reviewId: reviewId > 0 ? reviewId : null,
      comments: comments.map(reviewCommentValue),
      providerPayload: { comments: comments.map((comment) => comment.raw ?? null) },
    },
  };
}

function pullIdentity(ref: PullRef, headSha: string | undefined) {
  return {
    repository: `${ref.owner}/${ref.repo}`,
    number: ref.number,
    url: ref.url,
    ...(headSha ? { headSha } : {}),
  };
}

function reviewCommentValue(comment: PullReviewComment) {
  return {
    id: comment.id,
    ...(comment.reviewId ? { reviewId: comment.reviewId } : {}),
    author: comment.user,
    ...(comment.path ? { path: comment.path } : {}),
    ...(comment.line ? { line: comment.line } : {}),
    body: comment.body,
  };
}

function reviewArtifactPath(ref: PullRef, name: string): string {
  return `_evidence/github/${ref.owner}/${ref.repo}/pulls/${ref.number}/reviews/${name}.json`;
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
    checks: (sha) => `${base}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`,
  };
}

/**
 * PRs a task does not know about yet. Worker branches are named
 * `conductor/<taskId>/<workerId>`, so any open PR from such a branch belongs
 * to the task — including one opened by a worker the runtime had already
 * declared Lost, whose reply was dropped. Recording it as an Event keeps the
 * ledger honest about what exists in the repository.
 */
export function unknownTaskPulls(task: TaskView, openPulls: ReadonlyArray<{ url: string; headRef: string }>): PushEventRequest[] {
  const known = new Set(pullRefsIn(task).map((r) => r.url));
  const out: PushEventRequest[] = [];
  for (const pr of openPulls) {
    if (!pr.headRef.startsWith(`conductor/${task.id}/`)) continue;
    if (known.has(pr.url)) continue;
    const workerId = pr.headRef.split("/")[2];
    out.push({
      op: "push_event", source: "github", taskId: task.id, type: "pr_opened", key: `pr_opened:${pr.url}`,
      summary: `${pr.url} is open from this task's branch ${pr.headRef} (worker ${workerId}); no fact on this task mentioned it yet`,
      cite: "conductor:reconcile_tasks, listing pull requests on the task's branches",
      data: { url: pr.url, branch: pr.headRef, workerId },
    });
  }
  return out;
}
