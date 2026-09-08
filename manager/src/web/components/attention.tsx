import { useState } from "react";
import { navigateToApp, startChat } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { ArrowUpRight, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { LightMarkdown } from "./light-markdown";
import { TaskName } from "./refs";
import { type TaskHandle, type WorkerNames, briefText, gist, humanize } from "../lib/domain";
import { formatRelative, truncate, useNow } from "../lib/format";

/**
 * The one thing on the page that is addressed to the guardian: a worker is
 * stuck and asks, or the runtime reports that something is ready to look at.
 * The only way to answer is in chat, because the agent is what stamps who
 * said it — so the panel opens a chat that shows the question and waits.
 */
export function chatAbout(taskId: string, handle: TaskHandle, kind: "Question" | "Report" | "status") {
  const name = handle.isRef ? handle.name : `"${truncate(handle.name, 60)}"`;
  const ask =
    kind === "Question"
      ? "It is stuck on a question. Show me the question and wait for my answer; record it as my reply when I give it."
      : kind === "Report"
        ? "It is holding a report. Show me the report and wait for my word: I will say whether it is done, needs more, or should be dropped."
        : "Show me where it stands and wait for my instructions.";
  return startChat({
    message: `About task ${taskId} (${name}). ${ask}`,
    agentName: "manager:manager",
  });
}

export function AttentionPanel({
  taskId,
  handle,
  brief,
  kind,
  text,
  evidence,
  updatedAt,
  showOpen = true,
  names,
}: {
  taskId: string;
  handle: TaskHandle;
  /** Shown when the panel stands alone (the dashboard), not on the task page that already shows it. */
  brief?: string;
  kind: "Question" | "Report";
  text: string;
  evidence?: string;
  updatedAt?: string;
  showOpen?: boolean;
  names?: WorkerNames;
}) {
  const now = useNow();
  const isQuestion = kind === "Question";
  const [full, setFull] = useState(false);
  // A question is short and must be read whole; a report gets its gist.
  const summary = isQuestion ? { text, partial: false } : gist(text);
  const showBrief = brief && !handle.isRef;

  return (
    <article
      className={cn(
        "rounded-12 border border-border bg-surface pl-4 pr-4 py-4 md:pl-5 border-l-[3px]",
        isQuestion ? "border-l-warning" : "border-l-info",
      )}
      aria-label={isQuestion ? "A worker is stuck and asks you" : "Work finished, needs your sign-off"}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("text-aux font-medium", isQuestion ? "text-warning-fg" : "text-info-fg")}>
          {isQuestion ? "Stuck — asks you" : "Finished — needs your sign-off"}
        </span>
        <TaskName handle={handle} rawId={taskId} />
        {updatedAt ? (
          <span className="ml-auto text-aux text-muted-foreground tabular-nums" title={updatedAt}>
            {formatRelative(updatedAt, now)}
          </span>
        ) : null}
      </header>

      <p className="mt-1 text-aux text-muted-foreground">
        {isQuestion
          ? "The worker cannot go on without a decision from you. Your answer is recorded and the work resumes."
          : "The worker says the task is done. Only you close a task: approve it, send it back with what is missing, or cancel it."}
      </p>

      {showBrief ? (
        <p className="mt-2 font-serif text-body leading-snug text-foreground line-clamp-2">
          {truncate(briefText(brief, handle), 220)}
        </p>
      ) : null}

      <LightMarkdown className="mt-3 text-ui" markdown={full || !summary.partial ? text : summary.text} />
      {summary.partial ? (
        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          aria-expanded={full}
          className="mt-2 inline-flex items-center gap-1 rounded-4 text-aux text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {full ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
          {full ? "Show the gist" : "Show full report"}
        </button>
      ) : null}

      {evidence ? (
        <p className="mt-2 text-aux text-muted-foreground">
          <span className="font-medium text-foreground">Evidence</span> {names ? humanize(evidence, names) : evidence}
        </p>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void chatAbout(taskId, handle, kind)}>
          <MessageSquare className="size-4" aria-hidden />
          {isQuestion ? "Answer in chat" : "Sign off in chat"}
        </Button>
        {showOpen ? (
          <Button variant="ghost" size="sm" onClick={() => navigateToApp(taskId)}>
            Open task
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
        ) : null}
      </footer>
    </article>
  );
}
