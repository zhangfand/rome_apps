import { describe, expect, it } from "@rstest/core";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_SPEC_FORMAT, PRODUCT_SPEC_FORMAT_FILE } from "../../domain/product-spec-format.js";
import { TECHNICAL_SPEC_FORMAT, TECHNICAL_SPEC_FORMAT_FILE } from "../../domain/technical-spec-format.js";
import { WORK_REPO_CONTRACT, WORK_REPO_CONTRACT_FILE } from "../../domain/work-repo-contract.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(path.join(here, name), "utf8");

describe("Conductor agent boundaries", () => {
  it("registers one task coordinator rather than the obsolete generic orchestrator", () => {
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    expect(manifest).toContain("app/agents/engineer-lead.yaml");
    expect(manifest).toContain("app/agents/ledger-compactor.yaml");
    expect(manifest).not.toContain("app/agents/orchestrator.yaml");
    expect(manifest).not.toContain("app/skills/pm");
  });

  it("runs the engineering lead on the large model tier", () => {
    expect(read("engineer-lead.yaml")).toContain("tier: large");
  });

  it("relies on online reviewers and handles their feedback through respond-to-review", () => {
    const lead = read("engineer-lead.yaml");
    const prose = lead.replace(/\s+/g, " ");
    expect(prose).toContain("Rely on the repository's online review bots");
    expect(prose).toContain("never create an independent code-review Job");
    expect(prose).toContain("`code-review` skill or action");
    expect(prose).toContain("`respond-to-review` skill");
    expect(prose).toContain("bot review of that exact head arrives as a new fact");
    expect(lead).not.toContain("Independently verify claims");
    expect(lead).not.toContain("`.claude/skills/babysit-pr`");
    expect(lead).not.toContain("Someone other than the author checks");
    expect(lead).not.toContain("independent review has converged");
    expect(lead).not.toContain("conductor:stop_worker");
  });

  it("caps review-driven code changes at three rounds per PR", () => {
    const lead = read("engineer-lead.yaml").replace(/\s+/g, " ");
    expect(lead).toContain("Limit review-driven code changes on one PR to three rounds");
    expect(lead).toContain("only when a review-response Job pushes a new head");
    expect(lead).toContain("a no-change disposition does not consume one");
    expect(lead).toContain("do not create a fourth remediation Job");
    expect(lead).toContain("report the unresolved findings, their risk, and the three prior fix rounds");
    expect(lead).toContain("person explicitly authorizes a bounded exception");
  });

  it("prototypes medium and large work before production implementation", () => {
    const lead = read("engineer-lead.yaml");
    const prose = lead.replace(/\s+/g, " ");
    expect(prose).toContain("Size: medium or Size: large");
    expect(prose).toContain("begin with a bounded prototype before production implementation");
    expect(prose).toContain("prove that the proposed approach is feasible");
    expect(prose).toContain("better estimate of implementation");
    expect(prose).toContain("result they can easily run or inspect");
    expect(prose).toContain("until their reply before starting production implementation");
    expect(prose).toContain("do not create polling or periodic check-in Jobs");
    expect(prose).toContain("where the prototype code or result is");
    expect(prose).toContain("known problems or limitations");
    expect(prose).toContain("what architecture");
    expect(prose).toContain("A prototype is not a production delivery");
    expect(prose).toContain("Do not gate its handoff on CI or online review");
    expect(prose).toContain("do not process review-bot findings on it");
    expect(prose).toContain("Only act on the prototype again when the person asks");
    expect(lead).not.toContain("## Prototype Contract");
  });

  it("loads the approved-prototype PR splitting skill before production work", () => {
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    const lead = read("engineer-lead.yaml").replace(/\s+/g, " ");
    const skill = readFileSync(
      path.resolve(here, "../skills/split-approved-prototype/SKILL.md"),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(manifest).toContain("app/skills/split-approved-prototype");
    expect(lead).toContain("After approval, turn the approved prototype into the canonical `<slug>/technical-spec.md`");
    expect(lead).toContain("Then load and follow the `split-approved-prototype` skill");
    expect(lead).toContain("Record only the PRs that can open now in the technical spec's Tasks section");
    expect(lead).toContain("do not plan downstream PRs");
    expect(lead).toContain("Re-run the split after merged work or new evidence");
    expect(skill).toContain("Main stays releasable after each PR");
    expect(skill).toContain("Every PR is one of two kinds");
    expect(skill).toContain("pull requests that can open today");
    expect(skill).toContain("needs nothing unmerged");
    expect(skill).toContain("touches no file another PR in this round touches");
    expect(skill).toContain("behavior PR would exceed 400 lines of non-test diff");
    expect(skill).toContain("Every PR, behavior or preparatory, carries at most 400 lines");
    expect(skill).toContain("Generated files and lockfiles do not count");
    expect(skill).toContain("smallest coherent part that unlocks the next decision");
    expect(skill).toContain("abstractions needed only by later, unplanned behavior out of this round");
    expect(skill).toContain("For each PR give the Conventional Commit title, the kind");
    expect(skill).toContain("every scenario in the spec is already proven on main");
  });

  it("keeps delivery policy in Agent system prompts rather than a runtime SOP", () => {
    const lead = read("engineer-lead.yaml").replace(/\s+/g, " ");
    expect(lead).toContain("A production implementation must match the person's request");
    expect(lead).toContain("repository CI to be green on the exact final bot-reviewed head");
    expect(lead).toContain("Stop creating Jobs and let the Task rest until the person merges or responds");
    expect(lead).toContain("The Task is complete only when the delivered result is accepted");
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
      "compact_task_history",
      "complete_task",
      "configure_conductor",
      "create_child_tasks",
      "create_job",
      "create_task",
      "fork_task",
      "frontdesk_shadow_report",
      "list_tasks",
      "read_task_history",
      "reconcile_tasks",
      "record_person_reply",
      "report_to_person",
      "run_job",
      "stop_worker",
      "wake_task_coordinator",
    ]);
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    expect(manifest).not.toContain("app/actions/wait");
    expect(read("engineer-lead.yaml")).not.toContain("conductor:wait_for_task_update");
  });

  it("pins replay experiments to a decomposition-first lead prompt", () => {
    const replay = read("engineer-lead-replay-v1.yaml").replace(/\s+/g, " ");
    expect(replay).toContain("do not create a production coding Job on the parent delivery Task");
    expect(replay).toContain("Materialize production work with conductor:create_child_tasks");
    expect(replay).toContain("Do not pack a roadmap into one worker instruction");
    expect(replay).toContain("Do not edit the workstream's canonical technical-spec.md");
  });

  it("does not give the PM the global action catalog", () => {
    const pm = read("pm.yaml");
    expect(pm).toContain("tier: large");
    expect(pm).not.toMatch(/actions:\s*\n\s*-\s*["']?\*["']?/);
    expect(pm).toContain("one bounded PM Job");
    expect(pm).toContain("## Product responsibility");
    expect(pm).toContain("## Durable handoff");
    expect(pm).toContain("`product-spec-format.md`");
    expect(pm).not.toContain("Its header records");
    expect(pm).not.toContain("scenarios and scope agree");
    expect(pm).not.toContain("find and read the `conductor:pm` skill");
  });

  it("uses the shared product and technical spec formats", () => {
    const lead = read("engineer-lead.yaml");
    const pm = read("pm.yaml");
    expect(PRODUCT_SPEC_FORMAT).toContain("# Product spec format");
    expect(PRODUCT_SPEC_FORMAT_FILE).toBe("product-spec-format.md");
    expect(PRODUCT_SPEC_FORMAT).toContain("`<slug>/product-spec.md`");
    expect(PRODUCT_SPEC_FORMAT).toContain("`Status: draft | ready | dropped`");
    expect(PRODUCT_SPEC_FORMAT).toContain("## Sizes");
    expect(TECHNICAL_SPEC_FORMAT).toContain("# Technical spec format");
    expect(TECHNICAL_SPEC_FORMAT_FILE).toBe("technical-spec-format.md");
    expect(TECHNICAL_SPEC_FORMAT).toContain("`<slug>/technical-spec.md`");
    expect(TECHNICAL_SPEC_FORMAT).toContain("### Prototypes");
    expect(TECHNICAL_SPEC_FORMAT).toContain("## Done");
    expect(pm).toContain("`product-spec-format.md`");
    expect(lead).toContain("`product-spec-format.md`");
    expect(lead).toContain("`technical-spec-format.md`");
    expect(lead).not.toContain("The person's answer does not itself make a draft ready");
  });

  it("defines the work repository structure once and points its users to it", () => {
    const lead = read("engineer-lead.yaml");
    const pm = read("pm.yaml");
    expect(WORK_REPO_CONTRACT_FILE).toBe("work-repo-contract.md");
    expect(WORK_REPO_CONTRACT).toContain("# Agent Work Repository Contract");
    expect(WORK_REPO_CONTRACT).toContain("├── product-spec.md");
    expect(WORK_REPO_CONTRACT).toContain("├── technical-spec.md");
    expect(WORK_REPO_CONTRACT).toContain("_conductor/tasks/<task-id>/snapshot.md");
    expect(pm).toContain("`work-repo-contract.md`");
    expect(lead).toContain("`work-repo-contract.md`");
    expect(lead).not.toContain("This repo is shared coordination state");
  });
});
