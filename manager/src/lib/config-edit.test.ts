import { describe, expect, it } from "@rstest/core";
import { applyConfigEdit, configRevision } from "./config-edit.js";
import { parseConfig } from "./config.js";
const parsed = parseConfig({ projects: { a: { workingDir: "/a", repo: "acme/a" }, b: { workingDir: "/b", repo: "acme/b", intakeEnabled: false } }, defaultProject: "a" });
if (!parsed.ok) throw new Error(parsed.error);
const config = parsed.config;
describe("configuration edits", () => {
  it("strictly edits safe fields without resetting omitted settings", () => {
    const next = applyConfigEdit(config, { maxWorkers: 1, reuseSessions: false, closeOnIssueClosed: false });
    expect(next).toEqual({ ...config, maxWorkers: 1, reuseSessions: false, closeOnIssueClosed: false });
    expect(configRevision(next)).not.toBe(configRevision(config));
    expect(configRevision(structuredClone(config))).toBe(configRevision(config));
  });
  it("allows new-task source and routing edits, preserving project identities", () => {
    const next = applyConfigEdit(config, { projects: { ...config.projects, a: { workingDir: "/new-a", repo: "ACME/NEW", intakeEnabled: false, intakeLabel: "queue", projectLabel: "project:a" } }, defaultProject: "b" });
    expect(next.projects!.a).toEqual({ workingDir: "/new-a", repo: "acme/new", intakeEnabled: false, intakeLabel: "queue", projectLabel: "project:a" });
    expect(next.defaultProject).toBe("b"); expect(next.workingDir).toBe("/b");
  });
  it("supports legacy setup without converting it to projects", () => {
    const p = parseConfig({ workingDir: "/repo", intakeRepos: ["acme/a", "acme/b"] });
    if (!p.ok) throw new Error(p.error);
    expect(applyConfigEdit(p.config, { workingDir: "/new", intakeRepos: [] })).toMatchObject({ workingDir: "/new", intakeRepos: [] });
  });
  it("rejects invalid values rather than clamping/defaulting", () => {
    for (const changes of [null, [], {}, { maxWorkers: 0 }, { maxWorkers: 21 }, { startCap: 1.5 }, { ageCapHours: 169 }, { startCap: "2" }, { reuseSessions: "false" }, { closeOnIssueClosed: null }, { intakeLabel: " " }, { intakeLabel: "a,b" }, { defaultProject: "missing" }]) {
      expect(() => applyConfigEdit(config, changes)).toThrow();
    }
  });
  it("rejects infrastructure, identity, unknown, and malformed project edits", () => {
    for (const changes of [{ workerAgent: "other:agent" }, { intervalMinutes: 10 }, { secret: "no" }, { workingDir: "/new" }, { intakeRepos: [] }, { projects: {} }, { projects: { ...config.projects, c: { workingDir: "/c" } } },
      ...[{ workingDir: "relative" }, { workingDir: "/a\0" }, { workingDir: "/a", repo: "invalid" }, { workingDir: "/a", intakeEnabled: "false" }, { workingDir: "/a", projectLabel: "" }, { workingDir: "/a", unknown: true }].map((a) => ({ projects: { ...config.projects, a } }))]) {
      expect(() => applyConfigEdit(config, changes)).toThrow();
    }
  });
  it("rejects ambiguous intake routes", () => {
    expect(() => applyConfigEdit(config, { projects: { a: { workingDir: "/a", repo: "acme/shared" }, b: { workingDir: "/b", repo: "acme/shared" } } })).toThrow(/distinct projectLabel/);
  });
});
