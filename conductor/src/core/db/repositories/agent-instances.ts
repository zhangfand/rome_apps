import { and, asc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import { createAppDbSchema } from "../schema.js";

export type AgentInstanceStatus = "active" | "broken" | "retired";

export interface AgentInstanceRef {
  id: string;
  agentName: string;
  status: AgentInstanceStatus;
  taskId: string;
  sessionId?: string;
  cursorSeq?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TASK = "task";
const COORDINATOR = "coordinator";
const AGENT_SESSION = "agent_session";
const RUNTIME_SESSION = "runtime_session";

/**
 * Conductor-local first-class Agent Instances. An Instance is the durable
 * identity; Task and resumable Agent Session ids are explicit mappings.
 */
export class AgentInstanceRepository {
  private readonly tables;

  constructor(private readonly db: DrizzleDb, tablePrefix: string) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  ensureTaskCoordinator(taskId: string, agentName: string): AgentInstanceRef {
    const existing = this.forTaskCoordinator(taskId);
    if (existing) {
      if (existing.agentName !== agentName) {
        throw new Error(`Agent Instance ${existing.id} is bound to ${existing.agentName}, not ${agentName}`);
      }
      return existing;
    }

    const now = new Date();
    const instanceId = `ai-${crypto.randomUUID()}`;
    this.db.insert(this.tables.agentInstances).values({
      id: instanceId,
      agentName,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).run();
    this.db.insert(this.tables.agentInstanceMappings).values({
      id: crypto.randomUUID(),
      instanceId,
      identityType: TASK,
      identityValue: taskId,
      relation: COORDINATOR,
      createdAt: now,
      updatedAt: now,
    }).run();
    return this.forTaskCoordinator(taskId)!;
  }

  forTaskCoordinator(taskId: string): AgentInstanceRef | undefined {
    const taskMapping = this.db.select().from(this.tables.agentInstanceMappings).where(and(
      eq(this.tables.agentInstanceMappings.identityType, TASK),
      eq(this.tables.agentInstanceMappings.identityValue, taskId),
      eq(this.tables.agentInstanceMappings.relation, COORDINATOR),
    )).get();
    if (!taskMapping) return undefined;
    return this.refFor(taskMapping.instanceId, taskId, taskMapping.cursorSeq ?? undefined);
  }

  allTaskCoordinators(): AgentInstanceRef[] {
    return this.db.select().from(this.tables.agentInstanceMappings).where(and(
      eq(this.tables.agentInstanceMappings.identityType, TASK),
      eq(this.tables.agentInstanceMappings.relation, COORDINATOR),
    )).orderBy(asc(this.tables.agentInstanceMappings.createdAt)).all().flatMap((mapping) => {
      const ref = this.refFor(mapping.instanceId, mapping.identityValue, mapping.cursorSeq ?? undefined);
      return ref ? [ref] : [];
    });
  }

  bindRuntimeSession(instanceId: string, sessionId: string): AgentInstanceRef {
    const instance = this.instance(instanceId);
    if (!instance) throw new Error(`Agent Instance ${instanceId} does not exist`);
    const existing = this.runtimeSessionMapping(instanceId);
    if (existing && existing.identityValue !== sessionId) {
      throw new Error(`Agent Instance ${instanceId} is already bound to Agent Session ${existing.identityValue}`);
    }
    const claimed = this.db.select().from(this.tables.agentInstanceMappings).where(and(
      eq(this.tables.agentInstanceMappings.identityType, AGENT_SESSION),
      eq(this.tables.agentInstanceMappings.identityValue, sessionId),
      eq(this.tables.agentInstanceMappings.relation, RUNTIME_SESSION),
    )).get();
    if (claimed && claimed.instanceId !== instanceId) {
      throw new Error(`Agent Session ${sessionId} already belongs to Agent Instance ${claimed.instanceId}`);
    }
    if (!existing) {
      const now = new Date();
      this.db.insert(this.tables.agentInstanceMappings).values({
        id: crypto.randomUUID(),
        instanceId,
        identityType: AGENT_SESSION,
        identityValue: sessionId,
        relation: RUNTIME_SESSION,
        createdAt: now,
        updatedAt: now,
      }).run();
      this.touch(instanceId, now);
    }
    return this.refById(instanceId)!;
  }

  advanceTaskCursor(instanceId: string, seq: number): AgentInstanceRef {
    const mapping = this.taskMapping(instanceId);
    if (!mapping) throw new Error(`Agent Instance ${instanceId} has no coordinator Task mapping`);
    const now = new Date();
    this.db.update(this.tables.agentInstanceMappings).set({ cursorSeq: seq, updatedAt: now }).where(eq(this.tables.agentInstanceMappings.id, mapping.id)).run();
    this.touch(instanceId, now);
    return this.refFor(instanceId, mapping.identityValue, seq)!;
  }

  markBroken(instanceId: string): AgentInstanceRef {
    const now = new Date();
    this.db.update(this.tables.agentInstances).set({ status: "broken", updatedAt: now }).where(eq(this.tables.agentInstances.id, instanceId)).run();
    return this.refById(instanceId)!;
  }

  private refById(instanceId: string): AgentInstanceRef | undefined {
    const mapping = this.taskMapping(instanceId);
    return mapping ? this.refFor(instanceId, mapping.identityValue, mapping.cursorSeq ?? undefined) : undefined;
  }

  private refFor(instanceId: string, taskId: string, cursorSeq?: number): AgentInstanceRef | undefined {
    const instance = this.instance(instanceId);
    if (!instance) return undefined;
    const session = this.runtimeSessionMapping(instanceId);
    return {
      id: instance.id,
      agentName: instance.agentName,
      status: instance.status === "broken" || instance.status === "retired" ? instance.status : "active",
      taskId,
      sessionId: session?.identityValue,
      cursorSeq,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    };
  }

  private instance(instanceId: string) {
    return this.db.select().from(this.tables.agentInstances).where(eq(this.tables.agentInstances.id, instanceId)).get();
  }

  private taskMapping(instanceId: string) {
    return this.db.select().from(this.tables.agentInstanceMappings).where(and(
      eq(this.tables.agentInstanceMappings.instanceId, instanceId),
      eq(this.tables.agentInstanceMappings.identityType, TASK),
      eq(this.tables.agentInstanceMappings.relation, COORDINATOR),
    )).get();
  }

  private runtimeSessionMapping(instanceId: string) {
    return this.db.select().from(this.tables.agentInstanceMappings).where(and(
      eq(this.tables.agentInstanceMappings.instanceId, instanceId),
      eq(this.tables.agentInstanceMappings.identityType, AGENT_SESSION),
      eq(this.tables.agentInstanceMappings.relation, RUNTIME_SESSION),
    )).get();
  }

  private touch(instanceId: string, at: Date): void {
    this.db.update(this.tables.agentInstances).set({ updatedAt: at }).where(eq(this.tables.agentInstances.id, instanceId)).run();
  }
}

export function createAgentInstanceRepository(ctx: AppDbContext): AgentInstanceRepository {
  return new AgentInstanceRepository(ctx.connection, ctx.tablePrefix);
}
