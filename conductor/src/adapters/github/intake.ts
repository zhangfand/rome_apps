import { type CreatedFact, originOf } from "../../lib/facts.js";
import type { LedgerSnapshot } from "../../lib/fold.js";
import type { OpenTaskRequest } from "../../lib/ingest.js";
import { type IntakeRoute, routeIssue } from "../../lib/projects.js";
import { issueRefsIn } from "./refs.js";

/**
 * Taking a task in from GitHub. A chat is not the only place a person asks
 * for work: an issue carrying the intake label in a watched repository is the
 * same ask, written down where the code lives. The adapter transcribes it —
 * the issue's title and body become the brief, its author becomes the actor,
 * and the issue is cited — and hands it to the ingest seam, which writes the
 * `Created` fact. It decides nothing about the work.
 *
 * Everything here is pure. The adapter lists the labeled issues and hands them
 * in; this module decides what to ask for.
 *
 * - One task per issue, ever. The seam enforces that on `(github, issue url)`;
 *   this module adds the case the seam cannot see — an issue a person named in
 *   a brief they typed in chat, which is the same ask under another door.
 *   Re-labeling an issue does not reopen work; a person asks in chat for that.
 * - The brief names the issue, so the close watch (`issues.ts`) ends the task
 *   when the issue closes. Intake and ending are one contract.
 * - Pull requests answer on the issues endpoint too; they are not asks and
 *   are skipped.
 */

/** One labeled issue, as the poll saw it. */
export interface IntakeIssue {
  url: string;
  /** `owner/name`. */
  repo: string;
  number: number;
  title: string;
  body: string;
  /** GitHub login of the author. */
  author: string;
  state: "open" | "closed";
  isPullRequest: boolean;
  labels?: string[];
}

/**
 * Longest issue body carried into a brief. The brief is stored on every
 * Created and read by every worker; a body past this is cut with a pointer
 * back to the issue, which the worker can read in full.
 */
export const MAX_BODY_CHARS = 6000;

/** The seam's origin key for an issue. */
export function issueOriginKey(url: string): string {
  return url.toLowerCase();
}

/**
 * Issues that already have a task for a reason the ledger's origin keys do not
 * record: a person opened the task in chat and named the issue in the brief.
 * Keyed for the seam (`github:<url>`), valued with the task that holds it.
 */
export function claimedIssues(snapshot: LedgerSnapshot): Map<string, string> {
  const out = new Map<string, string>();
  for (const task of snapshot.tasks) {
    for (const ref of issueRefsIn(task.brief)) out.set(`github:${issueOriginKey(ref.url)}`, task.id);
  }
  return out;
}

/** Issue URLs that already have a task, open or closed, however it was opened. */
export function trackedIssueUrls(snapshot: LedgerSnapshot): Set<string> {
  const urls = new Set<string>();
  for (const task of snapshot.tasks) {
    const created = task.facts.find((fact): fact is CreatedFact => fact.kind === "Created");
    const origin = created ? originOf(created) : undefined;
    if (origin?.source === "github") urls.add(origin.key);
    for (const ref of issueRefsIn(task.brief)) urls.add(issueOriginKey(ref.url));
  }
  return urls;
}

/**
 * One request per labeled issue the poll saw. Nothing is filtered for novelty
 * here beyond what is not an ask at all: the seam decides what is new.
 */
export function intakeRequests(input: {
  issues: readonly IntakeIssue[];
  label: string;
  routes?: readonly IntakeRoute[];
}): OpenTaskRequest[] {
  const out: OpenTaskRequest[] = [];
  for (const issue of input.issues) {
    if (issue.isPullRequest || issue.state !== "open") continue;
    const route = input.routes ? routeIssue(input.routes, issue.repo, issue.labels ?? []) : undefined;
    if (input.routes && !route) continue;
    const label = route?.labels.join(", ") ?? input.label;
    out.push({
      op: "open_task",
      source: "github",
      key: issueOriginKey(issue.url),
      brief: briefFromIssue(issue),
      actor: issue.author,
      cite: `issue labeled "${label}" on GitHub: ${issue.url}`,
      url: issue.url,
      title: issue.title,
      data: { repo: issue.repo, number: issue.number, label },
      ...(route ? { projectId: route.projectId } : {}),
    });
  }
  return out;
}

/**
 * The brief for a task opened from an issue: title, body and the issue URL.
 * Nothing about how to deliver — that is the SOP's business.
 */
export function briefFromIssue(issue: IntakeIssue): string {
  const title = issue.title.trim() || `${issue.repo}#${issue.number}`;
  const body = issue.body.trim();
  const cut = body.length > MAX_BODY_CHARS
    ? `${body.slice(0, MAX_BODY_CHARS)}\n\n[… cut at ${MAX_BODY_CHARS} characters; the full text is on the issue]`
    : body;
  const lines = [title];
  if (cut) lines.push("", cut);
  lines.push("", `GitHub issue: ${issue.url}`);
  return lines.join("\n");
}

/** The REST path `connector_proxy` lists one page of labeled open issues from. */
export function intakeApiPath(repo: string, label: string, page: number): string {
  const [owner, name] = repo.split("/");
  const query = new URLSearchParams({
    labels: label,
    state: "open",
    sort: "created",
    direction: "asc",
    per_page: "100",
    page: String(page),
  });
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues?${query}`;
}

/** Pages of 100 the poll will read per repo before stopping for this pass. */
export const MAX_INTAKE_PAGES = 5;

/**
 * One item of GitHub's issue list, reduced to what intake reads. Returns
 * undefined for a row that is not an issue — no number, no URL — so a
 * malformed response skips the row rather than opening a task on nothing.
 */
export function toIntakeIssue(repo: string, raw: Record<string, unknown>): IntakeIssue | undefined {
  const number = typeof raw.number === "number" ? raw.number : undefined;
  const url = typeof raw.html_url === "string" ? raw.html_url : undefined;
  if (number === undefined || !url) return undefined;
  const user = raw.user as { login?: unknown } | null | undefined;
  return {
    url,
    repo,
    number,
    title: typeof raw.title === "string" ? raw.title : "",
    body: typeof raw.body === "string" ? raw.body : "",
    author: typeof user?.login === "string" ? user.login : "unknown",
    state: raw.state === "closed" ? "closed" : "open",
    isPullRequest: Boolean(raw.pull_request),
    labels: Array.isArray(raw.labels) ? raw.labels.flatMap((label) => {
      const name = typeof label === "string" ? label : label && typeof label === "object" ? (label as { name?: unknown }).name : undefined;
      return typeof name === "string" ? [name] : [];
    }) : [],
  };
}
