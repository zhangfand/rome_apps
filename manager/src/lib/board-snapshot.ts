/** GitHub-only provider shape; the discriminator leaves room for another provider later. */
export type BoardProvider = "github";

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  draft: boolean;
  repo: string;
}

export interface BoardIssueNode {
  /** Lower-case `owner/repo#number`, stable across GitHub casing. */
  id: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  author: string;
  url: string;
  state: "OPEN" | "CLOSED";
  updatedAt: string;
  labels: Array<{ name: string; color: string }>;
  external: boolean;
  epicIds: string[];
  blockedBy: string[];
  pullRequests: PullRequestSummary[];
  status: string | null;
}

export interface BoardEpic {
  /** `<owner>/projects/<number>`. */
  id: string;
  nodeId: string;
  owner: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  shortDescription: string | null;
  issueIds: string[];
  openCount: number;
  closedCount: number;
  pullRequestCount: number;
  updatedAt: string;
  synthetic?: boolean;
}

export interface GithubBoardSnapshot {
  provider: BoardProvider;
  repo: { fullName: string; url: string };
  nodes: BoardIssueNode[];
  edges: Array<{ id: string; source: string; target: string }>;
  epics: BoardEpic[];
  syncedAt: string;
  rateLimit: { remaining: number; resetAt: string } | null;
  warnings: string[];
}

/** Synthetic epic for open repository issues that are not on any Project. */
export const UNTRIAGED_EPIC_ID = "__no-project__";
