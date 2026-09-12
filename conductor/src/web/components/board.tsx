import { useState } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { Textarea } from "@rome-os/ui/textarea";
import { ActionButton } from "./ui-bits";
import {
  attentionText,
  bucketTask,
  factBody,
  isSafetyEvent,
  safeText,
  taskStateLabel,
  taskTone,
  TONE_CLASS,
} from "../lib/facts";
import { formatDuration, formatRelative, truncate } from "../lib/format";
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
        body: JSON.stringify({ text }),
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
            <article
              key={task.id}
              className={cn(
                "relative flex flex-col gap-[18px] rounded-[14px] border border-l-[3px] bg-surface px-[26px] py-6 shadow-1",
                tone === "question" ? "border-l-warning" : tone === "destructive" ? "border-l-destructive" : "border-l-primary",
              )}
            >
              {freshIds.has(task.id) && <FreshEdge />}
              <div className="flex flex-wrap items-center gap-[11px]">
                <StateChip label={label} tone={tone} large />
                <h3 className="text-lg leading-[normal] font-semibold tracking-[-0.015em]">{taskTitle(task)}</h3>
                {task.projectId && <span className="font-mono text-xs text-subtle-foreground">{safeText(task.projectId)}</span>}
                <span className="ml-auto font-mono text-xs text-muted-foreground">{formatRelative(task.updatedAt, now)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <p className={cn("max-w-[78ch] text-[15px] leading-[1.6] text-pretty", isLong && !isExpanded && "clamp-four")}>{text}</p>
                {isLong && (
                  <button
                    type="button"
                    className="w-fit border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground underline transition-[color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] outline-none hover:text-foreground active:translate-y-px focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring"
                    onClick={() => setExpanded((current) => toggleSet(current, task.id))}
                  >
                    {isExpanded ? "show less" : "show all"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton className="hover:bg-primary-hover" onClick={() => setReplyOpen((current) => ({ ...current, [task.id]: !open }))}>
                  {open ? "Close reply" : question ? "Answer" : "Reply"}
                </ActionButton>
                <ActionButton variant="outline" className="border-border-strong bg-surface hover:bg-surface-hover" disabled={busy} onClick={() => void closeTask(task, question || label === "paused" ? "cancel" : "complete")}>
                  {question || label === "paused" ? "Cancel task" : "Mark complete"}
                </ActionButton>
                <ActionButton variant="ghost" className="text-muted-foreground hover:bg-surface-hover" onClick={() => navigateToApp(`/${task.id}`)}>Details</ActionButton>
              </div>
              {open && (
                <div className="flex flex-col gap-3 border-t border-border pt-[18px]">
                  <div className="flex flex-wrap gap-2">
                    {replies.map((reply) => (
                      <Button key={reply} variant="outline" size="sm" className="h-[26px] rounded-sm border-border bg-surface-muted px-[11px] font-mono text-xs font-normal text-muted-foreground hover:bg-surface-hover" onClick={() => setDrafts((current) => ({ ...current, [task.id]: reply }))}>
                        {reply}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    className="min-h-24 rounded-8 bg-background px-3.5 py-3 text-sm leading-[1.55]"
                    aria-label={`Reply to ${taskTitle(task)}`}
                    value={drafts[task.id] ?? ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ActionButton className="hover:bg-primary-hover" disabled={busy || !drafts[task.id]?.trim()} onClick={() => void sendReply(task)}>{busy ? "Sending…" : "Send reply"}</ActionButton>
                    {errors[task.id] && <span role="alert" className="text-xs text-destructive-fg">{safeText(errors[task.id])}</span>}
                  </div>
                </div>
              )}
              {!open && errors[task.id] && <span role="alert" className="text-xs text-destructive-fg">{safeText(errors[task.id])}</span>}
            </article>
          );
        })}
        {!needsYou.length && <p className="text-[15px] leading-[1.6] text-muted-foreground">Quiet. Nothing is waiting on you.</p>}
      </section>

      <section className="flex flex-col gap-[18px]" aria-labelledby="running-heading">
        <div className="flex items-baseline gap-2.5">
          <SectionHeading id="running-heading">Running</SectionHeading>
          {state.maxWorkers > 0 && <span className="font-mono text-[11px] text-subtle-foreground">{running.length} of {state.maxWorkers} at once</span>}
        </div>
        <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
          {!running.length && <p className="px-[22px] py-5 text-sm text-muted-foreground">No worker is running.</p>}
          {running.map((task) => {
            const current = task.lastDecision ? factBody(task.lastDecision) : undefined;
            const phase = current ? current.body || current.title : "Working on your request";
            return (
              <div key={task.id} className="relative flex flex-wrap items-center gap-2.5 border-t border-border-subtle px-[22px] py-5 first:border-t-0">
                {freshIds.has(task.id) && <FreshEdge />}
                <button type="button" className="text-[15.5px] font-medium decoration-transparent outline-none transition-[color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] hover:underline hover:decoration-current active:translate-y-px focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring" onClick={() => navigateToApp(`/${task.id}`)}>{taskTitle(task)}</button>
                <span className="max-w-[52ch] truncate font-mono text-[11px] text-subtle-foreground">{truncate(phase, 140)}</span>
                <span className="ml-auto font-mono text-[11.5px]">{formatDuration(now - new Date(task.liveWorker!.since).getTime())}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-[18px]" aria-labelledby="resting-heading">
        <SectionHeading id="resting-heading">Resting</SectionHeading>
        <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
          {!resting.length && <p className="px-[22px] py-[18px] text-sm text-muted-foreground">Nothing is on a timer.</p>}
          {resting.map((task) => (
            <div key={task.id} className="relative flex flex-wrap items-center gap-2.5 border-t border-border-subtle px-[22px] py-[18px] first:border-t-0">
              {freshIds.has(task.id) && <FreshEdge />}
              <button type="button" className="text-[15.5px] font-medium outline-none transition-[color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] hover:underline active:translate-y-px focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring" onClick={() => navigateToApp(`/${task.id}`)}>{taskTitle(task)}</button>
              <span className="max-w-[56ch] truncate text-[13.5px] text-muted-foreground">{safeText(task.waiting?.reason ?? latestRestingText(task))}</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{restingWhen(task, now)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="font-serif text-[25px] font-medium tracking-[-0.01em]">{children}</h2>;
}

export function StateChip({ label, tone, large = false }: { label: string; tone: ReturnType<typeof taskTone>; large?: boolean }) {
  return <span className={cn("inline-flex items-center rounded-sm font-mono font-semibold", large ? "h-6 px-2.5 text-[11px] uppercase tracking-[0.08em]" : "h-5 px-2 text-[10.5px]", TONE_CLASS[tone])}>{label}</span>;
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
