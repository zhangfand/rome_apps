import type { DispatchedFact } from "./facts.js";

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_LEASE_MS = 3 * 60_000;
export const WORKER_START_GRACE_MS = 3 * 60_000;

export interface WorkerHeartbeat {
  workerId: string;
  taskId: string;
  ownerId: string;
  lastHeartbeatAt: number;
  expiresAt: number;
}

/** Observations, not task state. Expiry is suspicion of loss, not proof of death. */
export function heartbeatState(dispatched: DispatchedFact, heartbeat: WorkerHeartbeat | undefined, now: Date) {
  const deadline = heartbeat?.expiresAt ?? dispatched.createdAt.getTime() + WORKER_START_GRACE_MS;
  return {
    status: now.getTime() >= deadline ? "expired" as const : heartbeat ? "alive" as const : "starting" as const,
    lastHeartbeatAt: heartbeat ? new Date(heartbeat.lastHeartbeatAt).toISOString() : undefined,
    expiresAt: new Date(deadline).toISOString(),
  };
}

/**
 * Only the wrapper calls this, never a model or the reconciler. No overlapping
 * writes: renew is synchronous against the app's SQLite connection. A failed
 * write is logged and retried; it never fabricates freshness. A rejected lease
 * cannot be resurrected. The caller MUST stop this in finally.
 */
export function startHeartbeatTimer(renew: () => boolean, onError: (error: unknown) => void): () => void {
  const timer = setInterval(() => {
    try {
      if (!renew()) clearInterval(timer);
    } catch (error) {
      onError(error);
    }
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
