import {
  FRONTDESK_INTENTS,
  type FrontdeskDecision,
  type FrontdeskIntent,
  type FrontdeskState,
  type JevEvaluation,
} from "./types.js";

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_JEV_MODEL = "jev-latest";
export const JEV_INPUT_USD_PER_MILLION = 0.042;

export interface JevClientOptions {
  apiKey: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

interface NoulAnswer {
  type: "noul";
  noul: number;
}

interface SystemOneResponse {
  model?: unknown;
  answers?: unknown;
  usage?: unknown;
}

function taskCriteria(state: FrontdeskState): Record<string, string> {
  const entries = state.tasks.map((task) => [
    task.id,
    [
      task.brief,
      task.projectId ? `project: ${task.projectId}` : "",
      task.latestDecision ? `latest decision: ${task.latestDecision}` : "",
    ].filter(Boolean).join(" | "),
  ] as const);
  return Object.fromEntries([
    ...entries,
    ["no_existing_task", "The message starts a new outcome and is not about any existing open task."],
    ["ambiguous", "More than one task plausibly matches, or no task can be identified safely."],
  ]);
}

function projectCriteria(state: FrontdeskState): Record<string, string> {
  return Object.fromEntries([
    ...state.projects.map((project) => [project, `The configured project named ${project}.`] as const),
    ["selected_project", "Use the project selected in the chat when it is available to the caller."],
    ["ambiguous", "The project cannot be resolved safely from the message and task state."],
  ]);
}

export function buildJevRequest(state: FrontdeskState, model = DEFAULT_JEV_MODEL) {
  return {
    model,
    state,
    questions: {
      intent: {
        type: "choice",
        instructions: "What should the Conductor front desk do with this message?",
        criteria: {
          create_task: "Start a new durable outcome that is not represented by an existing task.",
          reply_to_task: "Add an answer, instruction, correction, or steering to an existing open task.",
          complete_task: "The person explicitly accepts a delivered result and authorizes closing the task as completed.",
          cancel_task: "The person explicitly withdraws or drops existing work.",
          ask_status: "Ask about existing work without changing it.",
          other: "Small talk or a request that is not an operation on a Conductor task.",
          ambiguous: "There is not enough information to choose one of the other actions safely.",
        },
      },
      target_task: {
        type: "choice",
        instructions: "Which existing open task is the message about?",
        criteria: taskCriteria(state),
      },
      project: {
        type: "choice",
        instructions: "Which configured project should a newly created task use?",
        criteria: projectCriteria(state),
      },
      explicit_acceptance: {
        type: "noul",
        instructions: "Does the message explicitly accept the delivered result and authorize closing that task as completed?",
        criteria: {
          true: "Clear acceptance of the result. A short acknowledgement counts only when the latest decision explicitly asks whether to accept and close.",
          false: "Steering, thanks, acknowledgement without acceptance context, a status question, or uncertainty.",
        },
      },
      explicit_cancellation: {
        type: "noul",
        instructions: "Does the message explicitly withdraw, cancel, or ask to stop the work?",
        criteria: {
          true: "The person clearly wants the task stopped or dropped.",
          false: "Anything else, including a temporary wait or a change of direction.",
        },
      },
      answers_latest_question: {
        type: "noul",
        instructions: "Does the message answer the latest question that the coordinator asked on the target task?",
      },
      needs_generated_response: {
        type: "noul",
        instructions: "Does handling this message require a newly written natural-language answer rather than recording a task fact or rendering a deterministic status template?",
      },
    },
  } as const;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Jev response ${name} must be an object`);
  return value as Record<string, unknown>;
}

function finiteProbability(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`Jev response ${name} must be a probability`);
  return n;
}

function choice(answers: Record<string, unknown>, name: string): ChoiceAnswer {
  const answer = record(answers[name], `answers.${name}`);
  if (answer.type !== "choice" || typeof answer.choice !== "string") throw new Error(`Jev response answers.${name} must be a choice`);
  return {
    type: "choice",
    choice: answer.choice,
    confidence: finiteProbability(answer.confidence, `answers.${name}.confidence`),
    probabilities: record(answer.probabilities, `answers.${name}.probabilities`) as Record<string, number>,
  };
}

function noul(answers: Record<string, unknown>, name: string): number {
  const answer = record(answers[name], `answers.${name}`);
  if (answer.type !== "noul") throw new Error(`Jev response answers.${name} must be a noul`);
  return finiteProbability(answer.noul, `answers.${name}.noul`);
}

export function parseJevResponse(value: unknown, state: FrontdeskState): { model: string; decision: FrontdeskDecision; usage: JevEvaluation["usage"] } {
  const response = record(value, "body") as SystemOneResponse & Record<string, unknown>;
  const answers = record(response.answers, "answers");
  const intent = choice(answers, "intent");
  const target = choice(answers, "target_task");
  const project = choice(answers, "project");
  if (!(FRONTDESK_INTENTS as readonly string[]).includes(intent.choice)) throw new Error(`Jev returned unknown intent ${intent.choice}`);
  if (![...state.tasks.map((task) => task.id), "no_existing_task", "ambiguous"].includes(target.choice)) {
    throw new Error(`Jev returned unknown task ${target.choice}`);
  }
  if (![...state.projects, "selected_project", "ambiguous"].includes(project.choice)) {
    throw new Error(`Jev returned unknown project ${project.choice}`);
  }
  const usage = response.usage && typeof response.usage === "object" && !Array.isArray(response.usage)
    ? response.usage as Record<string, unknown>
    : {};
  return {
    model: typeof response.model === "string" ? response.model : DEFAULT_JEV_MODEL,
    decision: {
      intent: intent.choice as FrontdeskIntent,
      targetTask: target.choice,
      project: project.choice,
      explicitAcceptance: noul(answers, "explicit_acceptance"),
      explicitCancellation: noul(answers, "explicit_cancellation"),
      answersLatestQuestion: noul(answers, "answers_latest_question"),
      needsGeneratedResponse: noul(answers, "needs_generated_response"),
      confidence: { intent: intent.confidence, targetTask: target.confidence, project: project.confidence },
    },
    usage: {
      ...(Number.isFinite(Number(usage.input_tokens)) ? { inputTokens: Number(usage.input_tokens) } : {}),
      ...(Number.isFinite(Number(usage.output_tokens)) ? { outputTokens: Number(usage.output_tokens) } : {}),
    },
  };
}

export async function evaluateFrontdeskWithJev(state: FrontdeskState, options: JevClientOptions): Promise<JevEvaluation> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);
  const started = Date.now();
  try {
    const response = await fetchImpl(options.endpoint ?? TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildJevRequest(state, options.model)),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TypeSafe returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
    }
    const rawResponse: unknown = await response.json();
    const parsed = parseJevResponse(rawResponse, state);
    return { ...parsed, rawResponse, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

export function estimatedJevInputCost(inputTokens: number | undefined): number | undefined {
  return inputTokens === undefined ? undefined : inputTokens * JEV_INPUT_USD_PER_MILLION / 1_000_000;
}
