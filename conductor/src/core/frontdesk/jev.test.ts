import { describe, expect, it } from "@rstest/core";
import { buildJevRequest, evaluateFrontdeskWithJev, parseJevResponse } from "./jev.js";
import type { FrontdeskState } from "./types.js";

const state: FrontdeskState = {
  message: "Looks good, close it.",
  projects: ["rome"],
  tasks: [{
    id: "t-one",
    brief: "Ship the settings page",
    projectId: "rome",
    latestDecision: "Reported: PR ready; please accept or request changes",
    recent: [],
  }],
};

const response = {
  model: "jev-1.13.0",
  answers: {
    intent: { type: "choice", choice: "complete_task", confidence: 0.91, probabilities: { complete_task: 0.95, reply_to_task: 0.05 } },
    target_task: { type: "choice", choice: "t-one", confidence: 0.99, probabilities: { "t-one": 1 } },
    project: { type: "choice", choice: "rome", confidence: 0.8, probabilities: { rome: 1 } },
    explicit_acceptance: { type: "noul", noul: 0.98 },
    explicit_cancellation: { type: "noul", noul: 0.01 },
    answers_latest_question: { type: "noul", noul: 0.96 },
    needs_generated_response: { type: "noul", noul: 0.02 },
  },
  usage: { input_tokens: 1234, output_tokens: 55 },
};

describe("Jev front-desk request", () => {
  it("asks independent typed questions over the compact state", () => {
    const request = buildJevRequest(state);
    expect(request.state).toBe(state);
    expect(request.questions.intent.type).toBe("choice");
    expect(request.questions.target_task.criteria["t-one"]).toContain("Ship the settings page");
    expect(request.questions.explicit_acceptance.type).toBe("noul");
  });

  it("parses a typed decision and usage", () => {
    expect(parseJevResponse(response, state)).toEqual({
      model: "jev-1.13.0",
      decision: {
        intent: "complete_task",
        targetTask: "t-one",
        project: "rome",
        explicitAcceptance: 0.98,
        explicitCancellation: 0.01,
        answersLatestQuestion: 0.96,
        needsGeneratedResponse: 0.02,
        confidence: { intent: 0.91, targetTask: 0.99, project: 0.8 },
      },
      usage: { inputTokens: 1234, outputTokens: 55 },
    });
  });

  it("rejects values outside the offered task choices", () => {
    expect(() => parseJevResponse({
      ...response,
      answers: { ...response.answers, target_task: { ...response.answers.target_task, choice: "t-invented" } },
    }, state)).toThrow(/unknown task/);
  });

  it("calls the System One endpoint once", async () => {
    let calls = 0;
    const evaluation = await evaluateFrontdeskWithJev(state, {
      apiKey: "test-key",
      fetchImpl: async (_url, init) => {
        calls += 1;
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).authorization).toBe("Bearer test-key");
        return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    expect(calls).toBe(1);
    expect(evaluation.decision.intent).toBe("complete_task");
    expect(evaluation.usage.inputTokens).toBe(1234);
  });
});
