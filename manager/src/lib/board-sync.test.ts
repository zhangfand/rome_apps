import { describe, expect, it } from "@rstest/core";
import { GithubError, listRepositories, syncRepository, type SyncDeps } from "./board-sync.js";
import { UNTRIAGED_EPIC_ID } from "./board-snapshot.js";

function fakeDb(): SyncDeps["db"] {
  const chain: unknown = new Proxy(() => chain, { get: () => chain, apply: () => chain });
  return { connection: chain, tablePrefix: "manager" } as unknown as SyncDeps["db"];
}

function content(number: number, repo = "acme/web") {
  return {
    __typename: "Issue",
    number,
    title: `Issue ${number}`,
    body: `Body ${number}`,
    author: { login: "octocat" },
    url: `https://github.com/${repo}/issues/${number}`,
    state: "OPEN",
    updatedAt: "2026-09-08T00:00:00Z",
    repository: { nameWithOwner: repo },
    labels: { nodes: [] },
    blockedBy: { pageInfo: { hasNextPage: false }, nodes: [] },
    closedByPullRequestsReferences: { nodes: [] },
  };
}

function response() {
  const crossRepo = {
    ...content(1, "acme/api"),
    blockedBy: {
      pageInfo: { hasNextPage: false },
      nodes: [{
        number: 2,
        title: "Foundation",
        url: "https://github.com/acme/api/issues/2",
        state: "CLOSED",
        updatedAt: "2026-09-07T00:00:00Z",
        repository: { nameWithOwner: "acme/api" },
      }],
    },
    closedByPullRequestsReferences: {
      nodes: [{
        number: 9,
        title: "Ship it",
        url: "https://github.com/acme/api/pull/9",
        state: "MERGED",
        isDraft: false,
        mergedAt: "2026-09-08T00:00:00Z",
        repository: { nameWithOwner: "acme/api" },
      }],
    },
  };
  return {
    data: {
      repository: {
        url: "https://github.com/acme/web",
        projectsV2: {
          pageInfo: { hasNextPage: false },
          nodes: [{
            id: "PVT_one",
            number: 7,
            title: "Checkout",
            url: "https://github.com/orgs/acme/projects/7",
            closed: false,
            updatedAt: "2026-09-08T00:00:00Z",
            shortDescription: null,
            owner: { login: "acme" },
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ status: { name: "Todo" }, content: crossRepo }],
            },
          }],
        },
        issues: {
          pageInfo: { hasNextPage: false },
          nodes: [{ ...content(3), body: "## Blocked by\n#4", projectItems: { totalCount: 0 } }],
        },
        pullRequests: {
          pageInfo: { hasNextPage: false },
          nodes: [{
            number: 10,
            title: "Web fix",
            url: "https://github.com/acme/web/pull/10",
            state: "OPEN",
            isDraft: false,
            mergedAt: null,
            body: "Fixes #3",
            repository: { nameWithOwner: "acme/web" },
            closingIssuesReferences: { nodes: [] },
          }],
        },
      },
      rateLimit: { remaining: 4900, resetAt: "2026-09-08T01:00:00Z" },
    },
  };
}

describe("GitHub board sync", () => {
  it("uses connector:connector_proxy and lists repository options", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const deps = {
      runAction: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { status: "ok", data: { data: [{
          full_name: "acme/web", name: "web", owner: { login: "acme" }, html_url: "https://github.com/acme/web",
          private: true, archived: false, pushed_at: "2026-09-08T00:00:00Z",
        }] } };
      },
      db: fakeDb(),
    } as unknown as SyncDeps;

    const repositories = await listRepositories(deps);
    expect(repositories[0]).toMatchObject({ fullName: "acme/web", private: true });
    expect(calls[0].name).toBe("connector:connector_proxy");
    expect(calls[0].args).toMatchObject({ toolkit: "github", path: "/user/repos", method: "GET" });
  });

  it("syncs Projects as epics, cross-repo items, blockers, untriaged issues, and closing PRs", async () => {
    const deps = {
      runAction: async () => ({ status: "ok", data: { data: response() } }),
      db: fakeDb(),
    } as unknown as SyncDeps;

    const snapshot = await syncRepository(deps, "acme/web");
    expect(snapshot.epics[0]).toMatchObject({ id: "acme/projects/7", issueIds: ["acme/api#1"] });
    expect(snapshot.epics.at(-1)).toMatchObject({ id: UNTRIAGED_EPIC_ID, issueIds: ["acme/web#3"] });
    expect(snapshot.nodes.find((node) => node.id === "acme/api#1")).toMatchObject({
      external: true,
      body: "Body 1",
      author: "octocat",
      blockedBy: ["acme/api#2"],
      pullRequests: [{ number: 9, state: "MERGED" }],
    });
    expect(snapshot.nodes.find((node) => node.id === "acme/web#3")?.pullRequests).toEqual([
      expect.objectContaining({ number: 10, repo: "acme/web" }),
    ]);
    expect(snapshot.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "acme/api#2", target: "acme/api#1" }),
      expect.objectContaining({ source: "acme/web#4", target: "acme/web#3" }),
    ]));
  });

  it("surfaces a read:project reconnect prompt", async () => {
    const deps = {
      runAction: async () => ({ status: "ok", data: { data: { errors: [{ message: "INSUFFICIENT_SCOPES: read:project" }] } } }),
      db: fakeDb(),
    } as unknown as SyncDeps;
    await expect(syncRepository(deps, "acme/web")).rejects.toSatisfy(
      (error: unknown) => error instanceof GithubError && error.connectionRequired && error.message.includes("read:project"),
    );
  });
});
