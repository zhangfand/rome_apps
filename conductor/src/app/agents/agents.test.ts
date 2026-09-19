import { describe, expect, it } from "@rstest/core";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_SPEC_CONTRACT, PRODUCT_SPEC_CONTRACT_FILE } from "../../domain/product-spec-contract.js";
import { WORK_REPO_CONTRACT, WORK_REPO_CONTRACT_FILE } from "../../domain/work-repo-contract.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(path.join(here, name), "utf8");

describe("Conductor agent boundaries", () => {
  it("registers one task coordinator rather than the obsolete generic orchestrator", () => {
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    expect(manifest).toContain("app/agents/engineer-lead.yaml");
    expect(manifest).not.toContain("app/agents/orchestrator.yaml");
    expect(manifest).not.toContain("app/skills/pm");
  });

  it("keeps review convergence with the lead instead of bots, threads, or long-running Jobs", () => {
    const lead = read("engineer-lead.yaml");
    expect(lead).toContain("Automated review is evidence, not");
    expect(lead).toContain("An open thread or bot");
    expect(lead).toContain("Review is converged when");
    expect(lead).not.toContain("conductor:stop_worker");
  });

  it("keeps tool mechanics in action descriptions rather than the lead charter", () => {
    const lead = read("engineer-lead.yaml");
    const dispatch = readFileSync(path.resolve(here, "../actions/dispatch/action.yaml"), "utf8");
    const createTasks = readFileSync(path.resolve(here, "../actions/create-tasks/action.yaml"), "utf8");
    expect(lead).not.toContain("## Decisions");
    expect(lead).not.toContain("dispatch creates");
    expect(lead).not.toContain("create-tasks materializes");
    expect(lead).not.toContain("seenSeq");
    expect(lead).not.toContain("The wake prompt");
    expect(lead).not.toContain("At each wake");
    expect(lead).not.toContain("## Durable workstream memory");
    expect(dispatch).toContain("Create one Job on a Task for a logical Agent");
    expect(dispatch).not.toContain("The Agent receives");
    expect(dispatch).not.toContain("Runtime infrastructure");
    expect(createTasks).toContain("Create child Tasks from plan items");
    expect(createTasks).not.toContain("PM/coding/review stages");
  });

  it("describes every action by its effect rather than teaching the caller concepts", () => {
    const actionsDir = path.resolve(here, "../actions");
    const names: string[] = [];
    for (const action of readdirSync(actionsDir)) {
      const yaml = readFileSync(path.join(actionsDir, action, "action.yaml"), "utf8");
      const name = yaml.match(/^name: (.+)$/m)?.[1] ?? "";
      const block = yaml.match(/description: >-\n([\s\S]*?)\nentry:/)?.[1] ?? "";
      const description = block.split("\n").map((line) => line.trim()).join(" ").trim();
      names.push(name);
      expect(name.split("_").length).toBeGreaterThanOrEqual(2);
      expect(name).not.toMatch(/^(?:ask|cancel|close|complete|create|dispatch|ledger|note|orchestrate|reply|report|setup|snapshot|stop|tick|wait)$/);
      expect(description).not.toBe("");
      expect(description.length).toBeLessThan(160);
      expect(description).not.toMatch(/\b(?:use|call|prefer|read) (?:this|it|when|before)\b/i);
    }
    expect(names.sort()).toEqual([
      "add_task_note",
      "ask_person",
      "cancel_task",
      "close_task",
      "complete_task",
      "configure_conductor",
      "create_child_tasks",
      "create_job",
      "create_task",
      "frontdesk_shadow_report",
      "list_tasks",
      "read_task_history",
      "reconcile_tasks",
      "record_person_reply",
      "report_to_person",
      "run_job",
      "stop_worker",
      "wait_for_task_update",
      "wake_task_coordinator",
    ]);
  });

  it("does not give the PM the global action catalog", () => {
    const pm = read("pm.yaml");
    expect(pm).not.toMatch(/actions:\s*\n\s*-\s*["']?\*["']?/);
    expect(pm).toContain("one bounded PM Job");
    expect(pm).toContain("## Product responsibility");
    expect(pm).toContain("## Durable handoff");
    expect(pm).toContain("`product-spec-contract.md`");
    expect(pm).not.toContain("Its header records");
    expect(pm).not.toContain("scenarios and scope agree");
    expect(pm).not.toContain("find and read the `conductor:pm` skill");
  });

  it("defines the product spec once and points both producer and consumer to it", () => {
    const lead = read("engineer-lead.yaml");
    const pm = read("pm.yaml");
    expect(PRODUCT_SPEC_CONTRACT).toContain("# Product Spec Contract");
    expect(PRODUCT_SPEC_CONTRACT_FILE).toBe("product-spec-contract.md");
    expect(PRODUCT_SPEC_CONTRACT).toContain("`<slug>/spec.md`");
    expect(PRODUCT_SPEC_CONTRACT).toContain("`Status: draft | ready`");
    expect(PRODUCT_SPEC_CONTRACT).toContain("## Size semantics");
    expect(PRODUCT_SPEC_CONTRACT).not.toContain("Version:");
    expect(PRODUCT_SPEC_CONTRACT).toContain("Appetite** and **Increments** are required for a large spec");
    expect(pm).toContain("`product-spec-contract.md`");
    expect(lead).toContain("`product-spec-contract.md`");
    expect(lead).not.toContain("The person's answer does not itself make a draft ready");
  });

  it("defines the work repository structure once and points its users to it", () => {
    const lead = read("engineer-lead.yaml");
    const pm = read("pm.yaml");
    expect(WORK_REPO_CONTRACT_FILE).toBe("work-repo-contract.md");
    expect(WORK_REPO_CONTRACT).toContain("# Agent Work Repository Contract");
    expect(WORK_REPO_CONTRACT).toContain("├── spec.md");
    expect(WORK_REPO_CONTRACT).toContain("├── design.md");
    expect(pm).toContain("`work-repo-contract.md`");
    expect(lead).toContain("`work-repo-contract.md`");
    expect(lead).not.toContain("This repo is shared coordination state");
  });
});
