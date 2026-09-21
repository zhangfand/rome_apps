import { originOf } from "../../core/lib/facts.js";
import type { TaskView } from "../../core/lib/fold.js";
import type { LeadRoutingState } from "./types.js";

const REQUEST_CHARS = 6_000;
const UPDATE_CHARS = 1_500;
const PERSON_UPDATES = 3;

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Jev gets only the compact intake state needed for one initial routing call.
 * The full ledger, SOP, paths and worker history stay with the lead LLM.
 */
export function buildLeadRoutingState(task: TaskView, defaultWorkspaceKind: string): LeadRoutingState {
  const created = task.facts.find((fact) => fact.kind === "Created");
  const origin = created?.kind === "Created" ? originOf(created) : undefined;
  const personUpdates = task.facts
    .filter((fact) => fact.kind === "Reply")
    .slice(-PERSON_UPDATES)
    .map((fact) => clip(fact.kind === "Reply" ? fact.payload.text : "", UPDATE_CHARS));

  return {
    request: clip(task.brief, REQUEST_CHARS),
    personUpdates,
    project: {
      id: task.projectId ?? "not_configured",
      workspace: String(task.project?.workspace ?? defaultWorkspaceKind),
      source: origin?.source ?? "person",
    },
  };
}

export function hasCjkText(state: LeadRoutingState): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test([state.request, ...state.personUpdates].join("\n"));
}
