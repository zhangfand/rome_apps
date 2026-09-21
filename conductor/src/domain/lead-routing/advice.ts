import { createAppLogger } from "@rome-os/app-runtime";
import type { TaskView } from "../../core/lib/fold.js";
import { buildLeadRoutingState, evaluateLeadRoutingWithJev, shouldEvaluateLeadRouting } from "./index.js";
import type { LeadRoutingAssessment, LeadRoutingConfig } from "./types.js";

const log = createAppLogger("conductor:lead-routing");

/**
 * Produce advisory text for the lead's first wake. Failure is deliberately
 * silent to workflow: the lead LLM can always make the decision itself.
 */
export async function initialLeadRoutingAdvice(
  task: TaskView,
  config: LeadRoutingConfig | undefined,
  defaultWorkspaceKind: string,
): Promise<string | undefined> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!config?.enabled || !apiKey || !shouldEvaluateLeadRouting(task)) return undefined;
  try {
    const assessment = await evaluateLeadRoutingWithJev(buildLeadRoutingState(task, defaultWorkspaceKind), {
      apiKey,
      model: config.model,
    });
    log.info("initial lead route evaluated", {
      taskId: task.id,
      recommendation: assessment.recommendation,
      confidence: assessment.confidence,
      model: assessment.model,
      latencyMs: assessment.latencyMs,
    });
    return formatLeadRoutingAdvice(assessment);
  } catch (error) {
    log.warn("initial lead route unavailable; continuing with lead LLM", {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export function formatLeadRoutingAdvice(assessment: LeadRoutingAssessment): string {
  const j = assessment.judgments;
  return [
    `Recommendation: ${assessment.recommendation} (policy confidence ${assessment.confidence.toFixed(2)})`,
    `- initial route: ${j.initialRoute.value} (confidence ${j.initialRoute.confidence.toFixed(2)})`,
    `- product definition: ${j.productDefinition.value} (confidence ${j.productDefinition.confidence.toFixed(2)})`,
    `- acceptance clarity: ${j.acceptanceClarity.value} (confidence ${j.acceptanceClarity.confidence.toFixed(2)})`,
    `- technical uncertainty: ${j.technicalUncertainty.value} (confidence ${j.technicalUncertainty.confidence.toFixed(2)})`,
    `- scope shape: ${j.scopeShape.value} (confidence ${j.scopeShape.confidence.toFixed(2)})`,
    `Policy reasons: ${assessment.reasons.join("; ")}`,
    ...(assessment.languageCaution ? ["Caution: the request contains CJK text; the current Jev model documents lower accuracy for CJK, so the policy used stricter gates."] : []),
    "This is a typed, confidence-gated first-handoff recommendation, not a product spec or engineering plan. Resolve contradictions with the request and repository context. You still own the decision and must generate the actual bounded Job instructions.",
  ].join("\n");
}
