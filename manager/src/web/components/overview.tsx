import { useId, useState, type ReactNode } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { chatAbout } from "./attention";
import { PullRequestCard } from "./pull-request";
import { LightMarkdown } from "./light-markdown";
import { TaskRows } from "./task-list";
import { overviewGroups, taskTitle } from "../lib/overview";
import { handleOf, humanize, refsIn, type Ref, type WorkerNames } from "../lib/domain";
import { formatStamp } from "../lib/format";
import type { TaskSummary } from "../lib/types";

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const id = useId();
  return <section aria-labelledby={id} className="flex flex-col gap-3">
    <h2 id={id} className="flex items-baseline gap-2 text-section">{title}<span className="text-aux font-normal text-muted-foreground tabular-nums">{count}</span></h2>
    {children}
  </section>;
}

export function Overview({ tasks, showProject, names }: { tasks: TaskSummary[]; showProject: boolean; names: WorkerNames }) {
  const groups = overviewGroups(tasks);
  const count = Object.values(groups).reduce((n, g) => n + g.length, 0);
  return <div className="flex flex-col gap-6" aria-label="Task overview">
    {groups.decisions.length ? <Section title="Decisions" count={groups.decisions.length}>
      {groups.decisions.map((task) => <article key={task.id} data-task-id={task.id} className="rounded-12 border border-warning-border bg-surface p-4">
        <div className="flex items-baseline gap-3">
          <button type="button" className="text-left text-ui font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => navigateToApp(task.id)}>{taskTitle(task)}</button>
          {showProject && task.projectId ? <span className="text-aux text-muted-foreground">{task.projectId}</span> : null}
        </div>
        <LightMarkdown className="mt-2 text-ui" markdown={task.attention!.text} />
        <Button size="sm" className="mt-3" onClick={() => void chatAbout(task.id, handleOf(task), "Question")}><MessageSquare className="size-3.5" aria-hidden />Answer in chat</Button>
      </article>)}
    </Section> : null}
    {groups.prs.length ? <Section title="Pull requests" count={groups.prs.reduce((n, task) => n + refsIn(task.attention!.text).filter((r) => r.kind === "pr").length, 0)}>
      {groups.prs.map((task) => <div key={task.id} data-task-id={task.id} className="flex flex-col gap-3">
        {refsIn(task.attention!.text).filter((r) => r.kind === "pr").map((pr) => <OverviewPr key={pr.url} task={task} pr={pr} names={names} showProject={showProject} />)}
      </div>)}
    </Section> : null}
    {groups.progress.length ? <Section title="In progress" count={groups.progress.length}>
      <TaskRows tasks={groups.progress} showProject={showProject} />
    </Section> : null}
    {groups.results.length ? <details className="group/results" key="other-results">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-4 text-section focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open/results:rotate-180 motion-reduce:transition-none" aria-hidden />Other results<span className="text-aux font-normal text-muted-foreground tabular-nums">{groups.results.length}</span>
      </summary>
      <div className="mt-3"><TaskRows tasks={groups.results} showProject={showProject} showResult /></div>
    </details> : null}
    {!count ? <p className="py-6 text-ui text-muted-foreground">No open tasks{showProject ? "" : " in this project"}. Completed work is in History.</p> : null}
  </div>;
}

function OverviewPr({ task, pr, names, showProject }: { task: TaskSummary; pr: Ref; names: WorkerNames; showProject: boolean }) {
  const [full, setFull] = useState(false);
  const id = useId();
  const detailsButton = <button type="button" onClick={() => setFull(!full)} aria-expanded={full} aria-controls={id}
    className="ml-auto inline-flex items-center gap-1 rounded-4 px-1 py-1 text-aux text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    {full ? <ChevronUp className="size-3" aria-hidden /> : <ChevronDown className="size-3" aria-hidden />}Details
  </button>;
  return <PullRequestCard taskId={task.id} pr={pr} compact actions={detailsButton}
    context={showProject ? task.projectId : undefined}
    details={<div id={id} hidden={!full}>
      {full ? <div className="mt-3 border-t border-border pt-3">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <button type="button" className="text-left text-ui font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring" onClick={() => navigateToApp(task.id)}>{taskTitle(task)}</button>
          <span className="text-aux text-muted-foreground">Report from {formatStamp(task.updatedAt)}</span>
        </div>
        <LightMarkdown className="text-ui" markdown={task.attention!.text} />
        {task.attention?.evidence ? <p className="mt-2 text-aux text-muted-foreground">Evidence: {humanize(task.attention.evidence, names)}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" size="xs" onClick={() => navigateToApp(task.id)}>Open task</Button>
          <Button variant="ghost" size="xs" onClick={() => void chatAbout(task.id, handleOf(task), "Report")}>Discuss task</Button>
        </div>
      </div> : null}
    </div>} />;
}
