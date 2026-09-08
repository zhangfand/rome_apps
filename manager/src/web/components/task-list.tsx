import { useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { cn } from "@rome-os/ui/cn";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { StateDot, stateLabel } from "./badges";
import { TaskName } from "./refs";
import { type TaskHandle, type WorkerNames, briefText, plain, workerLabel } from "../lib/domain";
import { formatRelative, truncate, useNow } from "../lib/format";
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

export function TaskList({
  tasks,
  handles,
  names,
}: {
  tasks: TaskSummary[];
  handles: ReadonlyMap<string, TaskHandle>;
  names: WorkerNames;
}) {
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
        <span className="text-aux text-muted-foreground tabular-nums">
          {visible.length} of {tasks.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState className="py-10">
          <EmptyStateTitle>{tasks.length === 0 ? "No tasks yet" : "Nothing here"}</EmptyStateTitle>
          <EmptyStateDescription>
            {tasks.length === 0
              ? "Tell the manager agent what you want in chat and it will open one."
              : "Nothing matches this scope. Try “All”."}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border rounded-12 border border-border bg-surface">
          {visible.map((task) => (
            <li key={task.id}>
              <TaskRow task={task} handle={handles.get(task.id)} names={names} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task,
  handle,
  names,
  now,
}: {
  task: TaskSummary;
  handle?: TaskHandle;
  names: WorkerNames;
  now: number;
}) {
  const closed = !isOpen(task);
  const attention = task.attention;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigateToApp(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateToApp(task.id);
        }
      }}
      className={cn(
        "task-row grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)] gap-x-3 px-4 py-3 transition-colors first:rounded-t-12 last:rounded-b-12 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        closed && "opacity-70",
      )}
    >
      <div className="flex justify-center pt-[7px]">
        <StateDot state={task.state} position={task.position} />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {handle ? <TaskName handle={handle} rawId={task.id} /> : <span className="font-mono">{task.id}</span>}
          <span className="text-aux text-muted-foreground">{stateLabel(task.state, task.position)}</span>
          <span className="ml-auto text-aux text-muted-foreground tabular-nums" title={task.updatedAt}>
            {task.latest.kind} · {formatRelative(task.updatedAt, now)}
          </span>
        </div>

        {handle?.isRef || !handle ? (
          <p className="font-serif text-body leading-snug text-foreground line-clamp-2">
            {truncate(handle ? briefText(task.brief, handle) : task.brief, 260)}
          </p>
        ) : null}

        {attention ? (
          <p
            className={cn(
              "border-l-2 pl-3 text-ui line-clamp-2",
              attention.kind === "Question" ? "border-warning" : "border-info",
            )}
          >
            <span className="font-medium">{attention.kind === "Question" ? "Asks" : "Reports"}</span>{" "}
            <span className="text-foreground/85">{truncate(plain(attention.text), 320)}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 text-aux text-muted-foreground">
          {task.liveWorkerId ? (
            <span className="text-foreground/80">{workerLabel(names, task.liveWorkerId)} running</span>
          ) : null}
          <span>
            {task.workers.length} {task.workers.length === 1 ? "worker" : "workers"}
          </span>
          <span>{task.factCount} facts</span>
          {task.startsSinceLastPersonFact > 0 && isOpen(task) ? (
            <span>
              {task.startsSinceLastPersonFact} {task.startsSinceLastPersonFact === 1 ? "start" : "starts"} since your last
              word
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
