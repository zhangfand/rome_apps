import { describe, expect, it } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigurationFields, ConfigurationEditor, configurationRows, lifecycleChanges } from "./configuration";
import { parseConfig } from "../../lib/config";
const p = parseConfig({ projects: { a: { workingDir: "/a", repo: "acme/a" }, b: { workingDir: "/b", intakeEnabled: false } } });
if (!p.ok) throw new Error(p.error);
const config = p.config;
const rows = configurationRows(config).flatMap((s) => s.rows);
describe("inline setting rows", () => {
  it("renders user-defined hooks and preserves other phases and projects when editing", () => {
    const hook = { agent: "assistant:assistant", instructions: "Check evidence" };
    const next = { ...config, hooks: { prepare: hook, evaluate: hook } };
    expect(lifecycleChanges(next, "evaluate", null)).toEqual({ hooks: { prepare: hook, evaluate: null } });
    const changes = lifecycleChanges(next, "prepare", hook, "a");
    expect(changes).toEqual({ projects: { ...config.projects, a: { ...config.projects!.a, hooks: { prepare: hook } } } });
    const html = renderToStaticMarkup(createElement(ConfigurationFields, { config: next, disabled: false, async save() {} }));
    expect(html).toContain("Lifecycle hooks"); expect(html).toContain("Completion check");
    expect(lifecycleChanges(next, "completion", hook)).toEqual({ hooks: { ...next.hooks, completion: hook } }); expect(html).toContain("Check evidence");
    expect(html).toContain("assistant:assistant"); expect(html).toContain("textarea");
    expect(html).toContain("New tasks snapshot");
  });
  it("sends only the changed setting and exposes no infrastructure controls", () => {
    expect(rows.find((r) => r.id === "maxWorkers")!.changes(5)).toEqual({ maxWorkers: 5 });
    expect(rows.some((r) => ["workerAgent", "intervalMinutes"].includes(r.id))).toBe(false);
    expect(rows.find((r) => r.id === "defaultProject")!.options).toEqual(["a", "b"]);
  });
  it("project row changes preserve other projects and sibling fields", () => {
    expect(rows.find((r) => r.id === "projects.b.intakeEnabled")!.changes(true)).toEqual({ projects: { ...config.projects, b: { workingDir: "/b", intakeEnabled: true } } });
    expect(rows.find((r) => r.id === "projects.a.repo")!.changes("")).toEqual({ projects: { ...config.projects, a: { workingDir: "/a" } } });
    expect(rows.find((r) => r.id === "projects.a.workingDir")!.changes("/new")).toEqual({ projects: { ...config.projects, a: { workingDir: "/new", repo: "acme/a" } } });
  });
  it("renders controls immediately in labeled rows, with no separate edit view", () => {
    const html = renderToStaticMarkup(createElement(ConfigurationFields, { config, disabled: false, async save() {} }));
    for (const text of ["Global worker limit", "Retry limit", "Legacy worker age cap", "Reuse worker sessions", "Close tasks when GitHub issues close", "Default project", "Source directory", "Repository", "Intake label", "Project label", "Issue intake", "new tasks only", "does not stop running workers", 'min="1"', 'max="20"', 'max="168"', 'role="switch"', 'aria-describedby=', 'data-setting-row']) expect(html).toContain(text);
    expect(html.split('data-setting-row').length - 1).toBe(rows.length + (Object.keys(config.projects ?? {}).length + 1) * 3);
    expect(html).not.toContain("Edit configuration"); expect(html).not.toContain("Save changes");
    expect(html).not.toContain(">Save<"); // Save/Cancel only appear on the row with edits.
  });
  it("supports legacy repository lists without inventing project mappings", () => {
    const legacy = parseConfig({ workingDir: "/legacy", intakeRepos: ["acme/a", "acme/b"] });
    if (!legacy.ok) throw new Error(legacy.error);
    const html = renderToStaticMarkup(createElement(ConfigurationFields, { config: legacy.config, disabled: true, async save() {} }));
    expect(html).toContain("Intake repositories"); expect(html).toContain("acme/a, acme/b"); expect(html).toContain("disabled");
    expect(html).not.toContain("Default project");
    const row = configurationRows(legacy.config).flatMap((s) => s.rows).find((r) => r.id === "intakeRepos")!;
    expect(row.changes("acme/a, acme/b, ")).toEqual({ intakeRepos: ["acme/a", "acme/b"] });
    expect(row.changes("")).toEqual({ intakeRepos: [] });
  });
  it("needs no edit button to enter settings", () => {
    const html = renderToStaticMarkup(createElement(ConfigurationEditor, { onSaved() {} }));
    expect(html).toContain("Edit a row"); expect(html).not.toContain("Edit configuration");
  });
});
