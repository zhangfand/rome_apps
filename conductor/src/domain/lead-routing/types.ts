export const LEAD_ROUTES = ["pm", "coding", "investigation", "lead_deliberation"] as const;
export type LeadRoute = (typeof LEAD_ROUTES)[number];

export interface LeadRoutingConfig {
  enabled: boolean;
  model: string;
}

export const PRODUCT_DEFINITION_STATES = ["ready", "missing", "not_applicable"] as const;
export type ProductDefinitionState = (typeof PRODUCT_DEFINITION_STATES)[number];

export const ACCEPTANCE_CLARITY_STATES = ["clear", "partial", "unsettled"] as const;
export type AcceptanceClarityState = (typeof ACCEPTANCE_CLARITY_STATES)[number];

export const TECHNICAL_UNCERTAINTY_STATES = ["low", "material", "high"] as const;
export type TechnicalUncertaintyState = (typeof TECHNICAL_UNCERTAINTY_STATES)[number];

export const SCOPE_SHAPES = ["local", "cross_cutting", "multiple_outcomes", "unknown"] as const;
export type ScopeShape = (typeof SCOPE_SHAPES)[number];

export interface LeadRoutingState {
  request: string;
  personUpdates: string[];
  project: {
    id: string;
    workspace: string;
    source: string;
  };
}

export interface ChoiceJudgment<T extends string> {
  value: T;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface LeadRoutingJudgments {
  initialRoute: ChoiceJudgment<LeadRoute>;
  productDefinition: ChoiceJudgment<ProductDefinitionState>;
  acceptanceClarity: ChoiceJudgment<AcceptanceClarityState>;
  technicalUncertainty: ChoiceJudgment<TechnicalUncertaintyState>;
  scopeShape: ChoiceJudgment<ScopeShape>;
}

export interface LeadRoutingAssessment {
  recommendation: LeadRoute;
  confidence: number;
  reasons: string[];
  judgments: LeadRoutingJudgments;
  model: string;
  latencyMs: number;
  usage: { inputTokens?: number; outputTokens?: number };
  /** Jev accepts CJK, but its docs currently warn that accuracy is lower. */
  languageCaution: boolean;
}
