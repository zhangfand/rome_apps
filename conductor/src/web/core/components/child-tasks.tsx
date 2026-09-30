import { Fragment, useState } from "react";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent } from "@rome-os/ui/card";
import { Separator } from "@rome-os/ui/separator";
import { webDomain } from "../domain";
import { taskStateLabel, taskTone } from "../lib/facts";
import { formatDuration, formatRelative, truncate } from "../lib/format";
import {
  CHILD_GROUPS,
  childActivity,
  childrenOf,
  groupChildren,
  planItemLabel,
  rollup,
  rollupCounts,
  type ChildGroup,
} from "../lib/lineage";
import type { TaskSummary } from "../lib/types";
import { StateChip, TaskTitleLink } from "./board";
import { WorkerProgressInline } from "./worker-progress";

/**
 * The Tasks a parent started, grouped by where each stands — the way a
 * project lists its threads. Every row is a full Task; this only reads the
 * summaries the app already polls. Renders nothing for a Task with no children.
 */
export function ChildTasksSection({ parentId, tasks, now }: { parentId: string; tasks: readonly TaskSummary[]; now: number }) {
  const children = childrenOf(tasks, parentId);
  const [showDone, setShowDone] = useState(false);
  if (!children.length) return null;
  const groups = groupChildren(children);
  const summary = rollup(children);
  const visible = CHILD_GROUPS.filter(({ group }) => groups[group].length > 0 && (group !== "done" || showDone));

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="child-tasks-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="child-tasks-title" className="text-title">Tasks it started</h2>
        <span className="font-mono text-[11px] text-subtle-foreground">{rollupCounts(summary)}</span>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {visible.map(({ group, label }, groupIndex) => (
          <Fragment key={group}>
            {groupIndex > 0 && <Separator />}
            <GroupHeading label={label} />
            {groups[group].map((child) => (
              <Fragment key={child.id}>
                <Separator />
                <ChildTaskRow task={child} group={group} grandchildren={childrenOf(tasks, child.id).length} now={now} />
              </Fragment>
            ))}
          </Fragment>
        ))}
        {groups.done.length > 0 && (
          <>
            {visible.length > 0 && <Separator />}
            <CardContent className="py-2">
              <Button
                variant="link"
                size="xs"
                className="px-0 text-muted-foreground hover:text-foreground"
                aria-expanded={showDone}
                onClick={() => setShowDone((open) => !open)}
              >
                {showDone ? "Hide done" : `Show done (${groups.done.length})`}
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </section>
  );
}

function GroupHeading({ label }: { label: string }) {
  return (
    <CardContent className="bg-muted/40 py-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
    </CardContent>
  );
}

function ChildTaskRow({ task, group, grandchildren, now }: { task: TaskSummary; group: ChildGroup; grandchildren: number; now: number }) {
  const planItem = planItemLabel(task);
  const details = webDomain().childTaskRowDetails;
  return (
    <CardContent className="flex flex-col gap-1 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <StateChip label={taskStateLabel(task)} tone={taskTone(task)} />
        {planItem && <Badge variant="outline" className="font-mono" title="Plan item">{planItem}</Badge>}
        <TaskTitleLink task={task} className="flex-1" />
        {grandchildren > 0 && (
          <span className="text-aux text-muted-foreground">· {grandchildren} {grandchildren === 1 ? "task" : "tasks"}</span>
        )}
        <span className="ml-auto whitespace-nowrap text-aux text-muted-foreground">{rowTime(task, now)}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        {group === "running" && <WorkerProgressInline sessionId={task.liveWorker?.romeSession?.id} />}
        <span className="min-w-0 max-w-[78ch] truncate text-aux text-muted-foreground" title={childActivity(task)}>
          {truncate(childActivity(task), 200)}
        </span>
      </div>
      {details.map((Detail, index) => <Detail key={index} taskId={task.id} task={task} />)}
    </CardContent>
  );
}

function rowTime(task: TaskSummary, now: number): string {
  if (task.liveWorker) return `running ${formatDuration(now - new Date(task.liveWorker.since).getTime())}`;
  if (task.pendingJob) return `queued ${formatDuration(now - new Date(task.pendingJob.since).getTime())}`;
  return formatRelative(task.updatedAt, now);
}
