import { navigateToApp } from "@rome-os/app-web-sdk";
import { cn } from "@rome-os/ui/cn";
import { formatRelative, truncate } from "../lib/format";
import { factBody, KIND_TONE } from "../lib/facts";
import type { TaskSummary } from "../lib/types";

export function TaskList({ tasks, now, empty }: { tasks: TaskSummary[]; now: string; empty: string }) {
  const nowMs = new Date(now).getTime();
  if (!tasks.length) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {tasks.map((task) => {
        const decision = task.lastDecision ? factBody(task.lastDecision) : undefined;
        return (
          <li key={task.id} className="flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-muted/50" onClick={() => navigateToApp(`/${task.id}`)}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
              <span className="font-medium">{truncate(task.brief.split("\n")[0], 100)}</span>
              {task.projectId && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{task.projectId}</span>}
              {task.liveWorker && <span className="rounded bg-sky-500/15 px-1.5 text-xs text-sky-700 dark:text-sky-300">worker running · {task.liveWorker.agent}</span>}
              {task.needsAttention && task.state === "open" && <span className="rounded bg-orange-500/15 px-1.5 text-xs text-orange-700 dark:text-orange-300">orchestrator pending</span>}
              <span className="ml-auto text-xs text-muted-foreground">{formatRelative(task.updatedAt, nowMs)}</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className={cn("shrink-0 rounded px-1.5 text-xs", KIND_TONE[task.latest.kind] ?? "bg-muted")}>{task.latest.kind}</span>
              <span>{decision && task.lastDecision === task.latest ? truncate(decision.body ?? decision.title, 160) : truncate(factBody(task.latest).body ?? factBody(task.latest).title, 160)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
