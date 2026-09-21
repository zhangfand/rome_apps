import { describe, expect, it } from "@rstest/core";
import { DEFAULT_SOP } from "../domain/sop.js";
import { DEFAULT_INTAKE_LABEL } from "../domain/adapters/github/config.js";
import { DEFAULT_WORKER_AGENTS, mergeAppConfig, parseAppConfig } from "./config.js";
import { DEFAULT_ORCHESTRATOR_AGENT } from "../core/lib/config.js";

const base = { projects: { app: { workingDir: "/repo" } } };

describe("app config composition", () => {
  it("takes software-development defaults from the app, not core", () => {
    const parsed = parseAppConfig(base);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.sop).toBe(DEFAULT_SOP);
    expect(parsed.config.workerAgents).toEqual(DEFAULT_WORKER_AGENTS);
    expect(parsed.config.orchestratorAgent).toBe(DEFAULT_ORCHESTRATOR_AGENT);
    expect(parsed.config.github).toEqual({ intakeLabel: DEFAULT_INTAKE_LABEL });
    expect(parsed.config.frontdeskShadow).toEqual({ enabled: true, model: "jev-latest" });
    expect(parsed.config.leadRouting).toEqual({ enabled: true, model: "jev-latest" });
  });

  it("validates Jev lead-routing settings without accepting an endpoint or key", () => {
    const parsed = parseAppConfig({ ...base, leadRouting: { enabled: false, model: "jev-1.13.0" } });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.leadRouting).toEqual({ enabled: false, model: "jev-1.13.0" });
    expect(parseAppConfig({ ...base, leadRouting: "on" })).toEqual({ ok: false, error: "leadRouting must be an object" });
    expect(parseAppConfig({ ...base, leadRouting: { model: "bad model" } })).toEqual({
      ok: false,
      error: "leadRouting.model must be a model id using letters, numbers, dots, underscores, or hyphens",
    });
  });

  it("validates front-desk shadow settings without accepting an endpoint or key", () => {
    const parsed = parseAppConfig({ ...base, frontdeskShadow: { enabled: false, model: "jev-1.13.0" } });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.frontdeskShadow).toEqual({ enabled: false, model: "jev-1.13.0" });
    expect(parseAppConfig({ ...base, frontdeskShadow: "on" })).toEqual({ ok: false, error: "frontdeskShadow must be an object" });
    expect(parseAppConfig({ ...base, frontdeskShadow: { model: "bad model" } })).toEqual({
      ok: false,
      error: "frontdeskShadow.model must be a model id using letters, numbers, dots, underscores, or hyphens",
    });
  });

  it("moves the former built-in orchestrator id to the engineering lead without changing a custom coordinator", () => {
    const migrated = parseAppConfig({ ...base, orchestratorAgent: "conductor:orchestrator" });
    expect(migrated.ok).toBe(true);
    if (migrated.ok) expect(migrated.config.orchestratorAgent).toBe("conductor:engineer-lead");

    const custom = parseAppConfig({ ...base, orchestratorAgent: "custom:lead" });
    expect(custom.ok).toBe(true);
    if (custom.ok) expect(custom.config.orchestratorAgent).toBe("custom:lead");
  });

  it("adds the PM worker to the exact pre-PM worker defaults without changing custom allowlists", () => {
    const legacy = {
      "coding:coding": "Writes code in the task's worktree: implements, tests, commits, pushes, opens pull requests. Has a shell and git.",
      "assistant:assistant": "General assistant with web and shell access. Good for research, reading external state (e.g. a PR's review/CI status), reviewing, and writing summaries.",
    };
    const migrated = parseAppConfig({ ...base, workerAgents: legacy });
    expect(migrated.ok).toBe(true);
    if (migrated.ok) expect(migrated.config.workerAgents).toEqual(DEFAULT_WORKER_AGENTS);

    const custom = parseAppConfig({ ...base, workerAgents: { "coding:coding": "Only this worker" } });
    expect(custom.ok).toBe(true);
    if (custom.ok) expect(custom.config.workerAgents).toEqual({ "coding:coding": "Only this worker" });
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
      workRepo: { repo: "owner/app-work", workingDir: "/app-work" },
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

  it("normalizes github.com repository URLs", () => {
    const parsed = parseAppConfig({ projects: { app: { workingDir: "/repo", github: { repo: "https://github.com/owner/name.git/" } } } });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.projects.app.github).toEqual({ repo: "owner/name" });
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

  it("derives one work repository per project and accepts an explicit override", () => {
    const derived = parseAppConfig({ projects: { product: { workingDir: "/projects/product", github: { repo: "owner/code" } } } });
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;
    expect(derived.config.projects.product.workRepo).toEqual({ repo: "owner/product-work", workingDir: "/projects/product-work" });

    const overridden = parseAppConfig({ projects: { product: {
      workingDir: "/projects/product",
      github: { repo: "owner/code" },
      workRepo: { repo: "team/shared-work", workingDir: "/coordination/product" },
    } } });
    expect(overridden.ok).toBe(true);
    if (!overridden.ok) return;
    expect(overridden.config.projects.product.workRepo).toEqual({ repo: "team/shared-work", workingDir: "/coordination/product" });
  });

  it("derives work repositories under the configured coordination owner", () => {
    const parsed = parseAppConfig({
      workRepoOwner: "zhangfand",
      projects: { rome: { workingDir: "/projects/rome", github: { repo: "rome-os/rome" } } },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.workRepoOwner).toBe("zhangfand");
    expect(parsed.config.projects.rome.workRepo).toEqual({ repo: "zhangfand/rome-work", workingDir: "/projects/rome-work" });
  });

  it("deep-merges a work repository PATCH", () => {
    const current = parseAppConfig({ projects: { app: { workingDir: "/repo", github: { repo: "owner/repo" } } } });
    expect(current.ok).toBe(true);
    if (!current.ok) return;
    const parsed = parseAppConfig(mergeAppConfig(current.config, { projects: { app: { workRepo: { workingDir: "/custom/work" } } } }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.projects.app.workRepo).toEqual({ repo: "owner/app-work", workingDir: "/custom/work" });
  });

  it("deletes a project when its PATCH value is null", () => {
    const merged = mergeAppConfig({ projects: { app: { workingDir: "/repo" }, keep: { workspace: "none" } }, defaultProject: "app" }, { projects: { app: null } });
    expect(merged.projects).toEqual({ keep: { workspace: "none" } });
    expect(merged).not.toHaveProperty("defaultProject");
  });

  it("uses the public slug grammar for project ids", () => {
    expect(parseAppConfig({ projects: { "1-app": { workspace: "none" } } }).ok).toBe(true);
    expect(parseAppConfig({ projects: { app_name: { workspace: "none" } } })).toEqual({ ok: false, error: "Invalid project id: app_name" });
  });

  it("allows more than one project to reference the same repository", () => {
    const parsed = parseAppConfig({ projects: {
      a: { workingDir: "/a", repo: "owner/repo" },
      b: { workingDir: "/b", github: { repo: "owner/repo" } },
    } });
    expect(parsed.ok).toBe(true);
  });
});
