import type { TaskSummary, TaskUsageSession } from "./types.js";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd?: number;
  runCount: number;
  sessionCount: number;
  loadedSessionCount: number;
}

export interface TaskTokenUsage extends TokenUsage {
  coordinator: TokenUsage;
  workers: TokenUsage;
}

interface SessionRecord {
  id: string;
  stats: {
    runCount: number;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      totalTokens: number;
      costUsd: number | null;
    };
  };
}

export function aggregateTaskUsage(task: Pick<TaskSummary, "usageSessions">, sessions: ReadonlyMap<string, SessionRecord>): TaskTokenUsage {
  const unique = uniqueSessions(task.usageSessions);
  const all = empty(unique.length);
  const coordinator = empty(unique.filter((ref) => ref.role === "coordinator").length);
  const workers = empty(unique.filter((ref) => ref.role === "worker").length);
  for (const ref of unique) {
    const record = sessions.get(ref.id);
    if (!record) continue;
    add(all, record);
    add(ref.role === "coordinator" ? coordinator : workers, record);
  }
  return { ...all, coordinator, workers };
}

export async function fetchSessionUsage(ids: readonly string[]): Promise<Map<string, SessionRecord>> {
  const records = new Map<string, SessionRecord>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const response = await fetch("/api/sessions/query", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: {
          time: { kind: "all" },
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          sessions: { ids: batch },
        },
        sort: { field: "activity", direction: "desc" },
        page: { offset: 0, limit: batch.length },
      }),
    });
    if (!response.ok) throw new Error(`session usage returned ${response.status}`);
    const body = await response.json() as { sessions?: SessionRecord[] };
    for (const record of body.sessions ?? []) records.set(record.id, record);
  }
  return records;
}

export function usageSessionIds(tasks: readonly Pick<TaskSummary, "usageSessions">[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.usageSessions.map((session) => session.id)))].sort();
}

export function formatTokens(value: number, compact = false): string {
  if (!compact) return value.toLocaleString();
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: value >= 100_000 ? 0 : 1 }).format(value);
}

export function formatCost(value?: number): string {
  if (value === undefined) return "—";
  if (value > 0 && value < 0.01) return `<$0.01`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function uniqueSessions(refs: readonly TaskUsageSession[]): TaskUsageSession[] {
  return [...new Map(refs.map((ref) => [ref.id, ref])).values()];
}

function empty(sessionCount: number): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    runCount: 0,
    sessionCount,
    loadedSessionCount: 0,
  };
}

function add(target: TokenUsage, record: SessionRecord): void {
  const usage = record.stats.usage;
  target.inputTokens += usage.inputTokens;
  target.outputTokens += usage.outputTokens;
  target.cacheReadTokens += usage.cacheReadTokens;
  target.cacheWriteTokens += usage.cacheWriteTokens;
  target.totalTokens += usage.totalTokens;
  target.runCount += record.stats.runCount;
  target.loadedSessionCount += 1;
  if (usage.costUsd !== null) target.costUsd = (target.costUsd ?? 0) + usage.costUsd;
}
