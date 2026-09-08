import { useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Card, CardContent } from "@rome-os/ui/card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { ChevronRight, Cpu, MessageCircleQuestion, FileCheck } from "lucide-react";
import { PositionBadge, TaskStateBadge } from "./badges";
import { formatRelative, shortId, truncate, useNow } from "../lib/format";
import type { TaskSummary } from "../lib/types";

type Scope = "open" | "attention" | "all";

const SCOPES: { value: Scope; label: string; title: string }[] = [
  { value: "open", label: "Open", title: "Created or Taken" },
  { value: "attention", label: "Needs you", title: "Stuck on a question or holding a report" },
  { value: "all", label: "All", title: "Including completed and cancelled" },
];

export function isOpen(task: TaskSummary): boolean {
  return task.state === "created" || task.state === "taken";
}

export function TaskList({ tasks }: { tasks: TaskSummary[] }) {
  const [scope, setScope] = useState<Scope>("open");
  const now = useNow();

  const visible = tasks
    .filter((task) => {
      if (scope === "all") return true;
      if (scope === "attention") return task.attention !== undefined;
      return isOpen(task);
    })
    .sort((a, b) => {
      // Attention first, then open before closed, then newest activity.
      const att = Number(b.attention !== undefined) - Number(a.attention !== undefined);
      if (att !== 0) return att;
      const open = Number(isOpen(b)) - Number(isOpen(a));
      if (open !== 0) return open;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Task scope"
          size="sm"
          value={scope}
          onValueChange={setScope}
          options={SCOPES}
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {visible.length} of {tasks.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState className="py-10">
          <EmptyStateTitle>No tasks here</EmptyStateTitle>
          <EmptyStateDescription>
            {tasks.length === 0
              ? "Tell the manager agent what you want in chat and it will open one."
              : "Nothing matches this scope."}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, now }: { task: TaskSummary; now: number }) {
  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => navigateToApp(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateToApp(task.id);
        }
      }}
      className="cursor-pointer py-3 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TaskStateBadge state={task.state} />
              {task.position ? <PositionBadge position={task.position} /> : null}
              <span className="font-mono text-[11px] text-muted-foreground">{shortId(task.id)}</span>
            </div>
            <p className="text-sm leading-snug text-foreground">{truncate(task.brief, 220)}</p>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        {task.attention ? (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            {task.attention.kind === "Question" ? (
              <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <FileCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <div className="min-w-0">
              <span className="font-medium">{task.attention.kind === "Question" ? "Asks: " : "Reports: "}</span>
              <span className="text-foreground/90">{truncate(task.attention.text, 240)}</span>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {task.liveWorkerId ? (
            <span className="inline-flex items-center gap-1">
              <Cpu className="size-3.5" aria-hidden />
              worker <span className="font-mono">{shortId(task.liveWorkerId)}</span>
            </span>
          ) : null}
          <span>
            {task.workers.length} {task.workers.length === 1 ? "worker" : "workers"}
          </span>
          <span>{task.factCount} facts</span>
          <span>
            starts since last reply: <span className="tabular-nums">{task.startsSinceLastPersonFact}</span>
          </span>
          <span className="ml-auto">
            {task.latest.kind} {formatRelative(task.updatedAt, now)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
