import { useMemo, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { Card } from "@rome-os/ui/card";
import { cn } from "@rome-os/ui/cn";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { bucketTask, latestText, safeText, taskStateLabel, taskTone, TONE_TEXT, type TaskBucket } from "../lib/facts";
import { formatRelative } from "../lib/format";
import type { TaskSummary } from "../lib/types";
import { formatCost, formatTokens, type TaskTokenUsage } from "../lib/task-usage";
import { useTaskUsage } from "../lib/use-task-usage";
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
    label: <span className="inline-flex items-center gap-1.5">{value}<span className="text-current/60">{counts[value]}</span></span>,
  }));
  const usage = useTaskUsage(tasks);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-0.5">
        <SegmentedControl options={options} value={filter} onValueChange={setFilter} size="sm" aria-label="Filter tasks" />
      </div>
      <Card className="overflow-hidden py-0">
        {visible.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="w-[120px]">Task</TableHead>
                <TableHead scope="col">Brief · latest</TableHead>
                <TableHead scope="col" className="w-[110px]">Project</TableHead>
                <TableHead scope="col" className="w-[120px]">State</TableHead>
                <TableHead scope="col" className="w-[105px] text-right">Tokens</TableHead>
                <TableHead scope="col" className="w-[80px] text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((task) => (
                // The row is the mouse target; the title inside it is the real
                // control, so the keyboard and a screen reader get a single
                // named link per row rather than a focusable <tr> that reads as
                // nothing. Clicks on the button bubble to the row handler, so
                // both paths run the same navigation.
                <TableRow
                  key={task.id}
                  className="relative cursor-pointer"
                  onClick={() => navigateToApp(`/${task.id}`)}
                >
                  <TableCell className="text-muted-foreground">
                    {freshIds.has(task.id) && <FreshEdge />}
                    {task.id}
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal">
                    <Button
                      variant="link"
                      size="xs"
                      align="start"
                      className="max-w-full truncate px-0 text-foreground"
                      onClick={() => navigateToApp(`/${task.id}`)}
                    >
                      {taskTitle(task)}
                    </Button>
                    <span className="block truncate text-aux text-muted-foreground">{latestText(task)}</span>
                  </TableCell>
                  <TableCell className="text-aux text-muted-foreground">{safeText(task.projectId ?? "—")}</TableCell>
                  <TableCell className={cn("text-aux", TONE_TEXT[taskTone(task)])}>{taskStateLabel(task)}</TableCell>
                  <TableCell className="text-right font-mono text-aux text-muted-foreground">
                    <TaskUsageCell task={task} usage={usage.byTask.get(task.id)} loading={usage.loading} unavailable={usage.unavailable} />
                  </TableCell>
                  <TableCell className="text-right text-aux text-muted-foreground">{formatRelative(task.updatedAt, nowMs)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState>
            <EmptyStateTitle>No tasks match this filter</EmptyStateTitle>
            <EmptyStateDescription>Choose another filter to see the rest of the tasks.</EmptyStateDescription>
          </EmptyState>
        )}
      </Card>
    </div>
  );
}

function TaskUsageCell({ task, usage, loading, unavailable }: {
  task: TaskSummary;
  usage?: TaskTokenUsage;
  loading: boolean;
  unavailable: boolean;
}) {
  if (loading && task.usageSessions.length) return <span title="Reading token usage">…</span>;
  if (unavailable && task.usageSessions.length) return <span title="Token usage is temporarily unavailable">—</span>;
  if (!usage) return <span>0</span>;
  const detail = [
    `${formatTokens(usage.inputTokens)} input`,
    `${formatTokens(usage.outputTokens)} output`,
    `${formatTokens(usage.cacheReadTokens)} cache read`,
    `${formatTokens(usage.cacheWriteTokens)} cache write`,
    `${formatCost(usage.costUsd)} cost`,
    "tracked sessions; historical coordinator wakes may be absent",
  ].join(" · ");
  return <span title={detail}>{formatTokens(usage.totalTokens, true)}</span>;
}
