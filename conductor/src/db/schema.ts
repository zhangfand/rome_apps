import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The Conductor's whole store. `facts` is the ledger: append-only, never updated,
 * never deleted, and the only description of a task there is. `config` holds
 * the handful of settings that are not facts about a task, and `locks` holds
 * the one lock that keeps reconciles from overlapping. `workerHealth` holds
 * mutable wrapper leases; only their loss becomes a fact.
 */
export function createAppDbSchema(tablePrefix: string = "conductor") {
  const facts = sqliteTable(
    `${tablePrefix}__facts`,
    {
      /** The ledger's total order. SQLite assigns it; app code never does. */
      seq: integer("seq").primaryKey({ autoIncrement: true }),
      id: text("id").notNull(),
      taskId: text("task_id").notNull(),
      /** One of the fact kinds in src/lib/facts.ts. */
      kind: text("kind").notNull(),
      /** A person's id, a worker id, or "runtime". */
      by: text("by").notNull(),
      /** A person's words or the action they took, verbatim. */
      source: text("source"),
      /** The kind's payload, as JSON. */
      payload: text("payload").notNull(),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    },
    (t) => [
      index(`${tablePrefix}__facts_task_idx`).on(t.taskId),
      index(`${tablePrefix}__facts_id_idx`).on(t.id),
    ],
  );

  const config = sqliteTable(`${tablePrefix}__config`, {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  });

  const locks = sqliteTable(`${tablePrefix}__locks`, {
    name: text("name").primaryKey(),
    /** Epoch milliseconds the current holder's lease runs out. */
    heldUntil: integer("held_until").notNull(),
  });

  const workerHealth = sqliteTable(`${tablePrefix}__worker_health`, {
    workerId: text("worker_id").primaryKey(),
    taskId: text("task_id").notNull(),
    /** Unique wrapper invocation; duplicate dispatches cannot share a lease. */
    ownerId: text("owner_id").notNull(),
    lastHeartbeatAt: integer("last_heartbeat_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  });

  return { facts, config, locks, workerHealth };
}

const defaultSchema = createAppDbSchema();

export const facts = defaultSchema.facts;
export const config = defaultSchema.config;
export const locks = defaultSchema.locks;

export const workerHealth = defaultSchema.workerHealth;
