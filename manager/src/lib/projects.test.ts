import { describe, expect, it } from "@rstest/core";
import { parseConfig, type ManagerConfig } from "./config.js";
import { bindProject, configForTask, configuredProjects, intakeRoutes, legacyBindingFacts, resolveBoardProject, resolveHumanProject, routeIssue } from "./projects.js";
import { intakeFacts, toIntakeIssue } from "./intake.js";
import { fold, foldTask } from "./fold.js";
import { LedgerBuilder } from "./test-facts.js";
import { reconcile } from "./reconcile.js";
import { judge } from "./judge.js";
import { buildView } from "./view.js";

function config(raw: unknown): ManagerConfig {
  const result = parseConfig(raw);
  if (!result.ok) throw new Error(result.error);
  return result.config;
}
const projects = {
  rome: { workingDir: "/src/rome", repo: "acme/rome" },
  manager: { workingDir: "/src/apps/manager", repo: "acme/apps" },
};
const multi = config({ projects, defaultProject: "rome" });
const shared = config({ projects: {
  manager: { workingDir: "/src/apps/manager", repo: "acme/apps", projectLabel: "project:manager" },
  inbox: { workingDir: "/src/apps/inbox", repo: "acme/apps", projectLabel: "project:inbox" },
} });
const created = (b: LedgerBuilder, taskId: string, projectId?: string) => b.add({
  taskId, kind: "Created", by: "ann", payload: { brief: "Do the work", ...(projectId ? bindProject(multi, projectId) : {}) },
});

describe("multi-project configuration and human routing", () => {
  it("accepts projects without global workingDir and round-trips stored settings", () => {
    expect(multi.workingDir).toBe("/src/rome");
    expect(config(JSON.parse(JSON.stringify(multi)))).toEqual(multi);
    expect(configuredProjects(config({ workingDir: "/old" }))).toEqual({ default: { workingDir: "/old" } });
  });
  it("rejects malformed paths, repositories, defaults and overlapping shared-repo rules", () => {
    for (const raw of [
      { projects: {} }, { projects: [] }, { projects: { x: { workingDir: "relative" } } },
      { projects: { x: { workingDir: "/x", repo: "bad/repo/path" } } },
      { projects, defaultProject: "missing" }, { projects, intakeRepos: ["acme/old"] },
      { projects: { a: { workingDir: "/a", repo: "a/b" }, b: { workingDir: "/b", repo: "a/b" } } },
      { projects: { a: { workingDir: "/a", repo: "a/b", projectLabel: "a" }, b: { workingDir: "/b", repo: "A/B", projectLabel: "A" } } },
      { projects: { x: { workingDir: "/x", projectLabel: "a,b" } } },
    ]) expect(parseConfig(raw).ok).toBe(false);
  });
  it("explicit project overrides chat context and snapshots only execution fields", () => {
    expect(resolveHumanProject(multi, { projectId: "manager", projectPath: "/src/rome" }))
      .toEqual({ projectId: "manager", project: { workingDir: "/src/apps/manager", repo: "acme/apps" } });
    expect(() => resolveHumanProject(multi, { projectId: "missing" })).toThrow("Unknown project");
    expect(() => resolveHumanProject(multi, { projectId: "constructor" })).toThrow("Unknown project");
  });
  it("maps selected chat directory, never falls back on an unmapped or ambiguous selection", () => {
    expect(resolveHumanProject(multi, { projectPath: "/src/apps/manager/" }).projectId).toBe("manager");
    expect(resolveHumanProject(multi, { projectName: "manager" }).projectId).toBe("manager");
    expect(() => resolveHumanProject(multi, {})).toThrow("ambiguous");
    expect(() => resolveHumanProject(multi, { projectPath: "/elsewhere", projectName: "manager" })).toThrow("not mapped");
    const duplicate = config({ projects: { a: { workingDir: "/x" }, b: { workingDir: "/x" } } });
    expect(() => resolveHumanProject(duplicate, { projectPath: "/x" })).toThrow("multiple projects");
    expect(resolveHumanProject(config({ workingDir: "/old" }), {}).projectId).toBe("default");
  });
});

describe("GitHub and Board intake", () => {
  it("routes by repo and requires all labels; ambiguous shared-repo issues never start", () => {
    expect(routeIssue(intakeRoutes(multi), "ACME/APPS", ["ready-for-agent"])?.projectId).toBe("manager");
    expect(routeIssue(intakeRoutes(multi), "acme/apps", [])).toBeUndefined();
    const routes = intakeRoutes(shared);
    expect(routeIssue(routes, "acme/apps", ["ready-for-agent", "project:manager"])?.projectId).toBe("manager");
    expect(routeIssue(routes, "acme/apps", ["ready-for-agent"])).toBeUndefined();
    expect(routeIssue(routes, "acme/apps", ["ready-for-agent", "project:manager", "project:inbox"])).toBeUndefined();
    expect(routeIssue(routes, "acme/unknown", ["ready-for-agent", "project:manager"])).toBeUndefined();
  });
  it("supports per-project labels, disabling intake, and chat-only projects", () => {
    const c = config({ projects: {
      ...projects, rome: { ...projects.rome, intakeLabel: "implement" },
      manager: { ...projects.manager, intakeEnabled: false }, local: { workingDir: "/local" },
    } });
    expect(intakeRoutes(c)).toHaveLength(1);
    expect(intakeRoutes(c)[0].labels).toEqual(["implement"]);
  });
  it("makes one pinned task per canonical issue including duplicate polling and closed historical tasks", () => {
    const issue = toIntakeIssue("acme/apps", { number: 7, html_url: "https://github.com/acme/apps/issues/7",
      title: "Improve Manager", body: "Details", user: { login: "ann" }, labels: [{ name: "ready-for-agent" }] })!;
    const b = new LedgerBuilder();
    let id = 0;
    const take = () => intakeFacts({ snapshot: fold(b.now(), b.facts), issues: [issue, issue], routes: intakeRoutes(multi), label: "ready-for-agent", newTaskId: () => `t${++id}` });
    const facts = take();
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ by: "github:ann", payload: { projectId: "manager", project: projects.manager } });
    b.add(facts[0]).add({ taskId: "t1", kind: "Completed", by: "ann", payload: {} });
    expect(take()).toEqual([]);
    expect(intakeFacts({ snapshot: fold(b.now(), []), issues: [{ ...issue, isPullRequest: true }], routes: intakeRoutes(multi), label: "ready-for-agent", newTaskId: () => "pr" })).toEqual([]);
  });
  it("manual Board asks skip the intake label, not project identity", () => {
    expect(resolveBoardProject(multi, "acme/apps", []).projectId).toBe("manager");
    expect(resolveBoardProject(shared, "acme/apps", ["project:inbox"]).projectId).toBe("inbox");
    expect(() => resolveBoardProject(shared, "acme/apps", [])).toThrow("ambiguous");
    expect(() => resolveBoardProject(multi, "acme/unknown", [])).toThrow("missing");
  });
});

describe("durable binding and scheduling", () => {
  it("migrates append-only, once, using old settings rather than the new default", () => {
    const old = config({ workingDir: "/old/repo", intakeRepos: ["acme/apps"] });
    const b = created(new LedgerBuilder(), "t1");
    b.add({ taskId: "t1", kind: "Taken", by: "runtime", payload: {} });
    b.add({ taskId: "t1", kind: "Report", by: "runtime", payload: { what: "Review", evidence: "PR" } });
    const before = foldTask(b.facts);
    const original = JSON.stringify(b.facts);
    const bindings = legacyBindingFacts(b.facts, old);
    expect(JSON.stringify(b.facts)).toBe(original);
    b.add(bindings[0]);
    const after = foldTask(b.facts);
    expect(after.project).toEqual({ workingDir: "/old/repo" });
    expect(after.projectId).toBe("default");
    expect(after.latest).toEqual(before.latest);
    expect(after.position).toBe("reported");
    expect(after.lastPersonFactSeq).toBe(before.lastPersonFactSeq);
    expect(after.startsSinceLastProgress).toBe(before.startsSinceLastProgress);
    expect(legacyBindingFacts(b.facts, multi)).toEqual([]);
    expect(configForTask(multi, after).workingDir).toBe("/old/repo");
  });
  it("migration metadata preserves pending outcomes, due waits and replies", () => {
    for (const fact of [
      { kind: "Returned", payload: { workerId: "w", reply: "ready" } },
      { kind: "Failed", payload: { workerId: "w", error: "error" } },
      { kind: "Deferred", payload: { workerId: "w", reason: "wait", resumeAfter: "2026-09-08T10:00:00Z" } },
      { kind: "Reply", payload: { text: "Continue" } },
    ] as const) {
      const b = created(new LedgerBuilder(), "t1").add({ taskId: "t1", kind: "Taken", by: "runtime", payload: {} })
        .add({ taskId: "t1", by: "runtime", ...fact });
      const before = foldTask(b.facts);
      b.add(legacyBindingFacts(b.facts, config({ workingDir: "/old" }))[0]);
      expect(foldTask(b.facts).latest).toEqual(before.latest);
      expect(foldTask(b.facts).waiting).toEqual(before.waiting);
    }
  });
  it("configuration edits and replies cannot retarget a bound task", () => {
    const b = created(new LedgerBuilder(), "t1", "manager");
    b.add({ taskId: "t1", kind: "Reply", by: "ann", payload: { text: "Continue" } });
    const changed = config({ projects: { rome: projects.rome }, defaultProject: "rome" });
    expect(configForTask(changed, foldTask(b.facts)).workingDir).toBe(projects.manager.workingDir);
    expect(() => configForTask(multi, {})).toThrow("no durable project binding");
  });
  it("uses one global capacity budget across projects and project-specific fresh prompts", () => {
    const b = created(created(new LedgerBuilder(), "t1", "rome"), "t2", "manager");
    const actions = reconcile({ snapshot: fold(b.now(), b.facts), config: { ...multi, maxWorkers: 1 }, judge, newWorkerId: () => "w1" });
    expect(actions.filter((a) => a.type === "launch")).toHaveLength(1);
    const both = reconcile({ snapshot: fold(b.now(), b.facts), config: multi, judge, newWorkerId: () => "w" });
    const starts = both.filter((a) => a.type === "append" && a.fact.kind === "Started");
    expect(starts).toHaveLength(2);
    expect(JSON.stringify(starts[1])).toContain("/src/apps/manager");
  });
  it("filters all dashboard counts and ledger rows before pagination while retaining project options", () => {
    const b = created(created(new LedgerBuilder(), "t1", "rome"), "t2", "manager");
    const view = buildView({ now: b.now(), facts: b.facts, config: multi, lock: undefined, projectId: "manager" });
    expect(view.projects).toEqual(["manager", "rome"]);
    expect(view.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(view.counts.tasks.created).toBe(1);
    expect(view.counts.facts).toBe(1);
    expect(view.ledger[0].taskId).toBe("t2");
  });
  it("legacy tasks are visible in their project filter before the first migration tick without fabricating ledger facts", () => {
    const b = created(new LedgerBuilder(), "old");
    const view = buildView({ now: b.now(), facts: b.facts, config: config({ workingDir: "/old" }), lock: undefined, projectId: "default" });
    expect(view.tasks).toHaveLength(1);
    expect(view.tasks[0]).toMatchObject({ projectId: "default", project: { workingDir: "/old" } });
    expect(view.counts.facts).toBe(1);
    expect(b.facts).toHaveLength(1);
  });
});
