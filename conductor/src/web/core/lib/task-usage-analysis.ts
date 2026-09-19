import type { TaskDetailJson, TaskUsageSession } from "./types.js";
import {
  aggregateTaskUsage,
  fetchModelUsage,
  fetchSessionUsage,
  usageSessionIds,
  type ModelUsage,
  type SessionRecord,
  type TaskTokenUsage,
} from "./task-usage.js";

export interface TurnUsage {
  id: string;
  sessionId: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  status?: string;
  provider?: string;
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  costUsd?: number;
  toolSteps?: number;
}

export interface SessionUsageAnalysis {
  ref: TaskUsageSession;
  record?: SessionRecord;
  turns: TurnUsage[];
  models: string[];
  traceUnavailable?: boolean;
}

export interface TaskUsageAnalysis {
  usage: TaskTokenUsage;
  sessions: SessionUsageAnalysis[];
  models: ModelUsage[];
}

export async function fetchTaskUsageAnalysis(task: TaskDetailJson): Promise<TaskUsageAnalysis> {
  const ids = usageSessionIds([task]);
  const [records, models] = await Promise.all([fetchSessionUsage(ids), fetchModelUsage(ids)]);
  const sessions = await mapLimited(task.usageSessions, 5, async (ref): Promise<SessionUsageAnalysis> => {
    const record = records.get(ref.id);
    try {
      const turns = await fetchTurns(ref.id);
      return {
        ref,
        record,
        turns,
        models: [...new Set(turns.map((turn) => turn.model).filter((model): model is string => Boolean(model)))],
      };
    } catch {
      return {
        ref,
        record,
        turns: [],
        models: record?.largeModelSelection ? [record.largeModelSelection] : [],
        traceUnavailable: true,
      };
    }
  });
  return { usage: aggregateTaskUsage(task, records), sessions, models };
}

async function fetchTurns(sessionId: string): Promise<TurnUsage[]> {
  const base = `/api/sessions/${encodeURIComponent(sessionId)}`;
  const response = await fetch(`${base}/messages`, { credentials: "include" });
  if (!response.ok) throw new Error(`session messages returned ${response.status}`);
  const messages = await response.json() as Array<{ turnId?: string; role?: string; createdAt?: string }>;
  const turnIds = [...new Set(messages.map((message) => message.turnId).filter((id): id is string => Boolean(id)))];
  return mapLimited(turnIds, 4, async (turnId) => {
    const traceResponse = await fetch(`${base}/turns/${encodeURIComponent(turnId)}/trace`, { credentials: "include" });
    if (!traceResponse.ok) throw new Error(`session trace returned ${traceResponse.status}`);
    const body = await traceResponse.json() as { trace?: TraceSnapshot };
    const trace = body.trace;
    const terminal = trace ? terminalBlock(trace) : undefined;
    const related = messages.filter((message) => message.turnId === turnId);
    const startedAt = related.find((message) => message.role === "user")?.createdAt ?? related[0]?.createdAt;
    const finishedAt = [...related].reverse().find((message) => message.role === "assistant")?.createdAt ?? related.at(-1)?.createdAt;
    return {
      id: turnId,
      sessionId,
      startedAt,
      finishedAt,
      durationMs: trace?.summary?.totalDurationMs ?? terminal?.accounting?.durationMs,
      status: trace?.summary?.turnStatus,
      provider: terminal?.accounting?.provider,
      model: terminal?.accounting?.model,
      usage: terminal?.accounting?.usage,
      costUsd: terminal?.accounting?.costUsd,
      toolSteps: trace?.summary?.totalSteps,
    };
  });
}

interface TraceAccounting {
  provider?: string;
  model?: string;
  usage?: TurnUsage["usage"];
  costUsd?: number;
  durationMs?: number;
}

interface TraceBlock {
  type?: string;
  accounting?: TraceAccounting;
}

interface TraceSnapshot {
  segments?: Array<{ kind?: string; block?: TraceBlock; blocks?: TraceBlock[] }>;
  summary?: { totalDurationMs?: number; turnStatus?: string; totalSteps?: number };
}

function terminalBlock(trace: TraceSnapshot): TraceBlock | undefined {
  const blocks = (trace.segments ?? []).flatMap((segment) => segment.kind === "block"
    ? segment.block ? [segment.block] : []
    : segment.blocks ?? []);
  return [...blocks].reverse().find((block) => (block.type === "result" || block.type === "error") && block.accounting);
}

async function mapLimited<T, R>(items: readonly T[], limit: number, operation: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = [];
  for (let offset = 0; offset < items.length; offset += limit) {
    output.push(...await Promise.all(items.slice(offset, offset + limit).map(operation)));
  }
  return output;
}
