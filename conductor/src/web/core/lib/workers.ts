import type { FactJson } from "./types";

export interface WorkerSession {
  id: string;
  type: string;
}

/** The concrete agent id assigned to each worker id by its Dispatched fact. */
export function workerAgentNames(facts: readonly FactJson[]): ReadonlyMap<string, string> {
  const agents = new Map<string, string>();
  for (const fact of facts) {
    if (fact.kind !== "Dispatched") continue;
    const workerId = value(fact.payload.workerId);
    const agent = value(fact.payload.agent);
    if (workerId && agent) agents.set(workerId, agent);
  }
  return agents;
}

/**
 * The newest Rome session opened by each worker. A failed session resume can
 * make one worker open twice, so the last Opened fact deliberately wins.
 */
export function workerSessions(facts: readonly FactJson[]): ReadonlyMap<string, WorkerSession> {
  const sessions = new Map<string, WorkerSession>();
  for (const fact of facts) {
    if (fact.kind !== "Opened") continue;
    const workerId = value(fact.payload.workerId);
    const id = value(fact.payload.romeSessionId);
    const type = value(fact.payload.sessionType);
    if (workerId && id && type) sessions.set(workerId, { id, type });
  }
  return sessions;
}

function value(input: unknown): string {
  return typeof input === "string" ? input : "";
}
