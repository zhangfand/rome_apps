import { and, eq, gt } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";
import { LedgerRepository } from "./ledger.js";
import { fold, foldTask } from "../../lib/fold.js";
import { type DispatchedFact, type Fact } from "../../lib/facts.js";
import { HEARTBEAT_LEASE_MS, heartbeatState, type WorkerHeartbeat } from "../../lib/worker-health.js";

/** Mutable supervision data, NOT a stream of heartbeat facts in the ledger. */
export class WorkerHealthRepository {
  private readonly tables;
  constructor(private readonly db: DrizzleDb, private readonly tablePrefix: string) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  peek(workerId: string): WorkerHeartbeat | undefined {
    return this.db.select().from(this.tables.workerHealth)
      .where(eq(this.tables.workerHealth.workerId, workerId)).get();
  }

  /** Claim once, before invoking summon. A duplicate or late dispatch must not run. */
  claim(started: DispatchedFact, ownerId: string, now = new Date()): boolean {
    return this.db.transaction((tx) => {
      const connection = tx as unknown as DrizzleDb;
      const ledger = new LedgerRepository(connection, this.tablePrefix);
      const current = activeStart(ledger, started.taskId, started.payload.workerId);
      if (!current) return false;
      const health = new WorkerHealthRepository(connection, this.tablePrefix);
      // Never take over the same worker ID, including after expiry.
      if (health.peek(started.payload.workerId) || heartbeatState(current, undefined, now).status === "expired") return false;
      tx.insert(this.tables.workerHealth).values({
        taskId: started.taskId, workerId: started.payload.workerId, ownerId,
        lastHeartbeatAt: now.getTime(), expiresAt: now.getTime() + HEARTBEAT_LEASE_MS,
      }).run();
      return true;
    }, { behavior: "immediate" });
  }

  renew(taskId: string, workerId: string, ownerId: string, now = new Date()): boolean {
    return this.db.transaction((tx) => {
      const ledger = new LedgerRepository(tx as unknown as DrizzleDb, this.tablePrefix);
      if (!activeStart(ledger, taskId, workerId)) return false;
      return tx.update(this.tables.workerHealth)
        .set({ lastHeartbeatAt: now.getTime(), expiresAt: now.getTime() + HEARTBEAT_LEASE_MS })
        .where(and(
          eq(this.tables.workerHealth.workerId, workerId),
          eq(this.tables.workerHealth.taskId, taskId),
          eq(this.tables.workerHealth.ownerId, ownerId),
          gt(this.tables.workerHealth.expiresAt, now.getTime()),
        )).run().changes === 1;
    }, { behavior: "immediate" });
  }

  /**
   * Re-read health AND ledger under the same write lock. Renewal/completion
   * winning the race means no Lost; Lost winning means late outcomes are dropped.
   * Missing/unreadable tables throw, never turn into "no heartbeat".
   */
  expire(taskId: string, workerId: string, now = new Date()): Fact | undefined {
    return this.db.transaction((tx) => {
      const connection = tx as unknown as DrizzleDb;
      const ledger = new LedgerRepository(connection, this.tablePrefix);
      const started = activeStart(ledger, taskId, workerId);
      if (!started) return undefined;
      const heartbeat = new WorkerHealthRepository(connection, this.tablePrefix).peek(workerId);
      if (heartbeatState(started, heartbeat, now).status !== "expired") return undefined;
      const why = heartbeat
        ? `worker heartbeat expired (last heartbeat ${new Date(heartbeat.lastHeartbeatAt).toISOString()}, lease expired ${new Date(heartbeat.expiresAt).toISOString()}); wrapper liveness unconfirmed`
        : "worker startup heartbeat missing past grace period";
      return ledger.appendWorkerOutcome({
        taskId, kind: "Lost", by: "runtime", source: "conductor:tick, observing worker heartbeat",
        payload: { workerId, why },
      });
    }, { behavior: "immediate" });
  }

  /** Read-only health view. No lease is created or refreshed here. */
  status(now = new Date()) {
    const ledger = new LedgerRepository(this.db, this.tablePrefix);
    return fold(now, ledger.all()).tasks.flatMap((task) => {
      if (!task.liveWorker) return [];
      const started = activeStart(ledger, task.id, task.liveWorker.workerId);
      if (!started) return [];
      return [{ taskId: task.id, workerId: started.payload.workerId,
        ...heartbeatState(started, this.peek(started.payload.workerId), now) }];
    });
  }
}

function activeStart(ledger: LedgerRepository, taskId: string, workerId: string): DispatchedFact | undefined {
  const facts = ledger.factsFor(taskId);
  if (!facts.length) return undefined;
  const task = foldTask(facts);
  if (task.state !== "open" || task.liveWorker?.workerId !== workerId) return undefined;
  return facts.find((fact): fact is DispatchedFact => fact.kind === "Dispatched" && fact.payload.workerId === workerId);
}

export function createWorkerHealthRepository(ctx: AppDbContext) {
  return new WorkerHealthRepository(ctx.connection, ctx.tablePrefix);
}
