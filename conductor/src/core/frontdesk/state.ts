import type { ConductorConfig } from "../lib/config.js";
import { describeFact } from "../lib/facts.js";
import type { TaskView } from "../lib/fold.js";
import type { FrontdeskState, FrontdeskTaskState } from "./types.js";

const BRIEF_CHARS = 500;
const DECISION_CHARS = 700;
const RECENT_FACTS = 2;
const RECENT_CHARS = 700;

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function taskState(task: TaskView): FrontdeskTaskState {
  return {
    id: task.id,
    brief: clip(task.brief, BRIEF_CHARS),
    ...(task.projectId ? { projectId: task.projectId } : {}),
    ...(task.lastDecision ? { latestDecision: clip(describeFact(task.lastDecision), DECISION_CHARS) } : {}),
    ...(task.waiting ? { waiting: task.waiting } : {}),
    recent: task.facts.slice(-RECENT_FACTS).map((fact) => clip(describeFact(fact), RECENT_CHARS)),
  };
}

/** The compact, stateless view Jev judges. It intentionally excludes SOPs,
 * workspace paths, provider settings and the rest of the chat transcript. */
export function buildFrontdeskState(
  message: string,
  tasks: readonly TaskView[],
  config: ConductorConfig,
): FrontdeskState {
  return {
    message,
    tasks: tasks.filter((task) => task.state === "open").map(taskState),
    projects: Object.keys(config.projects),
  };
}
