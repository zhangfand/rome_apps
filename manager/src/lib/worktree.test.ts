import { reconcile } from "./reconcile.js";
import { fold } from "./fold.js";
import { judge } from "./judge.js";
import { afterEach, describe, expect, it } from "@rstest/core";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bindWorkspacePrompt, prepareWorkspace, reusableWorkspace, validateWorkspace } from "./worktree.js";
import { prepareWorkerStart } from "./worker-start.js";
import { parseConfig } from "./config.js";
import { LedgerBuilder } from "./test-facts.js";
import { foldTask } from "./fold.js";
import type { NewFact, StartedFact } from "./facts.js";
import { buildWorkerPrompt } from "./prompt.js";
import { summonWithFallback } from "../actions/run-worker/index.js";
import { bindProject } from "./projects.js";

const cleanup: string[] = [];
afterEach(async () => { for (const p of cleanup.splice(0)) await rm(p, { recursive: true, force: true }); });
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
async function fixture() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "manager worktrees-"));
  cleanup.push(parent);
  const source = path.join(parent, "repo");
  await mkdir(path.join(source, "packages", "app"), { recursive: true });
  git(source, "init", "-b", "main");
  await writeFile(path.join(source, "packages/app/code.txt"), "base\n");
  git(source, "add", ".");
  git(source, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "base");
  const parsed = parseConfig({ workingDir: path.join(source, "packages/app") });
  if (!parsed.ok) throw new Error(parsed.error);
  return { source, config: parsed.config, workingDir: parsed.config.workingDir };
}
function ledger() {
  const b = new LedgerBuilder().add({ taskId: "t1", kind: "Created", by: "guardian", payload: { brief: "Implement the feature" } })
    .add({ taskId: "t1", kind: "Taken", by: "runtime", payload: {} });
  return {
    b,
    factsFor: (_id: string) => b.facts,
    append: (fact: NewFact) => { b.add(fact); return b.facts.at(-1)!; },
    appendWorkerOutcome: (fact: NewFact) => { b.add(fact); return b.facts.at(-1)!; },
  };
}
function lastStart(l: ReturnType<typeof ledger>) {
  return l.b.facts.filter(f => f.kind === "Started").at(-1) as StartedFact;
}
async function start(l: ReturnType<typeof ledger>, config: Awaited<ReturnType<typeof fixture>>["config"], workerId = "w1", resumeSessionId?: string) {
  const task = foldTask(l.b.facts);
  await prepareWorkerStart({ taskId: "t1", kind: "Started", by: "runtime", payload: {
    workerId, resumeSessionId,
    prompt: buildWorkerPrompt({ task, config, resume: resumeSessionId ? { workerId: "w1", sessionId: resumeSessionId } : undefined }),
  } }, l, config);
  return lastStart(l);
}

describe("real Git worktree isolation", () => {
  it("routes simultaneous tasks into two real repositories, preserving subdirectories", async () => {
    const one = await fixture(); const two = await fixture();
    const config = { ...one.config, projects: {
      rome: { workingDir: one.workingDir }, manager: { workingDir: two.workingDir },
    }, defaultProject: "rome" };
    const a = ledger(); const b = ledger();
    a.append({ taskId: "t1", kind: "Bound", by: "runtime", payload: bindProject(config, "rome") });
    b.append({ taskId: "t1", kind: "Bound", by: "runtime", payload: bindProject(config, "manager") });
    const [first, second] = await Promise.all([start(a, config), start(b, config)]);
    expect(first.payload.workspace!.commonDir).toBe(path.join(one.source, ".git"));
    expect(second.payload.workspace!.commonDir).toBe(path.join(two.source, ".git"));
    expect(second.payload.projectId).toBe("manager");
    expect(second.payload.workspace!.workingDir).toBe(path.join(second.payload.workspace!.root, "packages/app"));
    expect(second.payload.prompt).not.toContain(`Working directory: ${config.workingDir}\n`);
    await writeFile(path.join(second.payload.workspace!.workingDir, "code.txt"), "manager only\n");
    expect(await readFile(path.join(first.payload.workspace!.workingDir, "code.txt"), "utf8")).toBe("base\n");
    expect(await readFile(path.join(two.workingDir, "code.txt"), "utf8")).toBe("base\n");
  });

  it("keeps the original repository, dirty tree and session after project removal/default changes, including fallback", async () => {
    const one = await fixture(); const two = await fixture();
    const config = { ...one.config, projects: { manager: { workingDir: two.workingDir } }, defaultProject: "manager" };
    const l = ledger();
    l.append({ taskId: "t1", kind: "Bound", by: "runtime", payload: bindProject(config, "manager") });
    const first = await start(l, config);
    await writeFile(path.join(first.payload.workspace!.workingDir, "code.txt"), "unfinished\n");
    l.append({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "wait", sessionId: "s1" } });
    const changed = { ...one.config, projects: { rome: { workingDir: one.workingDir } }, defaultProject: "rome" };
    const next = await start(l, changed, "w2", "s1");
    expect(next.payload.workspace).toEqual(first.payload.workspace);
    expect(next.payload.resumeSessionId).toBe("s1");
    expect(await readFile(path.join(next.payload.workspace!.workingDir, "code.txt"), "utf8")).toBe("unfinished\n");
    const calls: Record<string, unknown>[] = [];
    await summonWithFallback({ ledger: l, managerConfig: changed, started: next, source: "test", appContext: {
      invokeAction: (_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { events: (async function* () {})(), result: Promise.resolve(calls.length === 1
          ? { status: "error", error: "session was not found or cannot be resumed" }
          : { status: "ok", data: { result: "done", sessionId: "s2" } }) };
      },
    } as never });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.prompt).toContain(`Working directory: ${first.payload.workspace!.workingDir}`);
      expect(call.prompt).not.toContain(`Working directory: ${one.workingDir}\n`);
      expect(call.prompt).not.toContain(`Working directory: ${two.workingDir}\n`);
    }
  });

  it("never reuses a session/worktree from a different repository even with corrupt previous metadata", async () => {
    const one = await fixture(); const two = await fixture(); const l = ledger();
    const first = await start(l, one.config);
    l.append({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "ready", sessionId: "s1" } });
    l.append({ taskId: "t1", kind: "Bound", by: "runtime", payload: { projectId: "manager", project: { workingDir: two.workingDir } } });
    await start(l, two.config, "w2", "s1");
    expect(l.b.facts.at(-1)).toMatchObject({ kind: "Failed" });
    expect((l.b.facts.at(-1)!.payload as { error: string }).error).toContain("Configured repository changed");
    expect(lastStart(l).payload.workspace).toEqual(first.payload.workspace);
  });

  it("resumes a due waiting task in the same dirty worktree with its protocol intact", async () => {
    const { config } = await fixture();
    const l = ledger();
    const first = await start(l, config);
    const workspace = first.payload.workspace!;
    await writeFile(path.join(workspace.workingDir, "code.txt"), "review fixes in progress\n");
    const result = { outcome: "waiting" as const, reason: "PR 7 needs another check", revisitAfterSeconds: 300 };
    l.append({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: JSON.stringify(result), result, sessionId: "s1" } });
    const run = (now: Date) => reconcile({ snapshot: fold(now, l.b.facts), config, judge, newWorkerId: () => "w2" });
    for (const action of run(l.b.now(0))) if (action.type === "append") l.append(action.fact);
    expect(foldTask(l.b.facts).position).toBe("waiting");
    const due = run(l.b.now(5));
    const started = due.find(a => a.type === "append" && a.fact.kind === "Started");
    if (!started || started.type !== "append") throw new Error("Expected a due start");
    await prepareWorkerStart(started.fact, l, config);
    const next = lastStart(l);
    expect(next.payload.workspace).toEqual(workspace);
    expect(next.payload.resumeSessionId).toBe("s1");
    expect(next.payload.replyProtocol).toBe(1);
    expect(next.payload.prompt).toContain("Worker reply protocol v1");
    expect(next.payload.prompt).toContain(`Working directory: ${workspace.workingDir}`);
    expect(await readFile(path.join(workspace.workingDir, "code.txt"), "utf8")).toBe("review fixes in progress\n");
  });

  it("gives parallel tasks separate branches/indexes and preserves a dirty source and its branch", async () => {
    const { source, workingDir } = await fixture();
    git(source, "switch", "-c", "unrelated-feature");
    await writeFile(path.join(workingDir, "code.txt"), "unrelated staged\n");
    git(source, "add", ".");
    await writeFile(path.join(workingDir, "untracked.txt"), "unrelated\n");
    const before = git(source, "status", "--porcelain");
    const [one, two] = await Promise.all([
      prepareWorkspace({ workingDir, taskId: "t1", workerId: "w1" }),
      prepareWorkspace({ workingDir, taskId: "t2", workerId: "w2" }),
    ]);
    expect(one.root).not.toBe(two.root);
    expect(one.branch).not.toBe(two.branch);
    expect(one.workingDir).toBe(path.join(one.root, "packages/app"));
    expect(await readFile(path.join(one.workingDir, "code.txt"), "utf8")).toBe("base\n");
    await writeFile(path.join(one.workingDir, "code.txt"), "only worker one\n");
    git(one.root, "add", ".");
    expect(git(two.root, "status", "--porcelain")).toBe("");
    expect(git(source, "status", "--porcelain")).toBe(before);
    expect(git(source, "branch", "--show-current")).toBe("unrelated-feature");
  });

  it("uses the locally known remote default branch when available", async () => {
    const { source, workingDir } = await fixture();
    const base = git(source, "rev-parse", "HEAD");
    git(source, "update-ref", "refs/remotes/origin/trunk", base);
    git(source, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
    await writeFile(path.join(workingDir, "code.txt"), "local-only main\n");
    git(source, "add", ".");
    git(source, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "local");
    const workspace = await prepareWorkspace({ workingDir, taskId: "t1", workerId: "w1" });
    expect(workspace.baseCommit).toBe(base);
  });

  it("reuses a returned worker's tree and dirty changes even when session reuse is off", async () => {
    const { config } = await fixture(); const l = ledger();
    const first = await start(l, config);
    const tree = first.payload.workspace!;
    git(tree.root, "branch", "-m", "feature-published");
    await writeFile(path.join(tree.workingDir, "code.txt"), "unfinished\n");
    l.append({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "done", sessionId: "s1" } });
    const next = await start(l, { ...config, reuseSessions: false }, "w2");
    expect(next.payload.workspace).toEqual(tree);
    expect(git(tree.root, "branch", "--show-current")).toBe("feature-published");
    expect(await readFile(path.join(tree.workingDir, "code.txt"), "utf8")).toBe("unfinished\n");
  });

  it("resumes a safe session in the same tree, with authoritative cwd in its delta", async () => {
    const { config } = await fixture(); const l = ledger();
    const first = await start(l, config);
    l.append({ taskId: "t1", kind: "Failed", by: "w1", payload: { workerId: "w1", error: "temporary", sessionId: "s1" } });
    const next = await start(l, config, "w2", "s1");
    expect(next.payload.workspace).toEqual(first.payload.workspace);
    expect(next.payload.resumeSessionId).toBe("s1");
    expect(next.payload.prompt).toContain(`Working directory: ${first.payload.workspace!.workingDir}`);
    expect(next.payload.prompt).not.toContain("What was asked for:");
  });

  it("forks after Lost without touching the old worker's checkout", async () => {
    const { config } = await fixture(); const l = ledger();
    const first = await start(l, config);
    await writeFile(path.join(first.payload.workspace!.workingDir, "code.txt"), "still running\n");
    l.append({ taskId: "t1", kind: "Lost", by: "runtime", payload: { workerId: "w1", why: "stopped by runtime" } });
    expect(reusableWorkspace(l.b.facts)).toBeUndefined();
    const next = await start(l, config, "w2");
    expect(next.payload.workspace!.root).not.toBe(first.payload.workspace!.root);
    expect(await readFile(path.join(first.payload.workspace!.workingDir, "code.txt"), "utf8")).toBe("still running\n");
  });

  it("does not hand over a tree while its latest worker is still running", async () => {
    const { config } = await fixture(); const l = ledger();
    await start(l, config);
    expect(reusableWorkspace(l.b.facts)).toBeUndefined();
  });

  it("migrates legacy shared-checkout sessions to a fresh full brief", async () => {
    const { config } = await fixture(); const l = ledger();
    l.append({ taskId: "t1", kind: "Started", by: "runtime", payload: { workerId: "old", prompt: "legacy" } });
    l.append({ taskId: "t1", kind: "Returned", by: "old", payload: { workerId: "old", reply: "PR #7", sessionId: "legacy" } });
    const next = await start(l, config, "w2", "legacy");
    expect(next.payload.resumeSessionId).toBeUndefined();
    expect(next.payload.prompt).toContain("What was asked for:");
    expect(next.payload.prompt).toContain("PR #7");
    expect(next.payload.prompt).not.toContain(`Working directory: ${config.workingDir}\n`);
  });

  it("records preparation errors as Failed rather than allowing a shared-checkout launch", async () => {
    const { config } = await fixture(); const l = ledger();
    await start(l, { ...config, workingDir: path.dirname(path.dirname(config.workingDir)) + "-missing" });
    expect(lastStart(l).payload.workspace).toBeUndefined();
    expect(l.b.facts.at(-1)).toMatchObject({ kind: "Failed", payload: { workerId: "w1" } });
    expect((l.b.facts.at(-1)!.payload as { error: string }).error).toContain("Could not prepare isolated worker worktree");
  });

  it("never silently recreates a removed worktree, including on repeated preparation failures", async () => {
    const { config } = await fixture(); const l = ledger();
    const first = await start(l, config);
    l.append({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "done" } });
    await rm(first.payload.workspace!.root, { recursive: true, force: true });
    for (const workerId of ["w2", "w3"]) {
      await start(l, config, workerId);
      expect(l.b.facts.at(-1)!.kind).toBe("Failed");
      expect(lastStart(l).payload.workspace).toEqual(first.payload.workspace);
    }
  });

  it("rejects a different configured repository rather than handing over the old tree", async () => {
    const one = await fixture(); const two = await fixture();
    const tree = await prepareWorkspace({ workingDir: one.workingDir, taskId: "t1", workerId: "w1" });
    await expect(prepareWorkspace({ workingDir: two.workingDir, taskId: "t1", workerId: "w2", previous: tree })).rejects.toThrow("Configured repository changed");
  });

  it("refuses unknown path/branch collisions, unsafe ids, and the main checkout", async () => {
    const { source, workingDir } = await fixture();
    const tree = await prepareWorkspace({ workingDir, taskId: "t1", workerId: "w1" });
    await expect(prepareWorkspace({ workingDir, taskId: "t1", workerId: "w1" })).rejects.toThrow();
    await expect(prepareWorkspace({ workingDir, taskId: "../../escape", workerId: "w2" })).rejects.toThrow("Unsafe");
    await expect(validateWorkspace({ ...tree, root: source, workingDir })).rejects.toThrow("shared main checkout");
  });

  it("accepts a linked source worktree and preserves its repository-relative directory", async () => {
    const { source } = await fixture();
    const linked = path.join(path.dirname(source), "linked-source");
    git(source, "worktree", "add", "-b", "source-feature", linked, "HEAD");
    const tree = await prepareWorkspace({ workingDir: path.join(linked, "packages/app"), taskId: "t1", workerId: "w1" });
    expect(tree.workingDir).toBe(path.join(tree.root, "packages/app"));
    expect(tree.commonDir).toBe(path.join(source, ".git"));
  });

  it("keeps the isolated path in a full fallback brief", async () => {
    const { config } = await fixture(); const l = ledger();
    const first = await start(l, config);
    const prompt = bindWorkspacePrompt(buildWorkerPrompt({ task: foldTask(l.b.facts), config, reason: "resume rejected" }), first.payload.workspace!, config.workingDir);
    expect(prompt).toContain(`Working directory: ${first.payload.workspace!.workingDir}`);
    expect(prompt).not.toContain(`Working directory: ${config.workingDir}\n`);
  });

  it("validates before summon and refuses legacy or deleted workspaces without invoking an agent", async () => {
    const { config } = await fixture(); const l = ledger();
    const first = await start(l, config);
    const input = { ledger: l, managerConfig: config, source: "test", appContext: {
      invokeAction: () => { throw new Error("SHOULD NOT SUMMON"); },
    } as never };
    const legacy = await summonWithFallback({ ...input, started: { ...first, payload: { ...first.payload, workspace: undefined } } });
    expect(legacy).toMatchObject({ ok: false, error: "Worker has no isolated worktree; refusing shared-checkout launch" });
    await rm(first.payload.workspace!.root, { recursive: true, force: true });
    const missing = await summonWithFallback({ ...input, started: first });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).not.toContain("SHOULD NOT SUMMON");
  });

  it("summons and resumes/falls back with the exact recorded isolated directory", async () => {
    const { config } = await fixture(); const l = ledger();
    await start(l, config);
    l.append({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "done", sessionId: "s1" } });
    const next = await start(l, config, "w2", "s1");
    const calls: Record<string, unknown>[] = [];
    const result = await summonWithFallback({ ledger: l, managerConfig: config, started: next, source: "test", appContext: {
      invokeAction: (_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { events: (async function* () {})(), result: Promise.resolve(calls.length === 1
          ? { status: "error", error: "session was not found or cannot be resumed" }
          : { status: "ok", data: { result: "done", sessionId: "s2" } }) };
      },
    } as never });
    expect(result).toMatchObject({ ok: true, restarted: true, sessionId: "s2" });
    expect(calls).toHaveLength(2);
    expect(calls[0].sessionId).toBe("s1");
    expect(calls[1].sessionId).toBeUndefined();
    for (const call of calls) {
      expect(call.prompt).toContain(`Working directory: ${next.payload.workspace!.workingDir}`);
      expect(call.prompt).not.toContain(`Working directory: ${config.workingDir}\n`);
    }
    expect(l.b.facts.at(-1)!.kind).toBe("Restarted");
  });
});
