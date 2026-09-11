import { type CreatedFact, githubPerson, type NewFact } from "./facts.js";
import type { LedgerSnapshot } from "./fold.js";
import { issueRefsIn } from "./github-refs.js";
import { routeIssue, type IntakeRoute } from "./projects.js";

/**
 * Taking a task in from GitHub. A chat is not the only place a person asks
 * for work: an issue carrying the intake label in a watched repository is the
 * same ask, written down where the code lives. The runtime transcribes it —
 * the issue's title and body become the brief, its author becomes `by`, and
 * the issue is cited as `source` — exactly as `manager:create` records a chat
 * message. It decides nothing about the work.
 *
 * Everything here is pure. The reconcile action lists the labeled issues and
 * hands them in; this module decides which are new and what to write.
 *
 * - One task per issue, ever. An issue that already has a task — opened from
 *   it here, or opened in chat by a person who named it in the brief — is
 *   never taken in again, even after that task ends. Re-labeling an issue
 *   does not reopen work; a person asks in chat for that.
 * - The brief names the issue, so the existing close watch (`observe.ts`)
 *   ends the task when the issue closes. Intake and ending are one contract.
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
 * Started and read by every worker; a body past this is cut with a pointer
 * back to the issue, which the worker can read in full.
 */
export const MAX_BODY_CHARS = 6000;

/** Issue URLs that already have a task, open or closed. */
export function trackedIssueUrls(snapshot: LedgerSnapshot): Set<string> {
  const urls = new Set<string>();
  for (const task of snapshot.tasks) {
    const created = task.facts.find((fact): fact is CreatedFact => fact.kind === "Created");
    if (created?.payload.issue) urls.add(created.payload.issue.url.toLowerCase());
    for (const ref of issueRefsIn(task.brief)) urls.add(ref.url.toLowerCase());
  }
  return urls;
}

/**
 * The Created facts for every labeled issue that has no task yet, in the
 * order GitHub listed them. `newTaskId` is injected so the output is a value
 * tests can compare.
 */
export function intakeFacts(input: {
  snapshot: LedgerSnapshot;
  issues: readonly IntakeIssue[];
  label: string;
  routes?: readonly IntakeRoute[];
  newTaskId: () => string;
}): NewFact[] {
  const { snapshot, issues, label, newTaskId } = input;
  const tracked = trackedIssueUrls(snapshot);
  const out: NewFact[] = [];
  for (const issue of issues) {
    if (issue.isPullRequest || issue.state !== "open") continue;
    if (tracked.has(issue.url.toLowerCase())) continue;
    const route = input.routes ? routeIssue(input.routes, issue.repo, issue.labels ?? []) : undefined;
    if (input.routes && !route) continue;
    tracked.add(issue.url.toLowerCase());
    out.push({
      taskId: newTaskId(),
      kind: "Created",
      by: githubPerson(issue.author),
      source: `issue labeled "${route?.labels.join(", ") ?? label}" on GitHub: ${issue.url}`,
      payload: {
        brief: briefFromIssue(issue),
        ...(route ? { projectId: route.projectId, project: route.project } : {}),
        issue: {
          url: issue.url,
          repo: issue.repo,
          number: issue.number,
          title: issue.title,
          author: issue.author,
          label: route?.labels.join(", ") ?? label,
        },
      },
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
