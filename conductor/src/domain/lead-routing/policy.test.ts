import { describe, expect, it } from "@rstest/core";
import { applyLeadRoutingPolicy } from "./policy.js";
import type { LeadRoutingJudgments } from "./types.js";

function judgment<T extends string>(value: T, confidence = 0.9) {
  return { value, confidence, probabilities: { [value]: 0.9 } };
}

function baseline(): LeadRoutingJudgments {
  return {
    initialRoute: judgment("coding"),
    productDefinition: judgment("ready"),
    acceptanceClarity: judgment("clear"),
    technicalUncertainty: judgment("low"),
    scopeShape: judgment("local"),
  };
}

describe("engineering-lead route policy", () => {
  it("routes missing product definition to PM", () => {
    const input = baseline();
    input.initialRoute = judgment("lead_deliberation", 0.65);
    input.productDefinition = judgment("missing", 0.84);
    expect(applyLeadRoutingPolicy(input).recommendation).toBe("pm");
  });

  it("does not direct-code when acceptance is only partial", () => {
    const input = baseline();
    input.acceptanceClarity = judgment("partial", 0.95);
    expect(applyLeadRoutingPolicy(input).recommendation).toBe("lead_deliberation");
  });

  it("uses investigation when the outcome is ready but discovery comes first", () => {
    const input = baseline();
    input.initialRoute = judgment("investigation", 0.88);
    input.technicalUncertainty = judgment("high", 0.91);
    expect(applyLeadRoutingPolicy(input).recommendation).toBe("investigation");
  });

  it("falls back to lead deliberation on low confidence", () => {
    const input = baseline();
    input.initialRoute = judgment("coding", 0.55);
    expect(applyLeadRoutingPolicy(input).recommendation).toBe("lead_deliberation");
  });
});

