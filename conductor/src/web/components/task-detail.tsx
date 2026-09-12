import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Textarea } from "@rome-os/ui/textarea";
import { LightMarkdown } from "./light-markdown";
import { ActionButton, viewSegmentClass } from "./ui-bits";
import {
  attentionText,
  authorLabel,
  authorLane,
  expandedTextLabel,
  factBody,
  factLabel,
  factTone,
  isRoutine,
  isSafetyEvent,
  latestText,
  safeText,
  taskTone,
  TONE_CLASS,
} from "../lib/facts";
import { formatRelative, formatStamp, formatTime } from "../lib/format";
import type { FactJson, TaskDetailJson, TaskSummary } from "../lib/types";
import { StateChip, taskTitle } from "./board";

type HistoryView = "Stream" | "Lanes" | "Table";
const VIEW_KEY = "conductor-history-view";
const VIEW_OPTIONS = (["Stream", "Lanes", "Table"] as HistoryView[]).map((value) => ({ value, label: value }));
const DETAIL_REPLIES = ["accepted, thanks", "please revise", "hold for now"];

export function TaskDetail({ taskId, onTaskChanged }: { taskId: string; onTaskChanged: (task: TaskSummary) => void }) {
  const [task, setTask] = useState<TaskDetailJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [openEntries, setOpenEntries] = useState<Set<number>>(() => new Set());
  const [historyView, setHistoryView] = useState<HistoryView>(readView);
  const [hideRoutine, setHideRoutine] = useState(true);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}`);
      if (!response.ok) throw new Error("This task could not be read. Return to the board and try again.");
      const next = await response.json() as TaskDetailJson;
      setTask(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be read. Return to the board and try again.");
    }
  }, [taskId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 8_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, historyView); } catch { /* preference persistence is optional */ }
  }, [historyView]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      setReply("");
      await load();
    } finally {
      setSending(false);
    }
  };

  const closeTask = async (action: "complete" | "cancel") => {
    setSending(true);
    setError(null);
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}/${action}`, { method: "POST" });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const next = await response.json() as TaskDetailJson;
      setTask(next);
      onTaskChanged(next);
    } finally {
      setSending(false);
    }
  };

  if (!task) {
    if (error) return <ErrorCard message={error} retry={load} />;
    return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading this task<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;
  }

  const visible = task.facts.filter((item) => !(hideRoutine && isRoutine(item)));
  const rounds = groupRounds(visible);
  const now = Date.now();
  const created = task.facts.find((item) => item.kind === "Created");
  const issue = created?.payload.issue && typeof created.payload.issue === "object" ? created.payload.issue as Record<string, unknown> : undefined;
  const from = task.createdBy.startsWith("github:") ? task.createdBy : "you";
  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    composerRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Button variant="ghost" size="xs" className="w-fit rounded-sm px-1.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover" onClick={() => navigateToApp("/")}>← back to board</Button>

      <section className="flex flex-col gap-[18px] rounded-[14px] border border-border bg-surface p-[26px] shadow-1">
        <div className="flex flex-wrap items-center gap-[9px]">
          <StateChip label={task.state} tone={task.state === "open" ? "info" : taskTone(task)} />
          <h2 className="font-serif text-[26px] leading-8 font-medium tracking-[-0.015em]">{taskTitle(task)}</h2>
          <span className="font-mono text-[11px] text-subtle-foreground">{task.id}</span>
        </div>
        <div className="flex flex-wrap gap-3.5 font-mono text-[11px] text-muted-foreground">
          <span>{safeText(task.projectId ?? "no project")}{task.repo ? ` · ${safeText(task.repo)}` : ""}</span>
          <span>from {safeText(from)}{typeof issue?.number === "number" ? ` · issue #${issue.number}` : ""}</span>
          <span>opened {formatRelative(task.createdAt, now)}</span>
        </div>
        <div className="flex flex-col gap-[7px] rounded-[10px] border border-info-border bg-info-bg px-[18px] py-4">
          <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-info-fg uppercase">where it stands</span>
          <p className="max-w-[78ch] text-[15px] leading-[1.6]">{whereItStands(task)}</p>
        </div>
        {task.state === "open" && (
          <div className="flex flex-wrap gap-1.5">
            <ActionButton className="hover:bg-primary-hover" onClick={focusComposer}>Reply</ActionButton>
            <ActionButton variant="outline" className="border-border-strong bg-surface hover:bg-surface-hover" disabled={sending} onClick={() => void closeTask("complete")}>Mark complete</ActionButton>
            <ActionButton variant="ghost" className="text-muted-foreground hover:bg-surface-hover" disabled={sending} onClick={() => void closeTask("cancel")}>Cancel task</ActionButton>
          </div>
        )}
        {error && <p role="alert" className="text-xs text-destructive-fg">{safeText(error)}</p>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-serif text-[22px] font-medium tracking-[-0.01em]">What happened</h3>
          <span className="font-mono text-[11px] text-subtle-foreground">{task.facts.length} events</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <input type="checkbox" checked={hideRoutine} onChange={(event) => setHideRoutine(event.target.checked)} className="size-[13px] accent-primary" />
            hide routine steps
          </label>
          <SegmentedControl options={VIEW_OPTIONS} value={historyView} onValueChange={setHistoryView} size="sm" aria-label="History view" className={viewSegmentClass} />
        </div>
      </div>

      {historyView === "Stream" ? (
        <StreamView rounds={rounds} openEntries={openEntries} toggle={(seq) => setOpenEntries((current) => toggleSet(current, seq))} />
      ) : historyView === "Lanes" ? (
        <LanesView entries={visible} />
      ) : (
        <TableView entries={visible} openEntries={openEntries} toggle={(seq) => setOpenEntries((current) => toggleSet(current, seq))} />
      )}

      {task.state === "open" && (
        <section className="flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-3.5">
          <h3 className="font-serif text-[22px] font-medium tracking-[-0.01em]">Reply</h3>
          <div className="flex flex-wrap gap-1.5">
            {DETAIL_REPLIES.map((text) => <Button key={text} variant="outline" size="sm" className="h-[26px] rounded-sm border-border bg-surface-muted px-[11px] font-mono text-xs font-normal text-muted-foreground hover:bg-surface-hover" onClick={() => setReply(text)}>{text}</Button>)}
          </div>
          <Textarea ref={composerRef} className="min-h-[104px] rounded-8 bg-background px-3.5 py-3 text-sm leading-[1.55]" value={reply} onChange={(event) => setReply(event.target.value)} aria-label="Reply to this task" />
          <div className="flex flex-wrap items-center gap-2.5">
            <ActionButton className="w-fit hover:bg-primary-hover" onClick={() => void send()} disabled={sending || !reply.trim()}>{sending ? "Sending…" : "Send reply"}</ActionButton>
            {error && <p role="alert" className="text-xs text-destructive-fg">{safeText(error)}</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function StreamView({ rounds, openEntries, toggle }: { rounds: Array<{ stamp: string; entries: FactJson[] }>; openEntries: Set<number>; toggle: (seq: number) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((round, index) => (
        <section key={`${round.stamp}-${index}`} className="flex flex-col gap-[7px]">
          <div className="flex items-center gap-[9px]">
            <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{formatTime(round.stamp)}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {round.entries.map((item) => {
            const content = factBody(item);
            const who = authorLabel(item.by, item.kind);
            return (
              <article key={item.seq} className={cn("grid grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-12 border border-border px-[22px] py-5 sm:grid-cols-[96px_minmax(0,1fr)]", isRoutine(item) ? "bg-background" : "bg-surface")}>
                <div className="flex flex-col gap-[3px]">
                  <span className="font-mono text-[11px] text-subtle-foreground">#{item.seq} · {formatTime(item.createdAt)}</span>
                  {item.kind !== "Event" && (
                    <span className={cn("font-mono text-[10.5px] font-semibold", who === "you" ? "text-info-fg" : who === "conductor" ? "text-foreground" : "text-muted-foreground")}>{who}</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-[5px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <HistoryChip item={item} />
                    {content.title && <span className="text-[15px] font-semibold">{content.title}</span>}
                  </div>
                  {content.body && <LightMarkdown markdown={content.body} className="max-w-[76ch] text-[14.5px] leading-[1.6]" />}
                  {content.extra && (
                    <div>
                      <button type="button" className="w-fit border-0 bg-transparent p-0 font-mono text-[11px] text-muted-foreground underline transition-[color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] outline-none hover:text-foreground active:translate-y-px focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring" onClick={() => toggle(item.seq)}>{openEntries.has(item.seq) ? "hide" : "show"} {expandedTextLabel(item)}</button>
                      {openEntries.has(item.seq) && <pre className="mt-[7px] whitespace-pre-wrap rounded-8 bg-surface-muted p-2.5 font-mono text-[11.5px] leading-[1.55] shadow-[var(--inset-soft)]">{content.extra}</pre>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {!rounds.length && <p className="text-sm text-muted-foreground">No events to show.</p>}
    </div>
  );
}

function LanesView({ entries }: { entries: FactJson[] }) {
  const laneClass = { 1: "col-start-1", 2: "col-start-2", 3: "col-start-3", 4: "col-start-4" } as const;
  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-surface px-3.5 pt-3 pb-4">
      <div className="min-w-[760px]">
        <div className="mb-2.5 grid grid-cols-4 gap-2.5 border-b border-border pb-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          <span>you &amp; github</span><span>conductor</span><span>workers</span><span>world</span>
        </div>
        <div className="grid grid-cols-4 items-start gap-x-2.5 gap-y-2">
          {entries.map((item) => {
            const content = factBody(item);
            return (
              <div key={item.seq} className={cn("flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-border p-[14px]", isRoutine(item) ? "bg-background" : "bg-surface", laneClass[authorLane(item)])}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10.5px] text-subtle-foreground">#{item.seq}</span>
                  <HistoryChip item={item} compact />
                  <span className="ml-auto font-mono text-[10px] text-subtle-foreground">{formatTime(item.createdAt)}</span>
                </div>
                <span className="truncate text-[12.5px] leading-[1.4] font-medium">{content.title || content.body || "Update"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TableView({ entries, openEntries, toggle }: { entries: FactJson[]; openEntries: Set<number>; toggle: (seq: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[44px_104px_132px_minmax(0,1fr)_84px] items-center gap-2.5 border-b border-border bg-surface-muted px-5 py-2.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          <span /><span>what</span><span>who</span><span>what it says</span><span className="text-right">time</span>
        </div>
        {entries.map((item) => {
          const content = factBody(item);
          const oneLine = [content.title, content.body].filter(Boolean).join(" — ") || "Update";
          const open = openEntries.has(item.seq);
          return (
            <div key={item.seq} className="border-b border-border-subtle last:border-b-0">
              <button type="button" className="grid w-full grid-cols-[44px_104px_132px_minmax(0,1fr)_84px] items-center gap-2.5 px-5 py-[13px] text-left text-[12.5px] outline-none transition-[background-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] hover:bg-surface-muted active:translate-y-px focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring" onClick={() => toggle(item.seq)} aria-expanded={open}>
                <span className="font-mono text-[11px] text-subtle-foreground">#{item.seq}</span>
                <HistoryChip item={item} />
                <span className="truncate font-mono text-[11px] text-muted-foreground">{authorLabel(item.by, item.kind)}</span>
                <span className="truncate">{oneLine}</span>
                <span className="text-right font-mono text-[10.5px] text-subtle-foreground">{formatTime(item.createdAt)}</span>
              </button>
              {open && <pre className="mx-5 mb-3 whitespace-pre-wrap rounded-8 bg-surface-muted p-2.5 font-mono text-[11.5px] leading-[1.55] shadow-[var(--inset-soft)]">{content.extra || oneLine}</pre>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryChip({ item, compact = false }: { item: FactJson; compact?: boolean }) {
  return <span className={cn("inline-flex w-fit items-center rounded-[5px] font-mono font-semibold", compact ? "h-[18px] px-1.5 text-[10px]" : "h-[19px] px-[7px] text-[10.5px]", TONE_CLASS[factTone(item)])}>{factLabel(item.kind)}</span>;
}

function whereItStands(task: TaskDetailJson): string {
  if (task.state === "completed") return `This task is complete. ${latestText(task)}`;
  if (task.state === "cancelled") return `This task was cancelled. ${latestText(task)}`;
  if (task.liveWorker) return `Work is moving now. ${latestText(task)}`;
  if (task.waiting) return `${safeText(task.waiting.reason)} It will continue after ${formatStamp(task.waiting.resumeAfter)}.`;
  if (isSafetyEvent(task.latest)) return `${factBody(task.latest).title}. ${attentionText(task)}`;
  if (task.lastDecision?.kind === "Asked") return `${attentionText(task)} Conductor is waiting for your answer.`;
  if (task.lastDecision?.kind === "Reported") return `${attentionText(task)} Conductor is waiting for your reply. Nothing is running.`;
  return `${latestText(task)} Nothing is running right now.`;
}

function groupRounds(entries: FactJson[]): Array<{ stamp: string; entries: FactJson[] }> {
  const groups: Array<{ stamp: string; entries: FactJson[] }> = [];
  let current: { stamp: string; entries: FactJson[] } | undefined;
  for (const item of entries) {
    if (!current) {
      current = { stamp: item.createdAt, entries: [] };
      groups.push(current);
    }
    current.entries.push(item);
    if (authorLabel(item.by, item.kind) === "conductor") current = undefined;
  }
  return groups;
}

function toggleSet(current: Set<number>, value: number): Set<number> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function readView(): HistoryView {
  try {
    const value = window.localStorage.getItem(VIEW_KEY);
    if (value === "Stream" || value === "Lanes" || value === "Table") return value;
  } catch { /* use the default */ }
  return "Stream";
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error ?? `The request did not finish (HTTP ${response.status}). Try again.`;
}

function ErrorCard({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <div className="flex max-w-[70ch] flex-col gap-3 rounded-[14px] border border-destructive-border bg-destructive-bg p-5">
      <strong className="text-[15px] text-destructive-fg">This task could not be read.</strong>
      <p className="text-sm">{safeText(message)}</p>
      <ActionButton variant="outline" className="w-fit border-border-strong bg-surface hover:bg-surface-hover" onClick={() => void retry()}>Try again</ActionButton>
    </div>
  );
}
