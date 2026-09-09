import { useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { StateDot } from "./badges";
import { isOpen, resultPreview, taskStatus, taskTitle } from "../lib/overview";
import type { TaskSummary } from "../lib/types";
export { isOpen } from "../lib/overview";

/** Compact task links, not an execution transcript or a second PR dashboard. */
export function TaskRows({ tasks, showProject = true, showResult = false }: {
  tasks: TaskSummary[]; showProject?: boolean; showResult?: boolean;
}) {
  return <ul className="divide-y divide-border rounded-12 border border-border bg-surface">
    {tasks.map((task) => <li key={task.id} data-task-id={task.id}>
      <button type="button" onClick={() => navigateToApp(task.id)}
        className="task-row flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="mt-1.5 shrink-0"><StateDot state={task.state} position={task.position} /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 text-ui font-medium break-words">{taskTitle(task)}</span>
            {showProject && task.projectId ? <span className="text-aux text-muted-foreground">{task.projectId}</span> : null}
            {!showResult ? <span className="text-aux text-muted-foreground">{taskStatus(task)}</span> : null}
          </span>
          {showResult && task.attention ? <span className="line-clamp-2 text-aux text-muted-foreground break-words">{resultPreview(task.attention.text) || "Open result"}</span> : null}
        </span>
      </button>
    </li>)}
  </ul>;
}

export function TaskList({ tasks, showProject = true, history = false }: {
  tasks: TaskSummary[]; showProject?: boolean; history?: boolean;
}) {
  const [scope, setScope] = useState<"open" | "all">("all");
  const visible = [...tasks].filter((t) => history ? !isOpen(t) : scope === "all" || isOpen(t))
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || b.updatedAt.localeCompare(a.updatedAt));
  return <section className="flex flex-col gap-3" aria-label={history ? "Task history" : "All tasks"}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-section">{history ? "History" : "All tasks"}</h2>
      {!history ? <SegmentedControl aria-label="Task scope" size="sm" value={scope} onValueChange={setScope}
        options={[{ value: "all", label: "All" }, { value: "open", label: "Open" }]} /> : null}
    </div>
    {visible.length ? <TaskRows tasks={visible} showProject={showProject} /> : <p className="py-6 text-ui text-muted-foreground">{history ? "No completed or cancelled tasks yet." : "No tasks in this view."}</p>}
  </section>;
}
