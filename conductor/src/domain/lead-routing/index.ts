import type { TaskView } from "../../core/lib/fold.js";

export { buildLeadRoutingState, hasCjkText } from "./state.js";
export { buildLeadRoutingRequest, evaluateLeadRoutingWithJev, parseLeadRoutingResponse } from "./jev.js";
export { applyLeadRoutingPolicy } from "./policy.js";
export type * from "./types.js";

/** Only the first handoff is a classification problem. Later wakes reconcile evidence. */
export function shouldEvaluateLeadRouting(task: TaskView): boolean {
  return task.state === "open" && task.lastDecisionSeq === 0 && !task.liveWorker && !task.pendingJob;
}
