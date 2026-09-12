import { useMemo, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { cn } from "@rome-os/ui/cn";
import { bucketTask, latestText, safeText, taskStateLabel, taskTone, TONE_TEXT, type TaskBucket } from "../lib/facts";
import { formatRelative } from "../lib/format";
import type { TaskSummary } from "../lib/types";
import { FreshEdge, taskTitle } from "./board";

type Filter = "All" | "Needs you" | "Running" | "Resting" | "Closed";
const FILTER_BUCKET: Partial<Record<Filter, TaskBucket>> = {
  "Needs you": "needs-you",
  Running: "running",
  Resting: "resting",
  Closed: "closed",
};

export function TaskList({ tasks, now, freshIds }: { tasks: TaskSummary[]; now: string; freshIds: Set<string> }) {
  const [filter, setFilter] = useState<Filter>("All");
  const nowMs = new Date(now).getTime();
  const counts = useMemo(() => ({
    All: tasks.length,
    "Needs you": tasks.filter((task) => bucketTask(task) === "needs-you").length,
    Running: tasks.filter((task) => bucketTask(task) === "running").length,
    Resting: tasks.filter((task) => bucketTask(task) === "resting").length,
    Closed: tasks.filter((task) => bucketTask(task) === "closed").length,
  }), [tasks]);
  const visible = tasks.filter((task) => filter === "All" || bucketTask(task) === FILTER_BUCKET[filter]);
  const options = (Object.keys(counts) as Filter[]).map((value) => ({
    value,
    label: <span className="inline-flex items-center gap-1.5">{value}<span className="font-mono text-[10.5px] text-current/60">{counts[value]}</span></span>,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-0.5">
        <SegmentedControl options={options} value={filter} onValueChange={setFilter} size="sm" aria-label="Filter tasks" className="border border-border bg-surface-muted p-0.5" />
      </div>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[104px_minmax(0,1fr)_96px_118px_66px] items-center gap-[18px] border-b border-border bg-surface-muted px-5 py-[11px] font-mono text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            <span>task</span><span>brief · latest</span><span>project</span><span>state</span><span className="text-right">age</span>
          </div>
          {visible.map((task) => (
            <button
              key={task.id}
              type="button"
              className="relative grid w-full grid-cols-[104px_minmax(0,1fr)_96px_118px_66px] items-center gap-[18px] border-b border-border-subtle px-5 py-4 text-left transition-[background-color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] outline-none last:border-b-0 hover:bg-surface-muted active:translate-y-px focus-visible:border-ring focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring"
              onClick={() => navigateToApp(`/${task.id}`)}
            >
              {freshIds.has(task.id) && <FreshEdge />}
              <span className="truncate font-mono text-[11.5px] text-muted-foreground">{task.id}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium">{taskTitle(task)}</span>
                <span className="truncate text-[13px] text-muted-foreground">{latestText(task)}</span>
              </span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{safeText(task.projectId ?? "—")}</span>
              <span className={cn("truncate font-mono text-[11px]", TONE_TEXT[taskTone(task)])}>{taskStateLabel(task)}</span>
              <span className="text-right font-mono text-[11px] text-subtle-foreground">{formatRelative(task.updatedAt, nowMs)}</span>
            </button>
          ))}
          {!visible.length && <p className="px-5 py-6 text-sm text-muted-foreground">No tasks match this filter.</p>}
        </div>
      </div>
    </div>
  );
}
