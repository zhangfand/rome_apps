import { useCallback, useEffect, useState } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { LightMarkdown } from "./light-markdown";
import { authorLabel, factBody, KIND_TONE } from "../lib/facts";
import { formatStamp } from "../lib/format";
import type { FactJson, TaskDetailJson } from "../lib/types";

export function TaskDetail({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskDetailJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    const res = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}`);
    if (!res.ok) { setError(`HTTP ${res.status}`); return; }
    setTask((await res.json()) as TaskDetailJson);
  }, [taskId]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 8_000);
    return () => clearInterval(timer);
  }, [load]);
  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}/reply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: reply }) });
      if (res.ok) { setReply(""); await load(); }
      else setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
    } finally { setSending(false); }
  };
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!task) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigateToApp("/")}>← All tasks</Button>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{task.id}</span>
          <span className={cn("rounded px-1.5 text-xs", task.state === "open" ? "bg-primary/15 text-primary" : KIND_TONE[task.state === "completed" ? "Completed" : "Cancelled"])}>{task.state}</span>
          {task.projectId && <span className="rounded bg-muted px-1.5 text-xs">{task.projectId}{task.repo ? ` · ${task.repo}` : ""}</span>}
          <span className="text-xs text-muted-foreground">by {authorLabel(task.createdBy)}</span>
          {task.liveWorker && <span className="rounded bg-sky-500/15 px-1.5 text-xs text-sky-700 dark:text-sky-300">worker {task.liveWorker.workerId} running as {task.liveWorker.agent}</span>}
          {task.waiting && <span className="text-xs text-muted-foreground">waiting until {formatStamp(task.waiting.resumeAfter)}</span>}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm"><LightMarkdown markdown={task.brief} /></div>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Ledger · {task.facts.length} facts</h2>
        <ol className="flex flex-col gap-2">
          {task.facts.map((fact) => <FactRow key={fact.seq} fact={fact} />)}
        </ol>
      </section>
      {task.state === "open" && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Reply</h2>
          <textarea className="min-h-24 rounded-md border border-border bg-background p-2 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Answer a question, steer the work, or add information. The orchestrator reads it on the next wake." />
          <Button size="sm" className="w-fit" onClick={send} disabled={sending || !reply.trim()}>{sending ? "Sending…" : "Send reply"}</Button>
        </section>
      )}
    </div>
  );
}

function FactRow({ fact }: { fact: FactJson }) {
  const [open, setOpen] = useState(false);
  const { title, body, extra } = factBody(fact);
  const quiet = fact.kind === "Opened" || fact.kind === "Noted";
  return (
    <li className={cn("rounded-lg border border-border p-3", quiet && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">#{fact.seq}</span>
        <span className={cn("rounded px-1.5", KIND_TONE[fact.kind] ?? "bg-muted")}>{fact.kind}</span>
        <span>{authorLabel(fact.by)}</span>
        <span className="ml-auto">{formatStamp(fact.createdAt)}</span>
      </div>
      <div className="mt-1 text-sm font-medium">{title}</div>
      {body && <div className="mt-1 text-sm"><LightMarkdown markdown={body} /></div>}
      {extra && (
        <div className="mt-2">
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Show"} {fact.kind === "Dispatched" ? "instructions" : "detail"}
          </button>
          {open && <div className="mt-2 rounded bg-muted/40 p-3 text-sm"><LightMarkdown markdown={extra} /></div>}
        </div>
      )}
      {fact.source && fact.by !== "orchestrator" && fact.by !== "runtime" && !/^w-/.test(fact.by) && (
        <div className="mt-2 text-xs text-muted-foreground">source: {fact.source}</div>
      )}
    </li>
  );
}
