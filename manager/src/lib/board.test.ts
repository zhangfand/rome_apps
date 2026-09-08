import { describe, expect, it } from "@rstest/core";
import type { NewFact } from "./facts.js";
import { buildBoardState, openTaskForIssue } from "./board.js";
import type { BoardIssueNode, GithubBoardSnapshot } from "./board-snapshot.js";
import { fold } from "./fold.js";
import { LedgerBuilder } from "./test-facts.js";

function issue(number: number, extra: Partial<BoardIssueNode> = {}): BoardIssueNode {
  return {
    id: `acme/web#${number}`,
    repo: "acme/web",
    number,
    title: `Issue ${number}`,
    body: "",
    author: "octocat",
    url: `https://github.com/acme/web/issues/${number}`,
    state: "OPEN",
    updatedAt: "2026-09-08T00:00:00.000Z",
    labels: [],
    external: false,
    epicIds: ["acme/projects/1"],
    blockedBy: [],
    pullRequests: [],
    status: null,
    ...extra,
  };
}

function graph(nodes: BoardIssueNode[]): GithubBoardSnapshot {
  return {
    provider: "github",
    repo: { fullName: "acme/web", url: "https://github.com/acme/web" },
    nodes,
    edges: [],
    epics: [],
    syncedAt: "2026-09-08T00:00:00.000Z",
    rateLimit: null,
    warnings: [],
  };
}

describe("buildBoardState", () => {
  it("derives Ready, Blocked and Done from issue and known blocker state", () => {
    const state = buildBoardState(
      graph([
        issue(1),
        issue(2, { blockedBy: ["acme/web#1"] }),
        issue(3, { state: "CLOSED" }),
        issue(4, { blockedBy: ["missing/repo#9"] }),
      ]),
      fold(new Date(), []),
    );

    expect(state.nodes.map((node) => [node.number, node.boardStatus])).toEqual([
      [1, "ready"],
      [2, "blocked"],
      [3, "done"],
      [4, "ready"],
    ]);
    expect(state.nodes[1].openBlockerIds).toEqual(["acme/web#1"]);
  });

  it("derives In Progress and its position/live worker from the ledger fold", () => {
    const ledger = new LedgerBuilder()
      .add({ taskId: "t-1", kind: "Created", by: "guardian", source: "start", payload: { brief: "Implement ACME/Web#2" } })
      .add({ taskId: "t-1", kind: "Taken", by: "runtime", payload: {} })
      .add({ taskId: "t-1", kind: "Started", by: "runtime", payload: { workerId: "w-1", prompt: "work" } });

    const state = buildBoardState(graph([issue(1), issue(2, { blockedBy: ["acme/web#1"] })]), fold(ledger.now(), ledger.facts));
    expect(state.nodes[1]).toMatchObject({
      boardStatus: "in-progress",
      managerTask: { taskId: "t-1", position: "working", liveWorkerId: "w-1" },
    });
  });

  it("ignores completed/cancelled tasks and de-duplicates references with issueRefsIn", () => {
    const created: NewFact = {
      taskId: "t-old",
      kind: "Created",
      by: "guardian",
      source: "start",
      payload: {
        brief: "https://github.com/acme/web/issues/1 and acme/web#1",
      },
    };
    const ledger = new LedgerBuilder()
      .add(created)
      .add({ taskId: "t-old", kind: "Completed", by: "guardian", source: "done", payload: {} });
    const snapshot = fold(ledger.now(), ledger.facts);
    const state = buildBoardState(graph([issue(1)]), snapshot);
    expect(state.nodes[0].boardStatus).toBe("ready");
    expect(openTaskForIssue(snapshot, issue(1))).toBeUndefined();
  });
});
