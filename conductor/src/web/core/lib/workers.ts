import type { FactJson } from "./types";

export interface WorkerSession {
  id: string;
  type: string;
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
