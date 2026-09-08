import type { BoardIssueNode, GithubBoardSnapshot } from "./board-snapshot.js";
import { githubIssueKey } from "./github-board.js";
import { issueRefsIn } from "./github-refs.js";
import { isTerminal, type LedgerSnapshot, type Position, type TaskView } from "./fold.js";

export type BoardStatus = "ready" | "in-progress" | "blocked" | "done";

export interface BoardTaskLink {
  taskId: string;
  position?: Position;
  liveWorkerId?: string;
}

export interface BoardIssue extends BoardIssueNode {
  boardStatus: BoardStatus;
  /** Known blockers that are not closed. */
  openBlockerIds: string[];
  managerTask?: BoardTaskLink;
}

export interface BoardState extends Omit<GithubBoardSnapshot, "nodes"> {
  nodes: BoardIssue[];
}

/** The first open ledger task whose Created brief names this issue. */
export function openTaskForIssue(snapshot: LedgerSnapshot, issue: Pick<BoardIssueNode, "repo" | "number">): TaskView | undefined {
  const wanted = githubIssueKey(issue.repo, issue.number);
  return snapshot.tasks.find(
    (task) =>
      !isTerminal(task.state) &&
      issueRefsIn(task.brief).some((ref) => githubIssueKey(`${ref.owner}/${ref.repo}`, ref.number) === wanted),
  );
}

/**
 * Join GitHub's latest successful snapshot to the append-only Manager fold.
 * GitHub supplies open/closed and dependencies; only an open Manager task can
 * move an issue into In Progress. No board state is stored.
 */
export function buildBoardState(graph: GithubBoardSnapshot, ledger: LedgerSnapshot): BoardState {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const openTaskByIssue = new Map<string, TaskView>();
  for (const task of ledger.tasks) {
    if (isTerminal(task.state)) continue;
    for (const ref of issueRefsIn(task.brief)) {
      const id = githubIssueKey(`${ref.owner}/${ref.repo}`, ref.number);
      if (!openTaskByIssue.has(id)) openTaskByIssue.set(id, task);
    }
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const openBlockerIds = node.blockedBy.filter((id) => nodeById.get(id)?.state === "OPEN");
      const task = openTaskByIssue.get(node.id);
      const boardStatus: BoardStatus =
        node.state === "CLOSED"
          ? "done"
          : task
            ? "in-progress"
            : openBlockerIds.length > 0
              ? "blocked"
              : "ready";
      return {
        ...node,
        boardStatus,
        openBlockerIds,
        managerTask: task
          ? {
              taskId: task.id,
              position: task.position,
              liveWorkerId: task.liveWorker?.workerId,
            }
          : undefined,
      };
    }),
  };
}
