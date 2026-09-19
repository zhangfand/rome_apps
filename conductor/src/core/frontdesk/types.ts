import type { FactKind } from "../lib/facts.js";

export const FRONTDESK_INTENTS = [
  "create_task",
  "reply_to_task",
  "complete_task",
  "cancel_task",
  "ask_status",
  "other",
  "ambiguous",
] as const;

export type FrontdeskIntent = (typeof FRONTDESK_INTENTS)[number];

export interface FrontdeskTaskState {
  id: string;
  brief: string;
  projectId?: string;
  latestDecision?: string;
  waiting?: { reason: string; resumeAfter: string };
  recent: string[];
}

export interface FrontdeskState {
  message: string;
  tasks: FrontdeskTaskState[];
  projects: string[];
}

export interface FrontdeskDecision {
  intent: FrontdeskIntent;
  targetTask: string;
  project: string;
  explicitAcceptance: number;
  explicitCancellation: number;
  answersLatestQuestion: number;
  needsGeneratedResponse: number;
  confidence: {
    intent: number;
    targetTask: number;
    project: number;
  };
}

export interface JevEvaluation {
  model: string;
  decision: FrontdeskDecision;
  rawResponse: unknown;
  usage: { inputTokens?: number; outputTokens?: number };
  latencyMs: number;
}

export interface ActualFrontdeskOutcome {
  kind?: FactKind;
  taskId?: string;
  projectId?: string;
}

export interface FrontdeskComparison {
  matched: boolean;
  mismatch?: string;
}
