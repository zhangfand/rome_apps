import { navigateToApp, startChat } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { LightMarkdown } from "./light-markdown";
import { TaskName } from "./refs";
import { type TaskHandle, type WorkerNames, briefText, humanize } from "../lib/domain";
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
  clamp = false,
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
  clamp?: boolean;
  names?: WorkerNames;
}) {
  const now = useNow();
  const isQuestion = kind === "Question";

  return (
    <article
      className={cn(
        "rounded-12 border border-border bg-surface pl-4 pr-4 py-4 md:pl-5 border-l-[3px]",
        isQuestion ? "border-l-warning" : "border-l-info",
      )}
      aria-label={isQuestion ? "A worker is waiting on you" : "A worker reports"}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("text-aux font-medium", isQuestion ? "text-warning-fg" : "text-info-fg")}>
          {isQuestion ? "Waiting on you" : "Ready for your word"}
        </span>
        <TaskName handle={handle} rawId={taskId} />
        {updatedAt ? (
          <span className="ml-auto text-aux text-muted-foreground tabular-nums" title={updatedAt}>
            {formatRelative(updatedAt, now)}
          </span>
        ) : null}
      </header>

      {brief ? (
        <p className="mt-2 font-serif text-body leading-snug text-foreground line-clamp-2">
          {truncate(briefText(brief, handle), 220)}
        </p>
      ) : null}

      {clamp ? (
        <div className="relative mt-3 max-h-52 overflow-hidden">
          <LightMarkdown className="text-ui" markdown={text} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent"
          />
        </div>
      ) : (
        <LightMarkdown className="mt-3 text-ui" markdown={text} />
      )}

      {evidence ? (
        <p className="mt-2 text-aux text-muted-foreground">
          <span className="font-medium text-foreground">Evidence</span> {names ? humanize(evidence, names) : evidence}
        </p>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void chatAbout(taskId, handle, kind)}>
          <MessageSquare className="size-4" aria-hidden />
          {isQuestion ? "Answer in chat" : "Give your word in chat"}
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
