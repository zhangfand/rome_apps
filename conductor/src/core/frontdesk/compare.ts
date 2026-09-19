import type { Fact } from "../lib/facts.js";
import { isPersonFact } from "../lib/fold.js";
import type {
  ActualFrontdeskOutcome,
  FrontdeskComparison,
  FrontdeskDecision,
} from "./types.js";

export function actualOutcome(
  facts: readonly Fact[],
  afterSeq: number,
  source: string,
): ActualFrontdeskOutcome {
  const fact = facts
    .filter((candidate) => candidate.seq > afterSeq && isPersonFact(candidate) && candidate.source === source)
    .at(-1);
  if (!fact) return {};
  return {
    kind: fact.kind,
    taskId: fact.taskId,
    ...(fact.kind === "Created" && fact.payload.projectId ? { projectId: fact.payload.projectId } : {}),
  };
}

function predictedKind(intent: FrontdeskDecision["intent"]): ActualFrontdeskOutcome["kind"] | undefined {
  switch (intent) {
    case "create_task": return "Created";
    case "reply_to_task": return "Reply";
    case "complete_task": return "Completed";
    case "cancel_task": return "Cancelled";
    default: return undefined;
  }
}

export function compareFrontdeskDecision(
  decision: FrontdeskDecision,
  actual: ActualFrontdeskOutcome,
): FrontdeskComparison {
  const expectedKind = predictedKind(decision.intent);
  if (expectedKind !== actual.kind) {
    return {
      matched: false,
      mismatch: `predicted ${expectedKind ?? "no ledger write"}; LLM produced ${actual.kind ?? "no ledger write"}`,
    };
  }
  if (!expectedKind) return { matched: true };
  if (expectedKind !== "Created" && decision.targetTask !== actual.taskId) {
    return {
      matched: false,
      mismatch: `predicted task ${decision.targetTask}; LLM wrote ${actual.taskId ?? "none"}`,
    };
  }
  if (expectedKind === "Created" && decision.project !== "selected_project" && decision.project !== "ambiguous" && decision.project !== actual.projectId) {
    return {
      matched: false,
      mismatch: `predicted project ${decision.project}; LLM used ${actual.projectId ?? "none"}`,
    };
  }
  return { matched: true };
}
