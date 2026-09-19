import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { formatCost, formatTokens, type TaskTokenUsage } from "../lib/task-usage.js";

export function TaskUsageSummary({ usage, loading, unavailable }: {
  usage?: TaskTokenUsage;
  loading: boolean;
  unavailable: boolean;
}) {
  const noSessions = !usage || usage.sessionCount === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token usage</CardTitle>
        <span className="text-aux text-muted-foreground">
          {loading ? "reading session accounting…" : unavailable ? "accounting is temporarily unavailable" : noSessions ? "no agent sessions yet" : `${usage.loadedSessionCount} tracked session${usage.loadedSessionCount === 1 ? "" : "s"}`}
        </span>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Tracked total" value={noSessions ? "0" : formatTokens(usage.totalTokens)} strong />
        <Metric label="Input" value={noSessions ? "0" : formatTokens(usage.inputTokens)} />
        <Metric label="Output" value={noSessions ? "0" : formatTokens(usage.outputTokens)} />
        <Metric label="Cache read" value={noSessions ? "0" : formatTokens(usage.cacheReadTokens)} />
        <Metric label="Cache write" value={noSessions ? "0" : formatTokens(usage.cacheWriteTokens)} />
        <Metric label="Cost" value={noSessions ? "$0.00" : formatCost(usage.costUsd)} />
      </CardContent>
      {!noSessions && (
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-4 text-aux text-muted-foreground">
          <span>Coordinator <strong className="font-medium text-foreground">{formatTokens(usage.coordinator.totalTokens)}</strong></span>
          <span>Workers <strong className="font-medium text-foreground">{formatTokens(usage.workers.totalTokens)}</strong></span>
          <span>{usage.runCount} model run{usage.runCount === 1 ? "" : "s"}</span>
          {usage.loadedSessionCount < usage.sessionCount && <span>{usage.sessionCount - usage.loadedSessionCount} session{usage.sessionCount - usage.loadedSessionCount === 1 ? "" : "s"} not found</span>}
          <span className="basis-full">Historical Tasks include their linked worker sessions; coordinator sessions are linked from this version onward.</span>
        </CardContent>
      )}
    </Card>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-aux text-muted-foreground">{label}</div>
      <div className={strong ? "mt-0.5 font-mono text-[18px] font-semibold text-foreground" : "mt-0.5 font-mono text-[14px] text-foreground"}>{value}</div>
    </div>
  );
}
