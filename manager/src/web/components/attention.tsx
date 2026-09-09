import { useId, useState } from "react";
import { navigateToApp, startChat } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { ArrowUpRight, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { PullRequestCard } from "./pull-request";
import { LightMarkdown } from "./light-markdown";
import { RefLink, TaskName } from "./refs";
import { attentionPrompt } from "../lib/attention-prompt";
import { type TaskHandle, type WorkerNames, briefText, humanize, plain, refsIn } from "../lib/domain";
import { formatRelative, truncate, useNow } from "../lib/format";

/**
 * The one thing on the page that is addressed to the guardian: a worker is
 * stuck and asks, or the runtime reports that something is ready to look at.
 * Questions keep their chat action. Reports promote live GitHub facts and
 * explicit PR actions; the full narrative and task discussion live in Details.
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
  projectId,
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
  projectId?: string;
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
  const detailsId = useId();
  const summary = attentionPrompt(kind, text);
  // Prefer a PR actually named by this report over unrelated historical references.
  const reportPrs = refsIn(text).filter((ref) => ref.kind === "pr");
  const reportPr = reportPrs[0];
  const primaryRef = reportPr ?? handle.issue;
  const otherPrs = handle.prs.filter((ref) => ref.url !== primaryRef?.url);
  const titleHandle = { ...handle, prs: [] };
  const issueTitle = brief && handle.isRef
    ? plain(briefText(brief, handle)).split("\n").find((line) => line.trim())?.trim()
    : undefined;

  return (
    <article
      className={cn(
        "rounded-12 border border-border bg-surface pl-4 pr-4 py-4 md:pl-5 border-l-[3px]",
        isQuestion ? "border-l-warning" : "border-l-info",
      )}
      aria-label={isQuestion ? "Decision needed" : "Report ready"}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <TaskName handle={titleHandle} rawId={taskId} />
        {projectId ? <span className="rounded-4 bg-surface-muted px-1.5 text-aux text-muted-foreground">{projectId}</span> : null}
        <span className={cn("text-aux font-medium", isQuestion ? "text-warning-fg" : "text-info-fg")}>
          {isQuestion ? "Decision needed" : "Report ready"}
        </span>
        {updatedAt ? (
          <span className="ml-auto text-aux text-muted-foreground tabular-nums" title={updatedAt}>
            {formatRelative(updatedAt, now)}
          </span>
        ) : null}
      </header>

      {issueTitle ? <p className="mt-1 text-ui font-medium line-clamp-2">{issueTitle}</p> : null}
      {isQuestion ? <p className="mt-2 text-ui break-words">{summary}</p> : reportPrs.length ? (
        reportPrs.map((pr) => <PullRequestCard key={pr.url} taskId={taskId} pr={pr} />)
      ) : <p className="mt-2 text-ui text-muted-foreground">No PR linked in this report. Open Details to see the result.</p>}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {isQuestion ? <Button size="sm" onClick={() => void chatAbout(taskId, handle, kind)}>
          <MessageSquare className="size-4" aria-hidden /> Answer in chat
        </Button> : null}
        {isQuestion && primaryRef && primaryRef.url !== handle.issue?.url ? <RefLink r={primaryRef} className="mx-1" /> : null}
        <button
          type="button"
          onClick={() => setFull((value) => !value)}
          aria-expanded={full}
          aria-controls={detailsId}
          className="inline-flex items-center gap-1 rounded-4 px-1 py-1 text-aux text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {full ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
          Details
        </button>
      </footer>

      <div id={detailsId} hidden={!full} className="mt-4 border-t border-border pt-3 break-words">
        {full ? (
          <>
            <LightMarkdown className="text-ui" markdown={text} />
            {evidence ? (
              <p className="mt-3 text-aux text-muted-foreground">
                <span className="font-medium text-foreground">Evidence</span>{" "}
                {names ? humanize(evidence, names) : evidence}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {showOpen ? (
                <Button variant="ghost" size="sm" onClick={() => navigateToApp(taskId)}>
                  Open task <ArrowUpRight className="size-4" aria-hidden />
                </Button>
              ) : null}
              {!isQuestion ? <Button variant="ghost" size="xs" onClick={() => void chatAbout(taskId, handle, kind)}>
                <MessageSquare className="size-3" aria-hidden /> Discuss task
              </Button> : null}
              {otherPrs.map((ref) => <RefLink key={ref.url} r={ref} />)}
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
