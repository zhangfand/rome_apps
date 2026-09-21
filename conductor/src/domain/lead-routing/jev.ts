import { DEFAULT_JEV_MODEL, TYPESAFE_ENDPOINT, type JevClientOptions } from "../../core/frontdesk/jev.js";
import { applyLeadRoutingPolicy } from "./policy.js";
import { hasCjkText } from "./state.js";
import {
  ACCEPTANCE_CLARITY_STATES,
  LEAD_ROUTES,
  PRODUCT_DEFINITION_STATES,
  SCOPE_SHAPES,
  TECHNICAL_UNCERTAINTY_STATES,
  type ChoiceJudgment,
  type LeadRoutingAssessment,
  type LeadRoutingJudgments,
  type LeadRoutingState,
} from "./types.js";

interface SystemOneResponse {
  model?: unknown;
  answers?: unknown;
  usage?: unknown;
}

export function buildLeadRoutingRequest(state: LeadRoutingState, model = DEFAULT_JEV_MODEL) {
  return {
    model,
    state,
    questions: {
      initial_route: {
        type: "choice",
        instructions: "Which first handler is appropriate for this software request? Judge only the first handoff, not the whole delivery plan.",
        criteria: {
          pm: "Product behavior, user experience, scope boundaries, or acceptance need definition before engineering can safely begin.",
          coding: "A coding agent can implement the bounded request without inventing product policy; expected behavior and observable acceptance are already clear.",
          investigation: "The desired outcome is clear, but a technical cause, repository fact, or feasibility question must be established before final implementation.",
          lead_deliberation: "The request combines outcomes, needs architecture or dependency planning, contains conflicting signals, or does not safely fit another option.",
        },
      },
      product_definition: {
        type: "choice",
        instructions: "Is the product definition sufficient before engineering starts?",
        criteria: {
          ready: "User-visible behavior, scope boundary, and important defaults are explicit or safely implied by a clear precedent in the request.",
          missing: "Engineering would have to invent material user-visible behavior, policy, scope, or priority.",
          not_applicable: "This is purely technical maintenance, diagnosis, refactoring, or operations with no material product behavior decision.",
        },
      },
      acceptance_clarity: {
        type: "choice",
        instructions: "How clear is the observable condition for accepting this request?",
        criteria: {
          clear: "A worker can state concrete evidence that would prove the requested outcome is satisfied.",
          partial: "The main outcome is known, but one or more important acceptance details require repository inspection or lead judgment.",
          unsettled: "Success depends on a product choice or subjective target that has not been decided.",
        },
      },
      technical_uncertainty: {
        type: "choice",
        instructions: "How much technical discovery is required before a final implementation job can be bounded?",
        criteria: {
          low: "The request names a local change or established implementation pattern; ordinary code reading inside the coding job is enough.",
          material: "Repository inspection is needed, but a coding job can still own the investigation and implementation together.",
          high: "Unknown cause, feasibility, architecture, integration behavior, or migration risk should be investigated or prototyped separately first.",
        },
      },
      scope_shape: {
        type: "choice",
        instructions: "What is the structural scope of the requested outcome?",
        criteria: {
          local: "One bounded behavior or localized change with one coherent acceptance target.",
          cross_cutting: "One outcome spans several components, interfaces, migrations, or operational boundaries.",
          multiple_outcomes: "The request contains independently deliverable outcomes that may need separate tasks or sequencing.",
          unknown: "The request does not contain enough information to identify its structural scope.",
        },
      },
    },
  } as const;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Jev lead-routing response ${name} must be an object`);
  return value as Record<string, unknown>;
}

function probability(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`Jev lead-routing response ${name} must be a probability`);
  return n;
}

function choice<T extends string>(answers: Record<string, unknown>, name: string, allowed: readonly T[]): ChoiceJudgment<T> {
  const answer = record(answers[name], `answers.${name}`);
  if (answer.type !== "choice" || typeof answer.choice !== "string" || !allowed.includes(answer.choice as T)) {
    throw new Error(`Jev lead-routing response answers.${name} must be one of: ${allowed.join(", ")}`);
  }
  const rawProbabilities = record(answer.probabilities, `answers.${name}.probabilities`);
  const probabilities = Object.fromEntries(Object.entries(rawProbabilities).map(([key, value]) => [key, probability(value, `answers.${name}.probabilities.${key}`)]));
  return {
    value: answer.choice as T,
    confidence: probability(answer.confidence, `answers.${name}.confidence`),
    probabilities,
  };
}

export function parseLeadRoutingResponse(value: unknown, state: LeadRoutingState, latencyMs = 0): LeadRoutingAssessment {
  const response = record(value, "body") as SystemOneResponse & Record<string, unknown>;
  const answers = record(response.answers, "answers");
  const judgments: LeadRoutingJudgments = {
    initialRoute: choice(answers, "initial_route", LEAD_ROUTES),
    productDefinition: choice(answers, "product_definition", PRODUCT_DEFINITION_STATES),
    acceptanceClarity: choice(answers, "acceptance_clarity", ACCEPTANCE_CLARITY_STATES),
    technicalUncertainty: choice(answers, "technical_uncertainty", TECHNICAL_UNCERTAINTY_STATES),
    scopeShape: choice(answers, "scope_shape", SCOPE_SHAPES),
  };
  const languageCaution = hasCjkText(state);
  const policy = applyLeadRoutingPolicy(judgments, { languageCaution });
  const usage = response.usage && typeof response.usage === "object" && !Array.isArray(response.usage)
    ? response.usage as Record<string, unknown>
    : {};
  return {
    ...policy,
    judgments,
    model: typeof response.model === "string" ? response.model : DEFAULT_JEV_MODEL,
    latencyMs,
    usage: {
      ...(Number.isFinite(Number(usage.input_tokens)) ? { inputTokens: Number(usage.input_tokens) } : {}),
      ...(Number.isFinite(Number(usage.output_tokens)) ? { outputTokens: Number(usage.output_tokens) } : {}),
    },
    languageCaution,
  };
}

export async function evaluateLeadRoutingWithJev(state: LeadRoutingState, options: JevClientOptions): Promise<LeadRoutingAssessment> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4_000);
  const started = Date.now();
  try {
    const response = await fetchImpl(options.endpoint ?? TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(buildLeadRoutingRequest(state, options.model)),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TypeSafe returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
    }
    return parseLeadRoutingResponse(await response.json() as unknown, state, Date.now() - started);
  } finally {
    clearTimeout(timeout);
  }
}
