import { isConnectionRequiredMessage } from "./connection.js";
import type { ActionResult, AppDbContext, RomeAppContext } from "@rome-os/app-runtime";
import { createBoardRepository } from "../db/repositories/board.js";
import {
  githubIssueKey,
  parseBlockedByReferences,
  parseClosingReferences,
  type GithubIssueReference,
} from "./github-board.js";
import {
  UNTRIAGED_EPIC_ID,
  type GithubBoardSnapshot,
  type BoardIssueNode,
  type PullRequestSummary,
  type BoardEpic,
} from "./board-snapshot.js";

export interface SyncDeps {
  runAction: RomeAppContext["runAction"];
  db: AppDbContext;
  log?: RomeAppContext["log"];
}

export interface RepositoryOption {
  fullName: string;
  name: string;
  owner: string;
  url: string;
  private: boolean;
  archived: boolean;
  pushedAt: string | null;
}

interface GraphLabel {
  name: string;
  color: string;
}

interface GraphBlocker {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  updatedAt: string;
  repository: { nameWithOwner: string };
}

interface GraphPullRequest {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  mergedAt: string | null;
  repository: { nameWithOwner: string };
}

/** A project item whose content is an Issue. Draft issues and PRs come back without `number`. */
interface GraphIssueContent {
  __typename?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: "OPEN" | "CLOSED";
  body?: string | null;
  author?: { login?: string } | null;
  updatedAt?: string;
  repository?: { nameWithOwner: string };
  labels?: { nodes: GraphLabel[] };
  blockedBy?: { pageInfo: { hasNextPage: boolean }; nodes: GraphBlocker[] };
  closedByPullRequestsReferences?: { nodes: GraphPullRequest[] };
}

interface GraphProjectItem {
  status: { name?: string } | null;
  content: GraphIssueContent | null;
}

/**
 * A repository issue read straight off the repo rather than through a project.
 * `projectItems.totalCount` is what decides whether it is on any board — note
 * it only counts projects the connection can see, so an issue filed on a
 * project the token cannot read reads as unassigned.
 */
interface GraphRepoIssue extends GraphIssueContent {
  projectItems?: { totalCount: number };
}

interface GraphProjectItems {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: GraphProjectItem[];
}

interface GraphProject {
  id: string;
  number: number;
  title: string;
  url: string;
  closed: boolean;
  updatedAt: string;
  shortDescription: string | null;
  owner: { login?: string } | null;
  items: GraphProjectItems;
}

interface ProjectsResponse {
  data?: {
    repository: {
      url: string;
      projectsV2: {
        pageInfo: { hasNextPage: boolean };
        nodes: GraphProject[];
      };
      issues: {
        pageInfo: { hasNextPage: boolean };
        nodes: GraphRepoIssue[];
      };
      pullRequests: {
        pageInfo: { hasNextPage: boolean };
        nodes: Array<{
          number: number;
          title: string;
          url: string;
          state: "OPEN" | "CLOSED" | "MERGED";
          isDraft: boolean;
          mergedAt: string | null;
          body: string | null;
          repository: { nameWithOwner: string };
          closingIssuesReferences: {
            nodes: Array<{ number: number; repository: { nameWithOwner: string } }>;
          };
        }>;
      };
    } | null;
    rateLimit: { remaining: number; resetAt: string };
  };
  errors?: Array<{ message: string }>;
}

interface ProjectItemsResponse {
  data?: { node: { items: GraphProjectItems } | null };
  errors?: Array<{ message: string }>;
}

export class GithubError extends Error {
  constructor(message: string, readonly connectionRequired = false) {
    super(message);
  }
}

// Epics are GitHub Projects linked to the repository. Each project item that is
// an Issue becomes a ticket in that epic — including issues that live in other
// repositories, which is the whole point of using a project as the boundary.
const ISSUE_ITEM_FRAGMENT = `
  fragment IssueItem on Issue {
    number title url state body updatedAt
    author { login }
    repository { nameWithOwner }
    labels(first: 12) { nodes { name color } }
    blockedBy(first: 20) {
      pageInfo { hasNextPage }
      nodes { number title url state updatedAt repository { nameWithOwner } }
    }
    closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
      nodes { number title url state isDraft mergedAt repository { nameWithOwner } }
    }
  }
`;

const PROJECT_ITEM_FIELDS = `
  status: fieldValueByName(name: "Status") {
    ... on ProjectV2ItemFieldSingleSelectValue { name }
  }
  content { __typename ...IssueItem }
`;

/**
 * How many of the repository's open issues we scan for the "No project"
 * bucket. Closed issues are deliberately left out: an untriaged backlog is
 * about what still needs doing, and closed work with no board is just history.
 */
const UNASSIGNED_ISSUE_LIMIT = 100;

const PROJECTS_QUERY = `
  query WorkstreamProjects($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      url
      projectsV2(first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage }
        nodes {
          id number title url closed updatedAt shortDescription
          owner {
            __typename
            ... on Organization { login }
            ... on User { login }
          }
          items(first: 100) {
            pageInfo { hasNextPage endCursor }
            nodes { ${PROJECT_ITEM_FIELDS} }
          }
        }
      }
      issues(first: ${UNASSIGNED_ISSUE_LIMIT}, states: [OPEN], orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage }
        nodes {
          __typename
          ...IssueItem
          projectItems(first: 1, includeArchived: true) { totalCount }
        }
      }
      pullRequests(first: 100, orderBy: { field: UPDATED_AT, direction: DESC }, states: [OPEN, MERGED, CLOSED]) {
        pageInfo { hasNextPage }
        nodes {
          number title url state isDraft mergedAt body
          repository { nameWithOwner }
          closingIssuesReferences(first: 25) {
            nodes { number repository { nameWithOwner } }
          }
        }
      }
    }
    rateLimit { remaining resetAt }
  }
  ${ISSUE_ITEM_FRAGMENT}
`;

const PROJECT_ITEMS_QUERY = `
  query WorkstreamProjectItems($projectId: ID!, $cursor: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { ${PROJECT_ITEM_FIELDS} }
        }
      }
    }
  }
  ${ISSUE_ITEM_FRAGMENT}
`;

/** How many extra item pages we will chase per project, and in total, per sync. */
const MAX_EXTRA_PAGES_PER_PROJECT = 2;
const MAX_EXTRA_PAGES_TOTAL = 8;

export function asGithubError(error: unknown): GithubError {
  const message = error instanceof Error ? error.message : String(error);
  return new GithubError(
    message,
    isConnectionRequiredMessage(message) || /read:project|INSUFFICIENT_SCOPES/i.test(message),
  );
}

function actionError(result: ActionResult): string {
  return result.status === "error" ? result.error : `connector:connector_proxy returned ${result.status}`;
}

/** Stable, human-readable epic id: `<owner>/projects/<number>` (e.g. `acme/projects/7`). */
function projectKey(owner: string, number: number): string {
  return `${owner.toLowerCase()}/projects/${number}`;
}

/** GitHub reports missing Projects access as a scope error rather than an empty list. */
function isProjectScopeError(message: string): boolean {
  return /read:project|INSUFFICIENT_SCOPES/i.test(message);
}

function isIssueContent(content: GraphIssueContent | null): content is GraphIssueContent & {
  number: number;
  repository: { nameWithOwner: string };
} {
  return Boolean(
    content
      && content.__typename === "Issue"
      && typeof content.number === "number"
      && content.repository?.nameWithOwner,
  );
}

function toPullRequestSummary(pr: GraphPullRequest): PullRequestSummary {
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.mergedAt ? "MERGED" : pr.state,
    draft: pr.isDraft,
    repo: pr.repository.nameWithOwner,
  };
}

async function github<T>(deps: SyncDeps, options: {
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string | number>;
  body?: unknown;
}): Promise<T> {
  try {
    const result = await deps.runAction("connector:connector_proxy", {
      toolkit: "github",
      path: options.path,
      method: options.method ?? "GET",
      ...(options.query ? { query: options.query } : {}),
      ...(options.body ? { body: options.body } : {}),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });
    if (result.status !== "ok") throw new Error(actionError(result));
    const envelope = result.data as { status?: number; data?: T };
    return envelope.data as T;
  } catch (error) {
    throw asGithubError(error);
  }
}

export async function listRepositories(deps: SyncDeps): Promise<RepositoryOption[]> {
  const repos = await github<Array<{
    full_name: string;
    name: string;
    owner: { login: string };
    html_url: string;
    private: boolean;
    archived: boolean;
    pushed_at: string | null;
  }>>(deps, {
    path: "/user/repos",
    query: {
      per_page: 100,
      sort: "pushed",
      direction: "desc",
      affiliation: "owner,collaborator,organization_member",
    },
  });
  return repos.map((repo) => ({
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner.login,
    url: repo.html_url,
    private: repo.private,
    archived: repo.archived,
    pushedAt: repo.pushed_at,
  }));
}

/** Fetch the remaining item pages for a project whose first page overflowed. */
async function fetchExtraItems(deps: SyncDeps, projectId: string, cursor: string | null, budget: { left: number }): Promise<GraphProjectItem[]> {
  const items: GraphProjectItem[] = [];
  let next = cursor;
  for (let page = 0; page < MAX_EXTRA_PAGES_PER_PROJECT && next && budget.left > 0; page += 1) {
    budget.left -= 1;
    const response = await github<ProjectItemsResponse>(deps, {
      path: "/graphql",
      method: "POST",
      body: { query: PROJECT_ITEMS_QUERY, variables: { projectId, cursor: next } },
    });
    if (response.errors?.length) {
      const message = response.errors.map((error) => error.message).join("; ");
      if (isProjectScopeError(message)) {
        throw new GithubError(
          "The GitHub connection cannot read Projects. Reconnect GitHub in Rome Settings and grant the `read:project` scope.",
          true,
        );
      }
      throw new GithubError(message);
    }
    const connection = response.data?.node?.items;
    if (!connection) break;
    items.push(...connection.nodes);
    next = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  }
  return items;
}

export async function syncRepository(deps: SyncDeps, repo: string): Promise<GithubBoardSnapshot> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new GithubError(`Invalid GitHub repository ${JSON.stringify(repo)}.`);
  }
  const [owner, name] = repo.split("/");
  const response = await github<ProjectsResponse>(deps, {
    path: "/graphql",
    method: "POST",
    body: { query: PROJECTS_QUERY, variables: { owner, name } },
  });
  if (response.errors?.length) {
    const message = response.errors.map((error) => error.message).join("; ");
    if (isProjectScopeError(message)) {
      throw new GithubError(
        "The GitHub connection cannot read Projects. Reconnect GitHub in Rome Settings and grant the `read:project` scope.",
        true,
      );
    }
    throw new GithubError(message);
  }
  const repository = response.data?.repository;
  if (!repository) throw new GithubError(`Repository ${repo} was not found or is not accessible.`);

  const warnings: string[] = [];
  const issueById = new Map<string, BoardIssueNode>();
  const issueBodies = new Map<string, string | null>();
  const projectDetails: Array<{ id: string; project: GraphProject; issueIds: string[] }> = [];
  const blockerSources = new Map<string, { repo: string; blockedBy: GraphBlocker[]; truncated: boolean }>();
  const pageBudget = { left: MAX_EXTRA_PAGES_TOTAL };

  if (repository.projectsV2.pageInfo.hasNextPage) {
    warnings.push("Showing the 20 most recently updated projects linked to this repository.");
  }

  for (const project of repository.projectsV2.nodes) {
    const projectOwner = project.owner?.login ?? owner;
    const id = projectKey(projectOwner, project.number);

    const items = [...project.items.nodes];
    if (project.items.pageInfo.hasNextPage) {
      const extra = await fetchExtraItems(deps, project.id, project.items.pageInfo.endCursor, pageBudget);
      items.push(...extra);
      if (extra.length === 0 || pageBudget.left <= 0) {
        warnings.push(`"${project.title}" has more items than were loaded; showing the first ${items.length}.`);
      }
    }

    const issueIds: string[] = [];
    for (const item of items) {
      const content = item.content;
      if (!isIssueContent(content)) continue;
      const itemRepo = content.repository.nameWithOwner;
      const issueId = githubIssueKey(itemRepo, content.number);
      issueIds.push(issueId);

      const existing = issueById.get(issueId);
      if (existing) {
        // An issue can sit in several projects — record every epic it belongs to.
        if (!existing.epicIds.includes(id)) existing.epicIds.push(id);
        if (!existing.status && item.status?.name) existing.status = item.status.name;
        continue;
      }

      issueById.set(issueId, {
        id: issueId,
        repo: itemRepo,
        number: content.number,
        title: content.title ?? `${itemRepo}#${content.number}`,
        body: content.body ?? "",
        author: content.author?.login ?? "unknown",
        url: content.url ?? `https://github.com/${itemRepo}/issues/${content.number}`,
        state: content.state ?? "OPEN",
        updatedAt: content.updatedAt ?? "",
        labels: content.labels?.nodes ?? [],
        external: itemRepo.toLowerCase() !== repo.toLowerCase(),
        epicIds: [id],
        blockedBy: [],
        pullRequests: (content.closedByPullRequestsReferences?.nodes ?? []).map(toPullRequestSummary),
        status: item.status?.name ?? null,
      });
      issueBodies.set(issueId, content.body ?? null);
      blockerSources.set(issueId, {
        repo: itemRepo,
        blockedBy: content.blockedBy?.nodes ?? [],
        truncated: Boolean(content.blockedBy?.pageInfo.hasNextPage),
      });
    }

    projectDetails.push({ id, project, issueIds });
  }

  // Open issues in the selected repo that no project has picked up. They are
  // gathered after the project pass so anything already claimed by an epic is
  // skipped by its own item count, and before dependency resolution so their
  // blockers become edges like any other ticket's.
  const unassignedIds: string[] = [];
  for (const issue of repository.issues.nodes) {
    if ((issue.projectItems?.totalCount ?? 0) > 0) continue;
    if (!isIssueContent(issue)) continue;
    const itemRepo = issue.repository.nameWithOwner;
    const issueId = githubIssueKey(itemRepo, issue.number);
    if (issueById.has(issueId)) continue;
    unassignedIds.push(issueId);

    issueById.set(issueId, {
      id: issueId,
      repo: itemRepo,
      number: issue.number,
      title: issue.title ?? `${itemRepo}#${issue.number}`,
      body: issue.body ?? "",
      author: issue.author?.login ?? "unknown",
      url: issue.url ?? `https://github.com/${itemRepo}/issues/${issue.number}`,
      state: issue.state ?? "OPEN",
      updatedAt: issue.updatedAt ?? "",
      labels: issue.labels?.nodes ?? [],
      external: false,
      // Stays empty on purpose: the synthetic epic is not a GitHub Project.
      epicIds: [],
      blockedBy: [],
      pullRequests: (issue.closedByPullRequestsReferences?.nodes ?? []).map(toPullRequestSummary),
      status: null,
    });
    issueBodies.set(issueId, issue.body ?? null);
    blockerSources.set(issueId, {
      repo: itemRepo,
      blockedBy: issue.blockedBy?.nodes ?? [],
      truncated: Boolean(issue.blockedBy?.pageInfo.hasNextPage),
    });
  }
  if (repository.issues.pageInfo.hasNextPage) {
    warnings.push(`Scanned the ${UNASSIGNED_ISSUE_LIMIT} most recently updated open issues for tickets without a project.`);
  }

  // Dependencies: native "blocked by" links arrive inline on each issue, and we
  // still parse a `## Blocked by` body section as a fallback for repos that
  // record dependencies in the issue description. A blocker that is not itself
  // a project item is pulled in as an external node so the edge stays visible.
  const nativeBlockerDetails = new Map<string, GraphBlocker>();
  const edgeKeys = new Set<string>();
  let truncatedDependencies = 0;
  for (const [targetId, source] of blockerSources) {
    if (source.truncated) truncatedDependencies += 1;
    const nativeRefs = source.blockedBy.map<GithubIssueReference>((blocker) => {
      nativeBlockerDetails.set(githubIssueKey(blocker.repository.nameWithOwner, blocker.number), blocker);
      return { repo: blocker.repository.nameWithOwner, number: blocker.number };
    });
    const bodyRefs = parseBlockedByReferences(issueBodies.get(targetId) ?? null, source.repo);

    for (const ref of dedupeReferences([...nativeRefs, ...bodyRefs])) {
      const sourceId = githubIssueKey(ref.repo, ref.number);
      if (sourceId === targetId) continue;
      if (!issueById.has(sourceId)) {
        const native = nativeBlockerDetails.get(sourceId);
        issueById.set(sourceId, {
          id: sourceId,
          repo: ref.repo,
          number: ref.number,
          title: native?.title ?? `${ref.repo}#${ref.number}`,
          body: "",
          author: "unknown",
          url: native?.url ?? `https://github.com/${ref.repo}/issues/${ref.number}`,
          state: native?.state ?? "OPEN",
          updatedAt: native?.updatedAt ?? "",
          labels: [],
          external: true,
          epicIds: [],
          blockedBy: [],
          pullRequests: [],
          status: null,
        });
      }
      edgeKeys.add(`${sourceId}->${targetId}`);
    }
  }
  if (truncatedDependencies > 0) {
    warnings.push(`Showing the first 20 blockers for ${truncatedDependencies} ticket${truncatedDependencies === 1 ? "" : "s"}.`);
  }

  // Issues carry their own closing PRs (cross-repo included). Scanning the
  // selected repo's PRs additionally catches `Fixes #123` written in a PR body
  // that GitHub did not turn into a formal link.
  for (const pr of repository.pullRequests.nodes) {
    const prRepo = pr.repository?.nameWithOwner ?? repo;
    const references = dedupeReferences([
      ...pr.closingIssuesReferences.nodes.map((issue) => ({ repo: issue.repository.nameWithOwner, number: issue.number })),
      ...parseClosingReferences(pr.body, prRepo),
    ]);
    const summary: PullRequestSummary = {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.mergedAt ? "MERGED" : pr.state,
      draft: pr.isDraft,
      repo: prRepo,
    };
    for (const ref of references) {
      const node = issueById.get(githubIssueKey(ref.repo, ref.number));
      if (!node) continue;
      if (node.pullRequests.some((existing) => existing.repo === summary.repo && existing.number === summary.number)) continue;
      node.pullRequests.push(summary);
    }
  }

  const edges = [...edgeKeys].map((key) => {
    const [source, target] = key.split("->");
    issueById.get(target)?.blockedBy.push(source);
    return { id: key, source, target };
  });

  const epics = projectDetails.map<BoardEpic>(({ id, project, issueIds }) => {
    const uniqueIds = [...new Set(issueIds)];
    const issues = uniqueIds.map((issueId) => issueById.get(issueId)).filter((node): node is BoardIssueNode => node != null);
    const updatedAt = [project.updatedAt, ...issues.map((issue) => issue.updatedAt)]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? "";
    return {
      id,
      nodeId: project.id,
      owner: project.owner?.login ?? owner,
      number: project.number,
      title: project.title,
      url: project.url,
      state: project.closed ? "CLOSED" : "OPEN",
      shortDescription: project.shortDescription ?? null,
      issueIds: uniqueIds,
      openCount: issues.filter((issue) => issue.state === "OPEN").length,
      closedCount: issues.filter((issue) => issue.state === "CLOSED").length,
      pullRequestCount: issues.reduce((count, issue) => count + issue.pullRequests.length, 0),
      updatedAt,
    };
  }).sort((a, b) => {
    if ((a.openCount > 0) !== (b.openCount > 0)) return a.openCount > 0 ? -1 : 1;
    if (a.state !== b.state) return a.state === "OPEN" ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  // Appended after the sort rather than ranked with the epics: untriaged work is
  // always the last resort in the picker, however recently it moved.
  const unassignedIssueIds = [...new Set(unassignedIds)];
  if (unassignedIssueIds.length > 0) {
    const issues = unassignedIssueIds
      .map((issueId) => issueById.get(issueId))
      .filter((node): node is BoardIssueNode => node != null);
    epics.push({
      id: UNTRIAGED_EPIC_ID,
      nodeId: "",
      owner,
      number: 0,
      title: "No project",
      url: `https://github.com/${repo}/issues?q=${encodeURIComponent("is:issue is:open no:project")}`,
      state: "OPEN",
      shortDescription: `Open issues in ${repo} that are not on any project board`,
      issueIds: unassignedIssueIds,
      openCount: issues.filter((issue) => issue.state === "OPEN").length,
      closedCount: issues.filter((issue) => issue.state === "CLOSED").length,
      pullRequestCount: issues.reduce((count, issue) => count + issue.pullRequests.length, 0),
      updatedAt: issues.map((issue) => issue.updatedAt).filter(Boolean).sort().at(-1) ?? "",
      synthetic: true,
    });
  }

  const syncedAt = new Date();
  const snapshot: GithubBoardSnapshot = {
    provider: "github",
    repo: { fullName: repo, url: repository.url },
    nodes: [...issueById.values()].sort((a, b) => (a.repo === b.repo ? a.number - b.number : a.repo.localeCompare(b.repo))),
    edges,
    epics,
    syncedAt: syncedAt.toISOString(),
    rateLimit: response.data?.rateLimit ?? null,
    warnings,
  };
  const storage = createBoardRepository(deps.db);
  storage.saveSnapshot(repo, snapshot, syncedAt);
  return snapshot;
}

function dedupeReferences(refs: GithubIssueReference[]): GithubIssueReference[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = githubIssueKey(ref.repo, ref.number);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
