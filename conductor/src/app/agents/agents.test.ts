import { describe, expect, it } from "@rstest/core";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkerReply } from "../../core/lib/worker-reply.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(path.join(here, name), "utf8");
const domainDoc = (name: string) => readFileSync(path.resolve(here, "../../domain", name), "utf8");
const PRODUCT_SPEC_FORMAT = domainDoc("product-spec-format.md");
const TECHNICAL_SPEC_FORMAT = domainDoc("technical-spec-format.md");
const WORK_REPO_CONTRACT = domainDoc("work-repo-contract.md");
const INSTALLED_DOCS = "~/.rome/*/apps/installed/conductor/active/src/domain/";
const flat = (text: string) => text.replace(/\s+/g, " ");

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
    // The coder that wrote the PR answers its review, so its session can be resumed.
    expect(prose).toContain("create a bounded `conductor:coder` Job to respond to the findings on that head");
    expect(prose).not.toContain("`conductor:assistant` Job to respond");
    expect(prose).not.toContain("loads and follows the repository's `respond-to-review` skill");
    expect(prose).toContain("bot review of that exact head arrives as a new fact");
    // How to respond is the coder's own protocol, not the lead's instruction.
    const coder = read("coder.yaml").replace(/\s+/g, " ");
    expect(coder).toContain("load and follow the repository's `respond-to-review` skill");
    expect(coder).toContain("make only earned in-scope fixes, and record a reasoned disposition for the rest");
    expect(read("assistant.yaml")).not.toContain("respond-to-review");
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

  it("lets the coder decide whether a request needs product definition or a prototype", () => {
    const lead = read("engineer-lead.yaml");
    const prose = lead.replace(/\s+/g, " ");
    // No size gate and no lead-authored brief or technical spec.
    expect(prose).not.toContain("Size: medium or Size: large");
    expect(prose).not.toContain("prototype-brief.md");
    expect(prose).not.toContain("technical-spec.md");
    expect(prose).toContain("Hand every request that changes code to `conductor:coder` first");
    expect(prose).toContain("Do not route a request to PM or to a prototype on your own judgment");
    // Routing is a responsibility, not a case table.
    expect(prose).toContain("A coder's `needs` detail names who must act before it can continue");
    expect(prose).toContain("Bring that party in with the coder's report cited so no one repeats its research");
    expect(prose).not.toContain("`needs: pm` —");
    // The lead says what to route; the coder's own prompt says how to prototype.
    expect(prose).not.toContain("feasibility-prototype");
    const coder = read("coder.yaml").replace(/\s+/g, " ");
    expect(coder).toContain("Decide what the request needs after reading the relevant code and before writing any");
    expect(coder).toContain("Build it directly, without a product spec: load and follow `conductor:feasibility-prototype`");
    expect(coder).toContain("list every product decision you made in the pull request description");
    expect(coder).toContain("Evolve the approved prototype where its code fits rather than rewriting it");
    expect(coder).toContain("needs: pm | prototype-review | person");
    // A running Rome for a prototype comes from the dev loop on devbox, never the production host.
    expect(coder).toContain("This host runs the person's production Rome");
    expect(coder).toContain("`pnpm dev:all`) on the `devbox` remote computer through `rome-node device run`");
    const integration = readFileSync(path.resolve(here, "../skills/feasibility-prototype/INTEGRATION.md"), "utf8");
    expect(integration).toContain("never borrow its cloud identity, tokens, or relay");
    expect(read("pm.yaml").replace(/\s+/g, " ")).toContain("When a Job cites a coder's report, read it at the cited commit");
    expect(prose).toContain("until their reply before starting production implementation");
    expect(prose).toContain("do not create polling or periodic check-in Jobs");
    expect(prose).toContain("A prototype is not a production delivery");
    expect(prose).toContain("Do not gate its handoff on CI or online review");
    expect(prose).toContain("do not process review-bot findings on it");
    expect(prose).toContain("Only act on the prototype again when the person asks");
    expect(lead).not.toContain("## Prototype Contract");
  });

  it("ships the feasibility-prototype skill with logic, ui, and integration branches", () => {
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    const dir = path.resolve(here, "../skills/feasibility-prototype");
    const skill = readFileSync(path.join(dir, "SKILL.md"), "utf8").replace(/\s+/g, " ");
    expect(manifest).toContain("app/skills/feasibility-prototype");
    expect(skill).toContain("name: feasibility-prototype");
    expect(skill).toContain("A product spec is not required");
    expect(skill).toContain("a production Job evolves it into the production change");
    expect(skill).not.toContain("Never merge the branch");
    const brief = domainDoc("prototype-brief-format.md");
    expect(brief).toContain("# Prototype brief format");
    expect(brief).toContain("Question:");
    expect(brief).toContain("Pass:");
    expect(brief).not.toContain("Branch:");
    expect(skill).toContain("Never fake the answer");
    expect(skill).toContain("| Question | Answer | Evidence |");
    for (const branch of ["LOGIC.md", "UI.md", "INTEGRATION.md"]) {
      expect(skill).toContain(`(${branch})`);
      expect(readFileSync(path.join(dir, branch), "utf8").length).toBeGreaterThan(0);
    }
  });

  it("lets the coder split work that exceeds one pull request", () => {
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    const lead = read("engineer-lead.yaml").replace(/\s+/g, " ");
    const skill = readFileSync(
      path.resolve(here, "../skills/split-into-prs/SKILL.md"),
      "utf8",
    ).replace(/\s+/g, " ");
    const coder = read("coder.yaml").replace(/\s+/g, " ");
    expect(manifest).toContain("app/skills/split-into-prs");
    expect(manifest).not.toContain("split-approved-prototype");
    expect(lead).not.toContain("split-approved-prototype");
    expect(coder).toContain("load and follow `conductor:split-into-prs`, open only the pull requests that can open now");
    expect(lead).toContain("create the next `conductor:coder` Job when what it waits on has merged");
    expect(skill).toContain("List every PR that cannot open yet under `next`");
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
    expect(skill).toContain("give the Conventional Commit title, the kind");
    expect(skill).toContain("every scenario of the request is already proven on main");
  });

  it("keeps delivery policy in Agent system prompts rather than a runtime SOP", () => {
    const lead = read("engineer-lead.yaml").replace(/\s+/g, " ");
    expect(lead).toContain("A production implementation must match the person's request");
    expect(lead).toContain("repository CI green on the exact final bot-reviewed head");
    expect(lead).toContain("Stop creating Jobs and let the Task rest until the person merges or responds");
    expect(lead).toContain("The Task is complete only when the delivered result is accepted");
  });

  it("rests silently on external work and reports only what the person must act on", () => {
    const lead = read("engineer-lead.yaml").replace(/\s+/g, " ");
    expect(lead).toContain("Waiting is not news for the person");
    expect(lead).toContain("record `conductor:acknowledge_task_update`: it marks the newest facts handled, tells no one");
    expect(lead).toContain("it never stands for waiting on the person");
    expect(lead).toContain("Report to the person only when they have something to act on");
    expect(lead).toContain("Progress, a pushed head, or pending CI or review is never a reason to report");
    expect(lead).not.toContain("Never use ACK to stand for waiting on");
    const report = readFileSync(path.resolve(here, "../actions/report/action.yaml"), "utf8").replace(/\s+/g, " ");
    expect(report).toContain("Not for progress updates");
    expect(report).not.toContain("or external event");
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
      "acknowledge_task_update",
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
    expect(manifest).not.toContain("app/actions/note");
    expect(manifest).toContain("app/actions/ack");
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
    expect(pm).toContain("You are the product manager for one product change");
    expect(pm).toContain("Decide by default and ask by exception");
    expect(pm).toContain("`product-spec-format.md`");
    expect(pm).not.toContain("Its header records");
    expect(pm).not.toContain("scenarios and scope agree");
    expect(pm).not.toContain("find and read the `conductor:pm` skill");
  });

  it("uses the shared product and technical spec formats", () => {
    const lead = read("engineer-lead.yaml");
    const pm = read("pm.yaml");
    expect(PRODUCT_SPEC_FORMAT).toContain("# Product spec format");
    expect(PRODUCT_SPEC_FORMAT).toContain("`<slug>/product-spec.md`");
    expect(PRODUCT_SPEC_FORMAT).toContain("`Status: draft | ready | dropped`");
    expect(PRODUCT_SPEC_FORMAT).toContain("## Sizes");
    expect(TECHNICAL_SPEC_FORMAT).toContain("# Technical spec format");
    expect(TECHNICAL_SPEC_FORMAT).toContain("`<slug>/technical-spec.md`");
    expect(TECHNICAL_SPEC_FORMAT).toContain("### Prototypes");
    expect(TECHNICAL_SPEC_FORMAT).toContain("## Done");
    expect(pm).toContain("`product-spec-format.md`");
    // Only writers name a format; the lead writes no work-repo artifacts.
    expect(lead).not.toContain("`product-spec-format.md`");
    expect(lead).not.toContain("`technical-spec-format.md`");
    expect(lead).not.toContain("The person's answer does not itself make a draft ready");
  });

  it("defines the work repository structure once and points its users to it", () => {
    const lead = read("engineer-lead.yaml");
    const pm = read("pm.yaml");
    expect(WORK_REPO_CONTRACT).toContain("# Agent Work Repository Contract");
    expect(WORK_REPO_CONTRACT).toContain("├── product-spec.md");
    expect(WORK_REPO_CONTRACT).toContain("├── technical-spec.md");
    expect(WORK_REPO_CONTRACT).toContain("├── prototype-brief.md");
    expect(WORK_REPO_CONTRACT.replace(/\s+/g, " ")).toContain("`prototype-brief.md` follows `prototype-brief-format.md`");
    expect(WORK_REPO_CONTRACT).toContain("_conductor/tasks/<task-id>/snapshot.md");
    expect(WORK_REPO_CONTRACT).not.toContain("_conductor/contracts");
    expect(pm).toContain("`work-repo-contract.md`");
    expect(lead).not.toContain("This repo is shared coordination state");
  });

  it("has writers read format docs from the installed app when they write, not from wakes", () => {
    const lead = flat(read("engineer-lead.yaml"));
    const pm = flat(read("pm.yaml"));
    expect(pm).toContain(`Before writing or revising a product spec, read \`product-spec-format.md\` and \`work-repo-contract.md\` from the installed Conductor app at \`${INSTALLED_DOCS}\``);
    expect(lead).not.toContain("Before writing to the work repo");
    for (const prompt of [lead, pm]) {
      expect(prompt).not.toContain("pinned");
      expect(prompt).not.toContain("supplied");
    }
  });
});

describe("Conductor worker Agents", () => {
  const workers = ["coder.yaml", "assistant.yaml", "pm.yaml"];
  it("registers Conductor's own worker Agents", () => {
    const manifest = readFileSync(path.resolve(here, "../../../app.yaml"), "utf8");
    for (const name of workers) expect(manifest).toContain(`app/agents/${name}`);
  });

  it("tells each worker only its responsibility, how it works, and its output", () => {
    for (const name of workers) {
      const text = read(name);
      const sections = [...text.matchAll(/^  ## (.+)$/gm)].map((match) => match[1]);
      // The Job prompt itself shows the input: instructions, cited artifacts, and workspace.
      expect(sections).toEqual(["Responsibility", "How you work", "Output"]);
      const prose = flat(text);
      // Orchestration background and repository-specific rules are not worker knowledge.
      expect(prose).not.toContain("Conductor worker protocol");
      expect(prose).not.toContain("engineering lead");
      expect(prose).not.toContain("git lfs");
      expect(prose).not.toContain("reinstall");
    }
  });

  it("describes an output block the runtime parses", () => {
    for (const name of workers) {
      const text = read(name);
      expect(text).toContain("```conductor");
      for (const status of ["succeeded", "failed", "blocked", "waiting"]) expect(text).toContain(`\`${status}\``);
    }
    const reply = parseWorkerReply("Did it.\n\n```conductor\nstatus: blocked\nsummary: Which default? A or B.\n```");
    expect(reply.status).toBe("blocked");
    expect(reply.summary).toBe("Which default? A or B.");
    const coderReply = parseWorkerReply("Read the code.\n\n```conductor\nstatus: blocked\nsummary: Two readings.\ndetail:\n  needs: pm\n```");
    expect(coderReply.detail).toEqual({ needs: "pm" });
    expect(coderReply.report).toBe("Read the code.");
  });

  it("lets the lead hand work over by reference to Conductor's workers", () => {
    const lead = flat(read("engineer-lead.yaml"));
    expect(lead).toContain("End every wake with exactly one decision action.");
    for (const agent of ["conductor:pm", "conductor:coder", "conductor:assistant"]) expect(lead).toContain(`\`${agent}\``);
    expect(lead).toContain("do not tell it where to work or how to reply");
    expect(lead).not.toContain("write it to the work repo first");
    // Handoffs carry references, not content.
    expect(lead).toContain("Hand work over by reference, never by restating it");
    expect(lead).toContain("Read that report only when the summary and detail do not settle your decision");
    expect(lead).toContain("give a one-line summary and cite its path and commit");
    const coder = flat(read("coder.yaml"));
    expect(coder).toContain("Read what a Job cites (a product spec, a report, a brief) at the cited commit");
    expect(coder).toContain("pr: <URL of the pull request this Job opened or updated>");
    const agentsDoc = flat(readFileSync(path.resolve(here, "../../../AGENTS.md"), "utf8"));
    expect(agentsDoc).toContain("Handoffs carry references, not content");
    const replay = flat(read("engineer-lead-replay-v1.yaml"));
    expect(replay).toContain("The source ledger was deliberately not copied");
    expect(replay).not.toContain("assistant:assistant");
    expect(replay).not.toContain("`contracts` input");
  });
});
