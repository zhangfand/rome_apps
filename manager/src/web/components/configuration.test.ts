import { describe, expect, it } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigurationFields, ConfigurationEditor, configurationChanges } from "./configuration";
import { parseConfig } from "../../lib/config";
const p = parseConfig({ projects: { a: { workingDir: "/a", repo: "acme/a" }, b: { workingDir: "/b", intakeEnabled: false } } });
if (!p.ok) throw new Error(p.error);
const config = p.config;
describe("configuration form", () => {
  it("only sends changed safe fields, not infrastructure", () => {
    expect(configurationChanges(config, structuredClone(config))).toEqual({});
    expect(configurationChanges(config, { ...config, maxWorkers: 5, workerAgent: "ignored", intervalMinutes: 10 })).toEqual({ maxWorkers: 5 });
    expect(configurationChanges(config, { ...config, projects: { ...config.projects, b: { workingDir: "/b", intakeEnabled: true } } })).toEqual({ projects: { ...config.projects, b: { workingDir: "/b", intakeEnabled: true } } });
  });
  it("exposes labeled fields, bounds, impact notes, and read-only infrastructure", () => {
    const html = renderToStaticMarkup(createElement(ConfigurationFields, { config, disabled: false, onChange() {} }));
    for (const text of ["Global worker limit", "Retry limit", "Legacy worker age cap", "Reuse worker sessions", "Close tasks when GitHub issues close", "Default project", "a source directory", "a repository", "a intake label", "a project label", "Enable b issue intake", "Infrastructure", "coding:coding", "new tasks only", "does not stop running workers", 'min="1"', 'max="20"', 'max="168"', 'role="switch"', 'aria-describedby=']) expect(html).toContain(text);
    expect(html).not.toContain('value="coding:coding"');
    expect(html).not.toContain('value="a" name="projectId"');
  });
  it("supports legacy repositories without inventing project mappings", () => {
    const legacy = parseConfig({ workingDir: "/legacy", intakeRepos: ["acme/a", "acme/b"] });
    if (!legacy.ok) throw new Error(legacy.error);
    const html = renderToStaticMarkup(createElement(ConfigurationFields, { config: legacy.config, disabled: true, onChange() {} }));
    expect(html).toContain("Intake repositories"); expect(html).toContain("acme/a, acme/b"); expect(html).toContain("disabled");
    expect(html).not.toContain("Default project");
    expect(configurationChanges(legacy.config, { ...legacy.config, intakeRepos: [] })).toEqual({ intakeRepos: [] });
  });
  it("starts collapsed and makes editing explicit", () => {
    const html = renderToStaticMarkup(createElement(ConfigurationEditor, { onSaved() {} }));
    expect(html).toContain("Edit configuration"); expect(html).not.toContain("Save changes");
  });
});
