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

const config = {
  projects: { app: { workspace: "none" as const } },
  workerAgents: { "coding:coding": "Implementation agent" },
  orchestratorAgent: "conductor:engineer-lead",
  maxWorkers: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  maxDecisionsPerTurn: 25,
};

const prompt = (deliveredThroughSeq?: number) => buildOrchestratorPrompt({
  task: task(),
  config,
  now: at(4),
  why: "Reply#3",
  providerFor: () => ({ note: () => "", instructions: () => "", prepare: async () => ({ kind: "none" as const }), validate: async () => undefined }),
  defaultWorkspaceKind: "none",
  sharedContracts: [{ name: "contract.md", content: "Durable contract" }],
  ...(deliveredThroughSeq !== undefined ? { deliveredThroughSeq } : {}),
});

describe("orchestrator Agent Instance prompts", () => {
  it("sends the complete durable Task on the Instance's first turn", () => {
    const value = prompt();
    expect(value).toContain("## Ledger (every fact on this task, oldest first)");
    expect(value).toContain("Build the feature");
    expect(value).toContain("Initial plan");
    expect(value).toContain("Continue with the narrower scope");
    expect(value).toContain("Durable contract");
  });

  it("sends only new facts when resuming the Instance's one Session", () => {
    const value = prompt(2);
    expect(value).toContain("## New ledger facts after #2");
    expect(value).toContain("Continue with the narrower scope");
    expect(value).not.toContain("Build the feature");
    expect(value).not.toContain("Initial plan");
    expect(value).not.toContain("Durable contract");
    expect(value).not.toContain("Implementation agent");
    expect(value).toContain("same Agent Instance and Session");
  });
});

describe("worker prompt contracts", () => {
  const providerFor = () => ({
    note: () => "",
    instructions: () => "workspace",
    prepare: async () => ({ kind: "none" as const }),
    validate: async () => undefined,
  });
  const artifact = {
    repo: "owner/work",
    path: "_conductor/contracts/product-spec-format.md",
    commit: "a".repeat(40),
    sha256: "b".repeat(64),
    bytes: 123,
    url: "https://example.test/contract",
  };

  it("passes fresh workers a pinned reference rather than contract contents", () => {
    const value = buildWorkerPrompt({
      task: task(), jobId: "j-1", instructions: "do it", workspace: { kind: "none" },
      resuming: false, providerFor, defaultWorkspaceKind: "none",
      sharedContracts: [{ name: "product-spec-format.md", artifact }],
    });
    expect(value).toContain("owner/work@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:_conductor/contracts/product-spec-format.md");
    expect(value).not.toContain("Durable contract body");
  });

  it("does not repeat stable contract bodies when a worker Session resumes", () => {
    const value = buildWorkerPrompt({
      task: task(), jobId: "j-2", instructions: "continue", workspace: { kind: "none" },
      resuming: true, providerFor, defaultWorkspaceKind: "none",
      sharedContracts: [{ name: "contract.md", content: "Durable contract body" }],
    });
    expect(value).not.toContain("Shared artifact contracts");
    expect(value).not.toContain("Durable contract body");
    expect(value).not.toContain("## Original request");
  });
});
