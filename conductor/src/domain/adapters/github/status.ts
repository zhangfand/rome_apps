import type { RomeAppContext } from "@rome-os/app-runtime";
import type { TaskView } from "../../../core/lib/fold.js";
import { githubGet, type GitHubReadContext } from "./client.js";
import { pullApiPaths, pullRefsIn, type PullRef } from "./pulls.js";

export type PullRequestReviewStatus = "CHANGES_REQUESTED" | "APPROVED" | "UNREVIEWED";
export type PullRequestCiStatus = "NONE" | "PENDING" | "FAILURE" | "SUCCESS";

export interface PullRequestBranch {
  ref?: string;
  sha?: string;
}

export interface PullRequestCheckSummary {
  total: number;
  completed: number;
  failed: number;
}

/** A best-effort, read-only view. Fields stay absent when that GitHub read failed. */
export interface PullRequestStatus {
  title?: string;
  number: number;
  owner: string;
  repo: string;
  state?: "open" | "closed";
  draft?: boolean;
  merged?: boolean;
  head?: PullRequestBranch;
  base?: PullRequestBranch;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  comments?: number;
  review_comments?: number;
  total_comments?: number;
  html_url: string;
  review?: PullRequestReviewStatus;
  ci?: PullRequestCiStatus;
  checks?: PullRequestCheckSummary;
  /** Present when any read for this card failed; successfully read fields remain usable. */
  error?: string;
}

export interface PullRequestStatuses {
  checkedAt: string;
  pullRequests: PullRequestStatus[];
}

export interface PullReview {
  user?: { login?: unknown } | null;
  state?: unknown;
  submitted_at?: unknown;
}

export interface PullCheckRun {
  status?: unknown;
  conclusion?: unknown;
}

/** A shared-client-style GitHub read: failures resolve to `undefined`. */
export type PullRequestGet = (path: string, meta?: Record<string, unknown>) => Promise<unknown>;

/**
 * GitHub returns reviews oldest first. Keep only each person's latest decisive
 * opinion, exclude the PR author, then let any outstanding change request win.
 */
export function deriveReviewStatus(
  reviews: readonly PullReview[],
  author: string | undefined,
): PullRequestReviewStatus {
  const latest = new Map<string, PullRequestReviewStatus>();
  const authorKey = author?.toLowerCase();
  const ordered = reviews.map((review, index) => ({ review, index })).sort((a, b) => {
    const aTime = typeof a.review.submitted_at === "string" ? Date.parse(a.review.submitted_at) : NaN;
    const bTime = typeof b.review.submitted_at === "string" ? Date.parse(b.review.submitted_at) : NaN;
    return Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime
      ? aTime - bTime
      : a.index - b.index;
  });
  for (const { review } of ordered) {
    const login = typeof review.user?.login === "string" ? review.user.login : "";
    const state = typeof review.state === "string" ? review.state.toUpperCase() : "";
    if (!login || login.toLowerCase() === authorKey) continue;
    if (state === "APPROVED" || state === "CHANGES_REQUESTED") {
      latest.set(login.toLowerCase(), state);
    }
  }
  if ([...latest.values()].includes("CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  if ([...latest.values()].includes("APPROVED")) return "APPROVED";
  return "UNREVIEWED";
}

/** Current-head check-run rollup. Neutral and skipped completed runs are healthy. */
export function deriveCiStatus(
  runs: readonly PullCheckRun[],
): { status: PullRequestCiStatus } & PullRequestCheckSummary {
  const total = runs.length;
  const completedRuns = runs.filter((run) => run.status === "completed");
  const passing = new Set(["success", "neutral", "skipped"]);
  const failed = completedRuns.filter((run) => {
    const conclusion = typeof run.conclusion === "string" ? run.conclusion.toLowerCase() : "";
    return !passing.has(conclusion);
  }).length;
  const completed = completedRuns.length;
  const status: PullRequestCiStatus = total === 0
    ? "NONE"
    : runs.some((run) => run.status !== "completed")
      ? "PENDING"
      : failed > 0
        ? "FAILURE"
        : "SUCCESS";
  return { status, total, completed, failed };
}

/** Read at most the ten most recently introduced PR references on a task. */
export async function readPullRequests(
  task: TaskView,
  get: PullRequestGet,
  now: Date = new Date(),
): Promise<PullRequestStatuses> {
  const refs = pullRefsIn(task).slice(-10);
  const pullRequests = await Promise.all(refs.map((ref) => readOne(get, ref).catch(() => ({
    ...identity(ref),
    error: "This pull request could not be read from GitHub.",
  }))));
  return { checkedAt: now.toISOString(), pullRequests };
}

/** Runtime binding that retains connector failure logging while keeping shaping pure. */
export function readPullRequestStatuses(
  ctx: Pick<RomeAppContext, "runAction" | "log">,
  task: TaskView,
  now: Date = new Date(),
): Promise<PullRequestStatuses> {
  const readContext: GitHubReadContext = { runAction: ctx.runAction, log: ctx.log };
  return readPullRequests(task, (path, meta) => githubGet(readContext, path, meta), now);
}

async function readOne(get: PullRequestGet, ref: PullRef): Promise<PullRequestStatus> {
  const paths = pullApiPaths(ref);
  const [rawPull, rawReviews] = await Promise.all([
    get(paths.pull, { pull: ref.url, aspect: "details" }),
    get(paths.reviews, { pull: ref.url, aspect: "reviews" }),
  ]);
  const failures: string[] = [];
  const pull = record(rawPull);
  if (!pull) failures.push("details");
  const reviews = Array.isArray(rawReviews) ? rawReviews.filter(isRecord) as PullReview[] : undefined;
  if (!reviews) failures.push("reviews");

  const status: PullRequestStatus = { ...identity(ref) };
  if (pull) shapeDetails(status, pull);
  if (reviews) status.review = deriveReviewStatus(reviews, login(pull?.user));

  const headSha = status.head?.sha;
  if (headSha) {
    const rawChecks = await get(paths.checks(headSha), { pull: ref.url, aspect: "checks", headSha });
    const checks = record(rawChecks);
    if (checks && Array.isArray(checks.check_runs)) {
      const derived = deriveCiStatus(checks.check_runs.filter(isRecord));
      status.ci = derived.status;
      status.checks = { total: derived.total, completed: derived.completed, failed: derived.failed };
    } else {
      failures.push("checks");
    }
  } else {
    failures.push("checks");
  }

  if (failures.length) {
    status.error = `GitHub ${failures.join(", ")} could not be read.`;
  }
  return status;
}

function identity(ref: PullRef): Pick<PullRequestStatus, "number" | "owner" | "repo" | "html_url"> {
  return { number: ref.number, owner: ref.owner, repo: ref.repo, html_url: ref.url };
}

function shapeDetails(status: PullRequestStatus, pull: Record<string, unknown>): void {
  if (typeof pull.title === "string") status.title = pull.title;
  if (pull.state === "open" || pull.state === "closed") status.state = pull.state;
  if (typeof pull.draft === "boolean") status.draft = pull.draft;
  if (typeof pull.merged === "boolean") status.merged = pull.merged;
  const head = branch(pull.head);
  const base = branch(pull.base);
  if (head) status.head = head;
  if (base) status.base = base;
  status.additions = number(pull.additions);
  status.deletions = number(pull.deletions);
  status.changed_files = number(pull.changed_files);
  const discussion = number(pull.comments);
  const review = number(pull.review_comments);
  status.comments = discussion;
  status.review_comments = review;
  if (discussion !== undefined || review !== undefined) status.total_comments = (discussion ?? 0) + (review ?? 0);
  if (typeof pull.html_url === "string") status.html_url = pull.html_url;
}

function branch(value: unknown): PullRequestBranch | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const ref = typeof raw.ref === "string" ? raw.ref : undefined;
  const sha = typeof raw.sha === "string" ? raw.sha : undefined;
  return ref || sha ? { ref, sha } : undefined;
}

function login(value: unknown): string | undefined {
  const raw = record(value);
  return typeof raw?.login === "string" ? raw.login : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function number(value: unknown): number | undefined {
  return nonNegativeInteger(value);
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
