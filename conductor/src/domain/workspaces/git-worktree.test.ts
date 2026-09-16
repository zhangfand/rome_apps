import { describe, expect, it } from "@rstest/core";
import { inspectGitWorkspace } from "./git-worktree.js";

describe("git workspace inspection", () => {
  it("shapes Git output into a safe inspection", async () => {
    const calls: string[][] = [];
    const result = await inspectGitWorkspace(process.cwd(), async (_cwd, ...args) => {
      calls.push(args);
      const command = args.join(" ");
      if (command === "rev-parse --show-toplevel") return "/work/repo\n";
      if (command === "remote get-url origin") return "git@github.com:Owner/Repo.git\n";
      if (command === "symbolic-ref refs/remotes/origin/HEAD") return "refs/remotes/origin/main\n";
      if (command === "status --porcelain") return " M src/file.ts\n";
      throw new Error(`unexpected command ${command}`);
    });

    expect(result).toEqual({
      exists: true,
      isRepository: true,
      root: "/work/repo",
      originUrl: "git@github.com:Owner/Repo.git",
      originRepo: "Owner/Repo",
      defaultBranch: "main",
      dirty: true,
    });
    expect(calls).toHaveLength(4);
  });

  it("does not throw when Git rejects an existing directory", async () => {
    const result = await inspectGitWorkspace(process.cwd(), async () => {
      throw Object.assign(new Error("failed"), { stderr: "fatal: not a git repository\n" });
    });
    expect(result).toEqual({ exists: true, isRepository: false, problem: "fatal: not a git repository" });
  });
});
