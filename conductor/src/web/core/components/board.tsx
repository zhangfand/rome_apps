import { Fragment, useState } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@rome-os/ui/card";
import { cn } from "@rome-os/ui/cn";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Separator } from "@rome-os/ui/separator";
import { Spinner } from "@rome-os/ui/spinner";
import { Textarea } from "@rome-os/ui/textarea";
import {
  attentionText,
  bucketTask,
  factBody,
  hasOutstandingPersonDecision,
  isSafetyEvent,
  safeText,
  taskStateLabel,
  taskTone,
  TONE_BADGE,
} from "../lib/facts";
import { formatDuration, formatRelative, truncate } from "../lib/format";
import { LightMarkdown } from "./light-markdown";
import { WorkerLink } from "./worker-link";
import type { StateJson, TaskDetailJson, TaskSummary } from "../lib/types";

const QUICK_REPLIES = {
  question: ["yes", "no", "I need more context"],
  report: ["accepted, thanks", "please revise", "hold for now"],
  paused: ["try again", "change course", "cancel this"],
} as const;

export function Board({
  state,
  now,
  freshIds,
  reload,
  updateTask,
}: {
  state: StateJson;
  now: number;
  freshIds: Set<string>;
  reload: () => Promise<void>;
  updateTask: (task: TaskSummary) => void;
}) {
  const needsYou = state.tasks.filter((task) => bucketTask(task) === "needs-you");
  const running = state.tasks.filter((task) => bucketTask(task) === "running");
  const activeWorkers = running.filter((task) => task.liveWorker).length;
  const queuedJobs = running.filter((task) => task.pendingJob && !task.liveWorker).length;
  const resting = state.tasks.filter((task) => bucketTask(task) === "resting");
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sendReply = async (task: TaskSummary) => {
    const text = drafts[task.id]?.trim();
    if (!text) return;
    setBusy(task.id, true);
    setErrors((current) => ({ ...current, [task.id]: "" }));
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(task.id)}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          ...(hasOutstandingPersonDecision(task) && !isSafetyEvent(task.latest) && task.lastDecision?.kind === "Asked"
            ? { resolvesAskedSeq: task.lastDecision.seq }
            : {}),
        }),
      });
      if (!response.ok) {
        const message = await responseError(response);
        setErrors((current) => ({ ...current, [task.id]: message }));
        return;
      }
      setDrafts((current) => ({ ...current, [task.id]: "" }));
      setReplyOpen((current) => ({ ...current, [task.id]: false }));
      await reload();
    } finally {
      setBusy(task.id, false);
    }
  };

  const closeTask = async (task: TaskSummary, action: "complete" | "cancel") => {
    setBusy(task.id, true);
    setErrors((current) => ({ ...current, [task.id]: "" }));
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(task.id)}/${action}`, { method: "POST" });
      if (!response.ok) {
        const message = await responseError(response);
        setErrors((current) => ({ ...current, [task.id]: message }));
        return;
      }
      updateTask(await response.json() as TaskDetailJson);
    } finally {
      setBusy(task.id, false);
    }
  };

  const setBusy = (id: string, busy: boolean) => setSending((current) => {
    const next = new Set(current);
    if (busy) next.add(id); else next.delete(id);
    return next;
  });

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-[18px]" aria-labelledby="needs-you-heading">
        <SectionHeading id="needs-you-heading">Needs you</SectionHeading>
        {needsYou.map((task) => {
          const label = taskStateLabel(task);
          const tone = taskTone(task);
          const text = attentionText(task);
          const open = Boolean(replyOpen[task.id]);
          const isLong = text.length > 320;
          const isExpanded = expanded.has(task.id);
          const busy = sending.has(task.id);
          const question = label === "question";
          const replies = QUICK_REPLIES[label === "paused" ? "paused" : question ? "question" : "report"];
          return (
            <article key={task.id}>
             <Card
              className={cn(
                // The tone rail is the one paint the card keeps: it is what
                // makes a question scannable against a report in a column of
                // otherwise identical cards.
                "relative border-l-[3px]",
                tone === "question" ? "border-l-warning" : tone === "destructive" ? "border-l-destructive" : "border-l-primary",
              )}
             >
                {freshIds.has(task.id) && <FreshEdge />}
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2.5">
                    <StateChip label={label} tone={tone} />
                    {taskTitle(task)}
                    {/* The project is a tag on the task, not a description
                        of it: it names where the task runs, so it reads as a
                        chip beside the title rather than as prose under it. */}
                    {task.projectId && <Badge variant="outline">{safeText(task.projectId)}</Badge>}
                  </CardTitle>
                  <CardAction>
                    <time className="text-aux text-muted-foreground" dateTime={task.updatedAt}>{formatRelative(task.updatedAt, now)}</time>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {task.interventionNotice?.boardFallback && (
                    <Alert variant="warning">
                      <AlertDescription>Discord delivery was unavailable or could not be confirmed. Answer here on the Board.</AlertDescription>
                    </Alert>
                  )}
                  <LightMarkdown
                    markdown={text}
                    compact
                    className={cn("max-w-[78ch] text-ui text-pretty", isLong && !isExpanded && "clamp-four")}
                  />
                  {isLong && (
                    <Button
                      variant="link"
                      size="xs"
                      className="w-fit px-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpanded((current) => toggleSet(current, task.id))}
                    >
                      {isExpanded ? "show less" : "show all"}
                    </Button>
                  )}
                </CardContent>
                <CardFooter className="flex-wrap">
                  <Button onClick={() => setReplyOpen((current) => ({ ...current, [task.id]: !open }))}>
                    {open ? "Close reply" : question ? "Answer" : "Reply"}
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void closeTask(task, question || label === "paused" ? "cancel" : "complete")}>
                    {question || label === "paused" ? "Cancel task" : "Mark complete"}
                  </Button>
                  <Button variant="ghost" onClick={() => navigateToApp(`/${task.id}`)}>Details</Button>
                </CardFooter>
                {open && (
                  <CardFooter className="flex-col items-stretch gap-3 border-t">
                    <div className="flex flex-wrap gap-2">
                      {replies.map((reply) => (
                        <Button key={reply} variant="outline" size="sm" onClick={() => setDrafts((current) => ({ ...current, [task.id]: reply }))}>
                          {reply}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      className="min-h-24"
                      aria-label={`Reply to ${taskTitle(task)}`}
                      value={drafts[task.id] ?? ""}
                      onChange={(event) => setDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                    />
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Button disabled={busy || !drafts[task.id]?.trim()} onClick={() => void sendReply(task)}>
                        {busy && <Spinner />}
                        {busy ? "Sending…" : "Send reply"}
                      </Button>
                    </div>
                    {errors[task.id] && <ReplyError message={errors[task.id]} />}
                  </CardFooter>
                )}
                {!open && errors[task.id] && (
                  <CardContent><ReplyError message={errors[task.id]} /></CardContent>
                )}
             </Card>
            </article>
          );
        })}
        {!needsYou.length && (
          <Card className="py-0">
            <EmptyState>
              <EmptyStateTitle>Nothing is waiting on you</EmptyStateTitle>
              <EmptyStateDescription>Questions and reports that need an answer show up here.</EmptyStateDescription>
            </EmptyState>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-[18px]" aria-labelledby="running-heading">
        <div className="flex items-baseline gap-2.5">
          <SectionHeading id="running-heading">Running</SectionHeading>
          {state.maxWorkers > 0 && (
            <span className="font-mono text-[11px] text-subtle-foreground">
              {activeWorkers} of {state.maxWorkers} workers{queuedJobs ? ` · ${queuedJobs} queued` : ""}
            </span>
          )}
        </div>
        <Card className="gap-0 py-0">
          {!running.length ? (
            <EmptyState>
              <EmptyStateTitle>No worker is running</EmptyStateTitle>
              <EmptyStateDescription>A task appears here while someone is carrying it out.</EmptyStateDescription>
            </EmptyState>
          ) : running.map((task, rowIndex) => {
            const current = task.lastDecision ? factBody(task.lastDecision) : undefined;
            const phase = current ? current.body || current.title : "Working on your request";
            return (
              <Fragment key={task.id}>
                {rowIndex > 0 && <Separator />}
                <CardContent className="relative flex flex-wrap items-center gap-2.5 py-4">
                  {freshIds.has(task.id) && <FreshEdge />}
                  <Button variant="link" size="xs" className="px-0 text-foreground" onClick={() => navigateToApp(`/${task.id}`)}>{taskTitle(task)}</Button>
                  {task.liveWorker?.romeSession && (
                    <WorkerLink
                      workerId={task.liveWorker.workerId}
                      session={task.liveWorker.romeSession}
                      label="worker session"
                      icon
                      className="text-aux text-muted-foreground"
                    />
                  )}
                  <span className="max-w-[52ch] truncate text-aux text-muted-foreground">{truncate(phase, 140)}</span>
                  <span className="ml-auto text-aux">
                    {task.liveWorker
                      ? formatDuration(now - new Date(task.liveWorker.since).getTime())
                      : `queued ${formatDuration(now - new Date(task.pendingJob!.since).getTime())}`}
                  </span>
                </CardContent>
              </Fragment>
            );
          })}
        </Card>
      </section>

      <section className="flex flex-col gap-[18px]" aria-labelledby="resting-heading">
        <SectionHeading id="resting-heading">Resting</SectionHeading>
        <Card className="gap-0 py-0">
          {!resting.length ? (
            <EmptyState>
              <EmptyStateTitle>Nothing is on a timer</EmptyStateTitle>
              <EmptyStateDescription>Tasks waiting on a date or an outside event rest here.</EmptyStateDescription>
            </EmptyState>
          ) : resting.map((task, rowIndex) => (
            <Fragment key={task.id}>
              {rowIndex > 0 && <Separator />}
              <CardContent className="relative flex flex-wrap items-center gap-2.5 py-4">
                {freshIds.has(task.id) && <FreshEdge />}
                <Button variant="link" size="xs" className="px-0 text-foreground" onClick={() => navigateToApp(`/${task.id}`)}>{taskTitle(task)}</Button>
                <span className="max-w-[56ch] truncate text-aux text-muted-foreground">{safeText(task.waiting?.reason ?? latestRestingText(task))}</span>
                <span className="ml-auto text-aux text-muted-foreground">{restingWhen(task, now)}</span>
              </CardContent>
            </Fragment>
          ))}
        </Card>
      </section>
    </div>
  );
}

export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-title">{children}</h2>;
}

export function StateChip({ label, tone }: { label: string; tone: ReturnType<typeof taskTone> }) {
  return <Badge variant={TONE_BADGE[tone]}>{label}</Badge>;
}

function ReplyError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{safeText(message)}</AlertDescription>
    </Alert>
  );
}

export function FreshEdge() {
  return <span aria-hidden="true" className="afterglow-edge absolute inset-y-0 left-0 w-0.5 bg-ring" />;
}

export function taskTitle(task: TaskSummary): string {
  return safeText(task.brief.split("\n")[0].trim() || "Untitled task");
}

function latestRestingText(task: TaskSummary): string {
  const latest = factBody(task.latest);
  return latest.body || latest.title || "Ready when something changes.";
}

function restingWhen(task: TaskSummary, now: number): string {
  if (task.needsAttention) return "picking up now";
  if (!task.waiting) return "ready when something changes";
  const remaining = new Date(task.waiting.resumeAfter).getTime() - now;
  return remaining <= 0 ? "ready to continue" : `continues in ${compactDuration(remaining)}`;
}

function compactDuration(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

function toggleSet(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error ?? `The request did not finish (HTTP ${response.status}). Try again.`;
}
