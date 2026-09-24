import { describe, expect, it } from "@rstest/core";
import { foldTask } from "./fold.js";
import type { Fact } from "./facts.js";
import { buildOrchestratorPrompt, buildWorkerPrompt } from "./prompts.js";

const at = (minute: number) => new Date(`2026-09-22T00:${String(minute).padStart(2, "0")}:00.000Z`);

function task() {
  const facts: Fact[] = [
    { seq: 1, id: "f-1", taskId: "t-1", kind: "Created", by: "guardian", source: "build", payload: { brief: "Build the feature", projectId: "app" }, createdAt: at(1) },
    { seq: 2, id: "f-2", taskId: "t-1", kind: "Noted", by: "orchestrator", source: "note", payload: { note: "Initial plan" }, createdAt: at(2) },
    { seq: 3, id: "f-3", taskId: "t-1", kind: "Reply", by: "guardian", source: "continue", payload: { text: "Continue with the narrower scope" }, createdAt: at(3) },
  ];
  return foldTask(facts);
}

const prompt = (deliveredThroughSeq?: number) => buildOrchestratorPrompt({
  task: task(),
  now: at(4),
  why: "Reply#3",
  ...(deliveredThroughSeq !== undefined ? { deliveredThroughSeq } : {}),
});

describe("orchestrator Agent Instance prompts", () => {
  it("sends the complete durable Task on the Instance's first turn", () => {
    const value = prompt();
    expect(value).toContain("## Ledger (every fact on this task, oldest first)");
    expect(value).toContain("Build the feature");
    expect(value).toContain("Initial plan");
    expect(value).toContain("Continue with the narrower scope");
    expect(value).toContain("Requested by: guardian");
  });

  it("sends only new facts when resuming the Instance's one Session", () => {
    const value = prompt(2);
    expect(value).toContain("## New ledger facts after #2");
    expect(value).toContain("Continue with the narrower scope");
    expect(value).not.toContain("Build the feature");
    expect(value).not.toContain("Initial plan");
    expect(value).not.toContain("Requested by");
    expect(value).toContain("same Agent Instance and Session");
  });

  it("carries only wake-specific state, never consensus policy", () => {
    for (const value of [prompt(), prompt(2)]) {
      expect(value).toContain("Why you were woken: Reply#3");
      expect(value).toContain("seenSeq: 3");
      expect(value).not.toContain("## Agents you may create a Job for");
      expect(value).not.toContain("Shared artifact contracts");
      expect(value).not.toContain("Decide the next step");
      expect(value).not.toContain("pass this on every decision action");
    }
  });
});

describe("worker Job prompts", () => {
  const providerFor = () => ({
    instructions: () => "## Workspace\nWorking directory: /tree",
    prepare: async () => ({ kind: "none" as const }),
    validate: async () => undefined,
  });

  it("carries the Job's identity, instructions, and workspace only", () => {
    const value = buildWorkerPrompt({
      task: task(), jobId: "j-1", instructions: "Read rome-work@abc:slug/prototype-brief.md and follow it.",
      workspace: { kind: "none" }, resuming: false, providerFor, defaultWorkspaceKind: "none",
    });
    expect(value).toContain("Job j-1 on task t-1");
    expect(value).toContain("## Instructions");
    expect(value).toContain("rome-work@abc:slug/prototype-brief.md");
    expect(value).toContain("Working directory: /tree");
    // Consensus lives in the worker Agent's system prompt.
    expect(value).not.toContain("Build the feature");
    expect(value).not.toContain("## Original request");
    expect(value).not.toContain("## How to reply");
    expect(value).not.toContain("```conductor");
    expect(value).not.toContain("A lead coordinates");
  });

  it("says only that the Job continues when a worker Session resumes", () => {
    const value = buildWorkerPrompt({
      task: task(), jobId: "j-2", instructions: "continue", workspace: { kind: "none" },
      resuming: true, providerFor, defaultWorkspaceKind: "none",
    });
    expect(value).toContain("Continuing job j-2 on task t-1");
    expect(value).toContain("continue");
    expect(value).not.toContain("## How to reply");
  });
});
