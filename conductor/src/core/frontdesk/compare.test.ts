import { describe, expect, it } from "@rstest/core";
import type { Fact } from "../lib/facts.js";
import { actualOutcome, compareFrontdeskDecision } from "./compare.js";
import type { FrontdeskDecision } from "./types.js";

const at = new Date("2026-09-19T00:00:00Z");

function decision(intent: FrontdeskDecision["intent"], targetTask = "t-one", project = "rome"): FrontdeskDecision {
  return {
    intent,
    targetTask,
    project,
    explicitAcceptance: 0,
    explicitCancellation: 0,
    answersLatestQuestion: 0,
    needsGeneratedResponse: 0,
    confidence: { intent: 1, targetTask: 1, project: 1 },
  };
}

describe("front-desk shadow comparison", () => {
  it("finds the LLM's person fact by exact verbatim source", () => {
    const facts = [{
      seq: 11,
      id: "f-11",
      taskId: "t-one",
      kind: "Reply",
      by: "guardian",
      source: "continue",
      payload: { text: "continue" },
      createdAt: at,
    }] as Fact[];
    expect(actualOutcome(facts, 10, "continue")).toEqual({ kind: "Reply", taskId: "t-one" });
    expect(actualOutcome(facts, 11, "continue")).toEqual({});
  });

  it("requires both action kind and target task to agree", () => {
    expect(compareFrontdeskDecision(decision("reply_to_task"), { kind: "Reply", taskId: "t-one" })).toEqual({ matched: true });
    expect(compareFrontdeskDecision(decision("reply_to_task"), { kind: "Reply", taskId: "t-two" })).toMatchObject({ matched: false });
    expect(compareFrontdeskDecision(decision("ask_status"), {})).toEqual({ matched: true });
  });

  it("compares a created task's project", () => {
    expect(compareFrontdeskDecision(decision("create_task", "no_existing_task", "rome"), {
      kind: "Created",
      taskId: "t-new",
      projectId: "rome",
    })).toEqual({ matched: true });
    expect(compareFrontdeskDecision(decision("create_task", "no_existing_task", "other"), {
      kind: "Created",
      taskId: "t-new",
      projectId: "rome",
    })).toMatchObject({ matched: false });
  });
});
