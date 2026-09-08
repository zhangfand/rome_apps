import { type CreatedFact, githubPerson, type NewFact } from "./facts.js";
import type { LedgerSnapshot } from "./fold.js";
import { issueRefsIn } from "./github-refs.js";

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
    if (created?.payload.issue) urls.add(created.payload.issue.url);
    for (const ref of issueRefsIn(task.brief)) urls.add(ref.url);
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
  newTaskId: () => string;
}): NewFact[] {
  const { snapshot, issues, label, newTaskId } = input;
  const tracked = trackedIssueUrls(snapshot);
  const out: NewFact[] = [];
  for (const issue of issues) {
    if (issue.isPullRequest || issue.state !== "open") continue;
    if (tracked.has(issue.url)) continue;
    tracked.add(issue.url);
    out.push({
      taskId: newTaskId(),
      kind: "Created",
      by: githubPerson(issue.author),
      source: `issue labeled "${label}" on GitHub: ${issue.url}`,
      payload: {
        brief: briefFromIssue(issue),
        issue: {
          url: issue.url,
          repo: issue.repo,
          number: issue.number,
          title: issue.title,
          author: issue.author,
          label,
        },
      },
    });
  }
  return out;
}

/**
 * The brief a worker reads. It is self-contained: the issue says what to
 * build, and the brief says how the work is delivered and when the task ends,
 * because the issue does not — an issue describes a change, not a workflow.
 * The runtime's own instructions to a worker (`prompt.ts`) stay about being a
 * worker; nothing there knows this task came from GitHub.
 *
 * The delivery terms mirror how the task ends (`observe.ts`): the task is
 * over when the issue closes, and the way a worker closes it is a merged pull
 * request that says `Closes #N`. A worker that stops at a local branch has
 * not delivered.
 *
 * The issue URL is on its own line at the end so `issueRefsIn` finds it
 * whatever the body says, and so a worker knows where the ask lives.
 */
export function briefFromIssue(issue: IntakeIssue): string {
  const title = issue.title.trim() || `${issue.repo}#${issue.number}`;
  const body = issue.body.trim();
  const cut =
    body.length > MAX_BODY_CHARS
      ? `${body.slice(0, MAX_BODY_CHARS)}\n\n[… cut at ${MAX_BODY_CHARS} characters; the full text is on the issue]`
      : body;
  const lines = [title];
  if (cut) lines.push("", cut);
  lines.push("", deliveryTerms(issue));
  lines.push("", `GitHub issue: ${issue.url}`);
  return lines.join("\n");
}

/**
 * How work on an issue is handed in. Part of every intake brief, verbatim,
 * so the worker learns the finish line from the same text as the ask.
 */
export function deliveryTerms(issue: Pick<IntakeIssue, "repo" | "number">): string {
  return [
    "## Delivery",
    "",
    `This task ends when issue #${issue.number} in ${issue.repo} is closed. It closes`,
    "through a pull request, so the work is not done until one exists:",
    "",
    `- Work on a clean branch off the default branch of ${issue.repo}; do not`,
    "  build on another task's branch or leave the change uncommitted.",
    `- Push the branch and open a pull request against ${issue.repo} whose`,
    `  description says \`Closes #${issue.number}\`, so merging it closes the issue.`,
    "- Opening the PR is an intermediate result, not the handoff to a person.",
    "  Check the expected automated reviews and required CI for the current head.",
    "  If they are pending, return waiting with the PR URL, head commit, what to",
    "  check next, and a revisit delay. Check them yourself when resumed.",
    "- Use the repository's respond-to-review skill when available to handle",
    "  feedback: verify and deduplicate findings, fix real in-scope defects, and",
    "  answer every finding with a fix, reasoned decline, or linked follow-up.",
    "  After a push, check reviews and CI for the new head again. No feedback yet",
    "  is not approval. Do not blindly implement every bot suggestion.",
    "- Return ready only when the expected reviews have completed, findings have",
    "  been handled, and required checks pass. Include the PR URL and verification",
    "  evidence in the summary. A local branch or an unpushed commit is not a result.",
    "  Escalate a genuine decision or persistent external failure with a concrete",
    "  blocked question, not just because a review has not arrived yet.",
    "- Do not merge the pull request or close the issue yourself; a person does",
    "  that after review.",
  ].join("\n");
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
  };
}
