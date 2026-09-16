import { describe, expect, it } from "@rstest/core";
import { DEFAULT_SOP } from "../domain/sop.js";
import { DEFAULT_INTAKE_LABEL } from "../domain/adapters/github/config.js";
import { DEFAULT_WORKER_AGENTS, mergeAppConfig, parseAppConfig } from "./config.js";

const base = { projects: { app: { workingDir: "/repo" } } };

describe("app config composition", () => {
  it("takes software-development defaults from the app, not core", () => {
    const parsed = parseAppConfig(base);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.sop).toBe(DEFAULT_SOP);
    expect(parsed.config.workerAgents).toEqual(DEFAULT_WORKER_AGENTS);
    expect(parsed.config.github).toEqual({ intakeLabel: DEFAULT_INTAKE_LABEL });
  });

  it("normalizes the legacy stored GitHub shape on read", () => {
    const parsed = parseAppConfig({
      ...base,
      intakeLabel: "take-me",
      projects: { app: { workingDir: "/repo", repo: "owner/name", intakeLabel: "project", projectLabel: "backend", intakeEnabled: false } },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.github).toEqual({ intakeLabel: "take-me" });
    expect(parsed.config.projects.app).toEqual({
      workingDir: "/repo",
      workspace: "git-worktree",
      github: { repo: "owner/name", intakeLabel: "project", projectLabel: "backend", enabled: false },
    });
    expect(parsed.config.projects.app).not.toHaveProperty("repo");
    expect(parsed.config).not.toHaveProperty("intakeLabel");
  });

  it("accepts the current GitHub shape and lets it win over legacy aliases", () => {
    const parsed = parseAppConfig({
      intakeLabel: "old-global",
      github: { intakeLabel: "new-global" },
      projects: {
        app: {
          workingDir: "/repo",
          repo: "old/repo",
          intakeEnabled: false,
          github: { repo: "new/repo", enabled: true, projectLabel: "app" },
        },
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.github).toEqual({ intakeLabel: "new-global" });
    expect(parsed.config.projects.app.github).toEqual({ repo: "new/repo", enabled: true, projectLabel: "app" });
  });

  it("lets a legacy PATCH update normalized stored settings", () => {
    const current = parseAppConfig({ projects: { app: { workingDir: "/repo", github: { repo: "old/repo", enabled: true } } } });
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    const merged = mergeAppConfig(current.config, { projects: { app: { repo: "new/repo", intakeEnabled: false } }, intakeLabel: "legacy-patch" });
    const parsed = parseAppConfig(merged);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.github).toEqual({ intakeLabel: "legacy-patch" });
    expect(parsed.config.projects.app.github).toEqual({ repo: "new/repo", enabled: false });
  });

  it("deep-merges a partial current-shape PATCH", () => {
    const current = parseAppConfig({ projects: { app: { workingDir: "/repo", github: { repo: "owner/repo", projectLabel: "one" } } } });
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    const parsed = parseAppConfig(mergeAppConfig(current.config, { projects: { app: { github: { enabled: false } } } }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.projects.app.github).toEqual({ repo: "owner/repo", projectLabel: "one", enabled: false });
  });

  it("validates normalized routes across old and new project shapes", () => {
    const parsed = parseAppConfig({ projects: {
      a: { workingDir: "/a", repo: "owner/repo" },
      b: { workingDir: "/b", github: { repo: "owner/repo" } },
    } });
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(/distinct projectLabels/);
  });
});
