import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

  /**
   * Durable Rome sessions that belong to a Task. Token accounting remains
   * owned by Rome's session store; Conductor only keeps this small join so the
   * guardian can aggregate the coordinator and worker sessions per Task.
   */
  const taskSessions = sqliteTable(
    `${tablePrefix}__task_sessions`,
    {
      id: text("id").primaryKey(),
      taskId: text("task_id").notNull(),
      sessionId: text("session_id").notNull(),
      sessionType: text("session_type").notNull(),
      role: text("role").notNull(),
      workerId: text("worker_id"),
      jobId: text("job_id"),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
      lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    },
    (t) => [
      uniqueIndex(`${tablePrefix}__task_sessions_task_session_idx`).on(t.taskId, t.sessionId),
      index(`${tablePrefix}__task_sessions_task_idx`).on(t.taskId),
    ],
  );

  /**
   * Observations from the experimental Jev front-desk router. Shadow runs are
   * deliberately mutable: the row is opened before the ordinary LLM front
   * desk runs, then completed with both Jev's prediction and the person fact
   * the LLM actually wrote. This is evaluation data, not task history, so it
   * does not belong in the append-only facts table.
   */
  const frontdeskShadowRuns = sqliteTable(
    `${tablePrefix}__frontdesk_shadow_runs`,
    {
      id: text("id").primaryKey(),
      sessionId: text("session_id").notNull(),
      channelThreadKey: text("channel_thread_key").notNull(),
      input: text("input").notNull(),
      state: text("state").notNull(),
      status: text("status").notNull(),
      model: text("model"),
      decision: text("decision"),
      rawResponse: text("raw_response"),
      inputTokens: integer("input_tokens"),
      outputTokens: integer("output_tokens"),
      latencyMs: integer("latency_ms"),
      error: text("error"),
      actualKind: text("actual_kind"),
      actualTaskId: text("actual_task_id"),
      actualProjectId: text("actual_project_id"),
      matched: integer("matched", { mode: "boolean" }),
      mismatch: text("mismatch"),
      createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
      completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    },
    (t) => [
      index(`${tablePrefix}__frontdesk_shadow_created_idx`).on(t.createdAt),
      index(`${tablePrefix}__frontdesk_shadow_session_idx`).on(t.sessionId),
    ],
  );

  return { facts, config, locks, workerHealth, taskSessions, frontdeskShadowRuns };
}

const defaultSchema = createAppDbSchema();

export const facts = defaultSchema.facts;
export const config = defaultSchema.config;
export const locks = defaultSchema.locks;

export const workerHealth = defaultSchema.workerHealth;
export const taskSessions = defaultSchema.taskSessions;
export const frontdeskShadowRuns = defaultSchema.frontdeskShadowRuns;
