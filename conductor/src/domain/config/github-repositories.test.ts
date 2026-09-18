import { describe, expect, it } from "@rstest/core";
import { listGitHubRepositories } from "./github-repositories.js";

const rows = [
  { nameWithOwner: "owner/private", description: "Agent coordination", private: true, archived: false, updatedAt: "2026-09-18T00:00:00Z" },
  { nameWithOwner: "org/public", description: null, private: false, archived: false, updatedAt: "2026-09-17T00:00:00Z" },
  { nameWithOwner: "owner/archive", description: "Old app", private: true, archived: true, updatedAt: "2025-01-01T00:00:00Z" },
];

describe("GitHub repository selector data", () => {
  it("parses accessible repository summaries", async () => {
    const result = await listGitHubRepositories("", async () => rows.map((row) => JSON.stringify(row)).join("\n"));
    expect(result).toEqual({ repositories: [
      rows[0],
      { nameWithOwner: "org/public", private: false, archived: false, updatedAt: "2026-09-17T00:00:00Z" },
      rows[2],
    ], truncated: false });
  });

  it("filters by repository name or description and ignores malformed rows", async () => {
    const output = ["not-json", ...rows.map((row) => JSON.stringify(row))].join("\n");
    expect((await listGitHubRepositories("agent", async () => output)).repositories.map((repo) => repo.nameWithOwner)).toEqual(["owner/private"]);
    expect((await listGitHubRepositories("ORG/", async () => output)).repositories.map((repo) => repo.nameWithOwner)).toEqual(["org/public"]);
  });
});
