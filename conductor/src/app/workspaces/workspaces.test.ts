import { describe, expect, it } from "@rstest/core";
import { parseAppConfig } from "../config.js";
import type { Fact, NewFact } from "../../core/lib/facts.js";
import { foldTask } from "../../core/lib/fold.js";
import { buildOrchestratorPrompt, buildWorkerPrompt } from "../../core/lib/prompts.js";
import {
  handedOverWorkspace,
  projectWorkspaceKind,
  workspaceKind,
} from "../../core/lib/workspaces.js";
import { type GitWorktreeWorkspace, gitWorktreeProvider } from "../../domain/workspaces/git-worktree.js";
import { noWorkspaceProvider } from "../../core/workspaces/none.js";
import { providerFor } from "./index.js";

let seq = 0;
const t0 = Date.parse("2026-09-14T00:00:00Z");
function f(fact: Omit<NewFact, "taskId">): Fact {
  seq += 1;
  return { ...fact, taskId: "t-1", seq, id: `f${seq}`, createdAt: new Date(t0 + seq * 1000) } as Fact;
}

const tree: GitWorktreeWorkspace = {
  kind: "git-worktree",
  commonDir: "/repo/.git", root: "/trees/t-1-w-1", workingDir: "/trees/t-1-w-1",
  branch: "conductor/t-1/w-1", baseCommit: "abc123",
};
/** A worktree as facts written before workspace kinds existed carry it. */
const legacyTree = { commonDir: "/repo/.git", root: "/trees/old", workingDir: "/trees/old", branch: "b", baseCommit: "d" } as GitWorktreeWorkspace;

const dispatched = (workerId: string, workspace?: unknown) =>
  f({ kind: "Dispatched", by: "orchestrator", payload: { workerId, agent: "coding:coding", instructions: "x", prompt: "x", ...(workspace ? { workspace } : {}) } as never });

describe("reading a stored workspace", () => {
  it("treats a workspace written before kinds existed as a git worktree", () => {
    expect(workspaceKind(legacyTree, "git-worktree")).toBe("git-worktree");
    expect(workspaceKind(tree, "git-worktree")).toBe("git-worktree");
    expect(workspaceKind({ kind: "none" }, "git-worktree")).toBe("none");
  });

  it("defaults a project with no stated kind to a git worktree", () => {
    expect(projectWorkspaceKind(undefined, "git-worktree")).toBe("git-worktree");
    expect(projectWorkspaceKind({ workingDir: "/repo" }, "git-worktree")).toBe("git-worktree");
    expect(projectWorkspaceKind({ workspace: "none" }, "git-worktree")).toBe("none");
  });

  it("routes an unknown kind to the git worktree provider rather than crashing", () => {
    expect(providerFor("git-worktree")).toBe(gitWorktreeProvider);
    expect(providerFor("none")).toBe(noWorkspaceProvider);
    expect(providerFor("made-up" as never)).toBe(gitWorktreeProvider);
  });
});

describe("handing a workspace to the next worker", () => {
  it("hands over what the last worker left when it ended cleanly", () => {
    const facts = [dispatched("w-1", tree), f({ kind: "Returned", by: "w-1", payload: { workerId: "w-1", status: "succeeded", summary: "done" } })];
    expect(handedOverWorkspace(facts)).toEqual(tree);
  });

  it("refuses to hand over after Lost: that worker may still be writing", () => {
    const facts = [dispatched("w-1", tree), f({ kind: "Lost", by: "runtime", payload: { workerId: "w-1", why: "heartbeat expired" } })];
    expect(handedOverWorkspace(facts)).toBeUndefined();
  });

  it("hands nothing over while the worker is still live, or when there was none", () => {
    expect(handedOverWorkspace([dispatched("w-1", tree)])).toBeUndefined();
    expect(handedOverWorkspace([])).toBeUndefined();
  });

  it("only the latest worker hands over", () => {
    const facts = [
      dispatched("w-1", tree),
      f({ kind: "Returned", by: "w-1", payload: { workerId: "w-1", status: "succeeded", summary: "a" } }),
      dispatched("w-2", { kind: "none" }),
      f({ kind: "Returned", by: "w-2", payload: { workerId: "w-2", status: "succeeded", summary: "b" } }),
    ];
    expect(handedOverWorkspace(facts)).toEqual({ kind: "none" });
  });
});

describe("the none provider", () => {
  it("records its absence explicitly, so it is never mistaken for a lost workspace", async () => {
    expect(await noWorkspaceProvider.prepare({ project: {}, taskId: "t-1", workerId: "w-1" })).toEqual({ kind: "none" });
  });

  it("validates without touching anything, and says nothing in either prompt", async () => {
    await expect(noWorkspaceProvider.validate({ kind: "none" })).resolves.toBeUndefined();
    expect(noWorkspaceProvider.instructions({ kind: "none" })).toBe("");
  });
});

describe("the git-worktree provider keeps its guards", () => {
  it("refuses a project with no working directory", async () => {
    await expect(gitWorktreeProvider.prepare({ project: { workspace: "git-worktree" }, taskId: "t-1", workerId: "w-1" }))
      .rejects.toThrow(/needs a workingDir/);
  });

  it("refuses to validate an absent workspace as if it were a tree", async () => {
    await expect(gitWorktreeProvider.validate({ kind: "none" })).rejects.toThrow(/expected a git worktree/);
  });
});

describe("prompts follow the workspace kind", () => {
  const task = foldTask([f({ kind: "Created", by: "zhangfan", source: "do it", payload: { brief: "Find out X", projectId: "p", project: { workingDir: "/repo", workspace: "none" } } })]);
  const gitTask = foldTask([f({ kind: "Created", by: "zhangfan", source: "do it", payload: { brief: "Add slugify", projectId: "p", project: { workingDir: "/repo" } } })]);

  it("tells a worker only where its worktree is, and a workspace-less worker nothing", () => {
    const withTree = buildWorkerPrompt({ task: gitTask, instructions: "do it", workspace: tree, resuming: false, providerFor, defaultWorkspaceKind: "git-worktree" });
    expect(withTree).toContain("## Workspace");
    expect(withTree).toContain("/trees/t-1-w-1");
    // Worktree rules are worker protocol, carried by the worker Agent's system prompt.
    expect(withTree).not.toContain("Move to this working directory");
    expect(withTree).not.toContain("git lfs");

    const without = buildWorkerPrompt({ task, instructions: "do it", workspace: { kind: "none" }, resuming: false, providerFor, defaultWorkspaceKind: "git-worktree" });
    expect(without).not.toContain("## Workspace");
    expect(without).not.toContain("worktree");
    // The Job prompt passes the handoff, not the Task's original request.
    expect(without).toContain("do it");
    expect(without).not.toContain("Find out X");
  });

  it("keeps workspace policy out of the orchestrator's wake", () => {
    const args = { now: new Date(t0), why: "new facts" };
    expect(buildOrchestratorPrompt({ ...args, task: gitTask })).not.toContain("Workers get their own checkout");
    expect(buildOrchestratorPrompt({ ...args, task })).not.toContain("Workers get their own checkout");
  });

  it("keeps operating policy in the coordinator Agent instead of the wake prompt", () => {
    const prompt = buildOrchestratorPrompt({ task: gitTask, now: new Date(t0), why: "new facts" });
    expect(prompt).not.toContain("## SOP");
    expect(prompt).not.toContain("## Agents you may create a Job for");
    expect(prompt).not.toContain("Decide the next step");
  });

  it("gives neither the lead nor workers shared format contracts", () => {
    const worker = buildWorkerPrompt({ task, instructions: "write the spec", workspace: { kind: "none" }, resuming: false, providerFor, defaultWorkspaceKind: "git-worktree" });
    const lead = buildOrchestratorPrompt({ task, now: new Date(t0), why: "new facts" });
    for (const prompt of [worker, lead]) {
      expect(prompt).not.toContain("_conductor/contracts/");
      expect(prompt).not.toContain("Shared artifact contracts");
    }
  });
});

describe("configuring a project's workspace", () => {
  const parse = (project: Record<string, unknown>) => parseAppConfig({ projects: { p: project } });

  it("defaults to a git worktree and keeps requiring a working directory", () => {
    const ok = parse({ workingDir: "/repo" });
    expect(ok.ok && ok.config.projects.p.workspace).toBe("git-worktree");
    const missing = parse({ repo: "o/n" });
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.error).toMatch(/workingDir must be an absolute path/);
  });

  it("lets a workspace-less project go without one", () => {
    const ok = parse({ workspace: "none" });
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.config.projects.p).toEqual({ workspace: "none" });
  });

  it("still validates a working directory a workspace-less project chooses to carry", () => {
    expect(parse({ workspace: "none", workingDir: "relative/path" }).ok).toBe(false);
    expect(parse({ workspace: "none", workingDir: "/research" }).ok).toBe(true);
  });

  it("refuses a kind it does not have a provider for", () => {
    const bad = parse({ workingDir: "/repo", workspace: "docker" });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch(/workspace must be one of/);
  });
});
