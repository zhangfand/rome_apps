import { useEffect, useMemo, useState } from "react";
import type { TaskSummary } from "./types.js";
import { aggregateTaskUsage, fetchSessionUsage, usageSessionIds, type TaskTokenUsage } from "./task-usage.js";

const REFRESH_MS = 10_000;

export function useTaskUsage(tasks: readonly TaskSummary[]): {
  byTask: ReadonlyMap<string, TaskTokenUsage>;
  loading: boolean;
  unavailable: boolean;
} {
  const ids = usageSessionIds(tasks);
  const key = ids.join("\n");
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof fetchSessionUsage>>>(() => new Map());
  const [loading, setLoading] = useState(ids.length > 0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ids.length) {
        if (active) {
          setSessions(new Map());
          setLoading(false);
          setUnavailable(false);
        }
        return;
      }
      try {
        const next = await fetchSessionUsage(ids);
        if (active) {
          setSessions(next);
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(ids.length > 0);
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
    // `key` is a stable value for the exact set of relevant session ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const byTask = useMemo(() => new Map(tasks.map((task) => [task.id, aggregateTaskUsage(task, sessions)])), [tasks, sessions]);
  return { byTask, loading, unavailable };
}
