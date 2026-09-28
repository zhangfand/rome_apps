import { useEffect, useState } from "react";
import { fetchWorkerPlan, type WorkerPlan } from "./worker-plan.js";

export const WORKER_PLAN_POLL_MS = 15_000;

/**
 * Polls a live worker's todo list while the page is visible. A failed read
 * keeps the last list rather than blanking it; a different session starts
 * empty so one worker's list never shows under another.
 */
export function useWorkerPlan(sessionId: string | undefined): WorkerPlan | undefined {
  const [plan, setPlan] = useState<{ sessionId: string; plan?: WorkerPlan }>();

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const read = () => {
      if (document.hidden) return;
      void fetchWorkerPlan(sessionId).then((next) => {
        if (active) setPlan({ sessionId, plan: next });
      }).catch(() => { /* display only: keep what is on screen */ });
    };
    read();
    const timer = window.setInterval(read, WORKER_PLAN_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  return sessionId && plan?.sessionId === sessionId ? plan.plan : undefined;
}
