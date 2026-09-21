import { useEffect, useState } from "react";
import type { TaskDetailJson } from "./types.js";
import { fetchTaskUsageAnalysis, type TaskUsageAnalysis } from "./task-usage-analysis.js";

export function useTaskUsageAnalysis(task: TaskDetailJson | null, enabled = true): {
  analysis: TaskUsageAnalysis | null;
  loading: boolean;
  unavailable: boolean;
} {
  const key = task ? `${task.id}\n${task.usageSessions.map((session) => session.id).sort().join("\n")}` : "";
  const [analysis, setAnalysis] = useState<TaskUsageAnalysis | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled && task?.usageSessions.length));
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setLoading(false);
      setUnavailable(false);
      return () => { active = false; };
    }
    if (!task || !task.usageSessions.length) {
      setAnalysis(null);
      setLoading(false);
      setUnavailable(false);
      return () => { active = false; };
    }
    setLoading(true);
    void fetchTaskUsageAnalysis(task).then((next) => {
      if (!active) return;
      setAnalysis(next);
      setUnavailable(false);
    }).catch(() => {
      if (active) setUnavailable(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
    // The exact linked session set defines this read. Task facts alone do not
    // change persisted session accounting after a run has ended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  return { analysis, loading, unavailable };
}
