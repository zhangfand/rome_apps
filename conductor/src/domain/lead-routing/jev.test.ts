import { describe, expect, it } from "@rstest/core";
import { buildLeadRoutingRequest, parseLeadRoutingResponse } from "./jev.js";
import type { LeadRoutingState } from "./types.js";

const state: LeadRoutingState = {
  request: "Fix the typo in the empty-state label and add a regression test.",
  personUpdates: [],
  project: { id: "conductor", workspace: "git-worktree", source: "person" },
};

function answer(value: string, confidence = 0.9) {
  return { type: "choice", choice: value, confidence, probabilities: { [value]: 0.9 } };
}

describe("Jev engineering-lead routing", () => {
  it("asks atomic questions in one request", () => {
    const request = buildLeadRoutingRequest(state);
    expect(request.model).toBe("jev-latest");
    expect(Object.keys(request.questions)).toEqual([
      "initial_route",
      "product_definition",
      "acceptance_clarity",
      "technical_uncertainty",
      "scope_shape",
    ]);
    expect(request.questions.initial_route.criteria).toHaveProperty("pm");
    expect(request.questions.initial_route.criteria).toHaveProperty("coding");
    expect(request.questions.initial_route.criteria).toHaveProperty("investigation");
    expect(request.questions.product_definition.instructions).not.toContain("and acceptance");
  });

  it("parses typed answers and composes a conservative coding recommendation", () => {
    const result = parseLeadRoutingResponse({
      model: "jev-1.13.0",
      answers: {
        initial_route: answer("coding", 0.94),
        product_definition: answer("ready", 0.91),
        acceptance_clarity: answer("clear", 0.89),
        technical_uncertainty: answer("low", 0.88),
        scope_shape: answer("local", 0.92),
      },
      usage: { input_tokens: 210, output_tokens: 35 },
    }, state, 24);

    expect(result).toMatchObject({
      recommendation: "coding",
      confidence: 0.88,
      model: "jev-1.13.0",
      latencyMs: 24,
      usage: { inputTokens: 210, outputTokens: 35 },
      languageCaution: false,
    });
  });

  it("rejects out-of-vocabulary answers instead of guessing", () => {
    expect(() => parseLeadRoutingResponse({ answers: {
      initial_route: answer("ship_it"),
      product_definition: answer("ready"),
      acceptance_clarity: answer("clear"),
      technical_uncertainty: answer("low"),
      scope_shape: answer("local"),
    } }, state)).toThrow("initial_route");
  });

  it("marks CJK input so policy can use stricter thresholds", () => {
    const result = parseLeadRoutingResponse({ answers: {
      initial_route: answer("coding", 0.76),
      product_definition: answer("ready", 0.76),
      acceptance_clarity: answer("clear", 0.76),
      technical_uncertainty: answer("low", 0.76),
      scope_shape: answer("local", 0.76),
    } }, { ...state, request: "修复空状态文案" });
    expect(result.languageCaution).toBe(true);
    expect(result.recommendation).toBe("lead_deliberation");
  });
});

