import type { LeadRoutingJudgments, LeadRoute } from "./types.js";

const BASE = {
  route: 0.72,
  product: 0.68,
  acceptance: 0.68,
  technical: 0.68,
  scope: 0.68,
} as const;

/** CJK is supported by Jev, but the current model card warns of lower accuracy. */
const CJK_MARGIN = 0.08;

export interface LeadRoutingPolicyResult {
  recommendation: LeadRoute;
  confidence: number;
  reasons: string[];
}

/**
 * Compose independent Jev judgments with deterministic, inspectable policy.
 * Wrongly skipping PM is costlier than an extra LLM deliberation, so direct
 * coding has the strictest gate. Jev never creates a Job by itself.
 */
export function applyLeadRoutingPolicy(
  judgments: LeadRoutingJudgments,
  options: { languageCaution?: boolean } = {},
): LeadRoutingPolicyResult {
  const margin = options.languageCaution ? CJK_MARGIN : 0;
  const threshold = (name: keyof typeof BASE) => Math.min(0.95, BASE[name] + margin);
  const j = judgments;

  const productMissing = j.productDefinition.value === "missing" && j.productDefinition.confidence >= threshold("product");
  const routedToPm = j.initialRoute.value === "pm" && j.initialRoute.confidence >= threshold("route");
  if (productMissing || routedToPm) {
    return {
      recommendation: "pm",
      confidence: Math.min(
        productMissing ? j.productDefinition.confidence : 1,
        routedToPm ? j.initialRoute.confidence : 1,
      ),
      reasons: [
        productMissing ? "material product definition is missing" : "the route classifier selected PM",
        `acceptance is ${j.acceptanceClarity.value}`,
      ],
    };
  }

  const codingReady =
    j.initialRoute.value === "coding" && j.initialRoute.confidence >= threshold("route") &&
    j.productDefinition.value !== "missing" && j.productDefinition.confidence >= threshold("product") &&
    j.acceptanceClarity.value === "clear" && j.acceptanceClarity.confidence >= threshold("acceptance") &&
    j.technicalUncertainty.value !== "high" && j.technicalUncertainty.confidence >= threshold("technical") &&
    j.scopeShape.value === "local" && j.scopeShape.confidence >= threshold("scope");
  if (codingReady) {
    return {
      recommendation: "coding",
      confidence: Math.min(
        j.initialRoute.confidence,
        j.productDefinition.confidence,
        j.acceptanceClarity.confidence,
        j.technicalUncertainty.confidence,
        j.scopeShape.confidence,
      ),
      reasons: ["product behavior and acceptance are clear", "the requested change is local and technically bounded"],
    };
  }

  const investigationReady =
    j.initialRoute.value === "investigation" && j.initialRoute.confidence >= threshold("route") &&
    j.productDefinition.value !== "missing" && j.productDefinition.confidence >= threshold("product");
  if (investigationReady) {
    return {
      recommendation: "investigation",
      confidence: Math.min(j.initialRoute.confidence, j.productDefinition.confidence),
      reasons: ["the desired outcome is sufficiently defined", "technical cause or feasibility should be established before implementation"],
    };
  }

  const signals = [
    `route=${j.initialRoute.value} (${j.initialRoute.confidence.toFixed(2)})`,
    `product=${j.productDefinition.value} (${j.productDefinition.confidence.toFixed(2)})`,
    `acceptance=${j.acceptanceClarity.value} (${j.acceptanceClarity.confidence.toFixed(2)})`,
    `technical=${j.technicalUncertainty.value} (${j.technicalUncertainty.confidence.toFixed(2)})`,
    `scope=${j.scopeShape.value} (${j.scopeShape.confidence.toFixed(2)})`,
  ];
  return {
    recommendation: "lead_deliberation",
    confidence: Math.min(...Object.values(j).map((answer) => answer.confidence)),
    reasons: ["the atomic judgments are uncertain, cross-cutting, or do not jointly satisfy an automatic route", ...signals],
  };
}

