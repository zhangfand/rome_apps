import { Fragment, useMemo, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { cn } from "@rome-os/ui/cn";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { KindDot, KindWord } from "./badges";
import { LightMarkdown } from "./light-markdown";
import { WorkerLink } from "./worker-link";
import { type Author, type TaskHandle, type WorkerNames, authorOf, humanize, plain, workerLabel } from "../lib/domain";
import { dayKey, formatDay, formatTime, truncate, useNow } from "../lib/format";
import { FACT_KINDS, type FactSummary } from "../lib/types";

const ALL = "__all__";

/**
 * The ledger as a ruled journal: a sequence gutter, one continuous rail (the
 * append-only thread — nothing is ever removed from it), and a marker per
 * fact whose shape says whether it happened or was said. Newest first on the
 * dashboard because the question there is "what just happened"; a task page
 * shows the same rows oldest first because there the question is "how did we
 * get here".
 */
export function Ledger({
  facts,
  names,
  taskNames,
  showTask = true,
  oldestFirst = false,
  filterable = true,
}: {
  facts: FactSummary[];
  names: WorkerNames;
  taskNames?: ReadonlyMap<string, TaskHandle>;
  showTask?: boolean;
  oldestFirst?: boolean;
  filterable?: boolean;
}) {
  const [kind, setKind] = useState<string>(ALL);
  const [by, setBy] = useState<string>(ALL);
  const now = useNow();

  const authors = useMemo(() => {
    const map = new Map<string, Author>();
    for (const fact of facts) {
      const a = authorOf(fact, names);
      if (!map.has(a.raw)) map.set(a.raw, a);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [facts, names]);

  const visible = useMemo(() => {
    const filtered = facts.filter(
      (fact) => (kind === ALL || fact.kind === kind) && (by === ALL || fact.by === by),
    );
    return oldestFirst ? [...filtered].sort((a, b) => a.seq - b.seq) : filtered;
  }, [facts, kind, by, oldestFirst]);

  return (
    <div className="flex flex-col gap-3">
      {filterable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger size="sm" className="w-[150px]" aria-label="Filter by kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All kinds</SelectItem>
              {FACT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={by} onValueChange={setBy}>
            <SelectTrigger size="sm" className="w-[180px]" aria-label="Filter by author">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Anyone</SelectItem>
              {authors.map((a) => (
                <SelectItem key={a.raw} value={a.raw}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-aux text-muted-foreground tabular-nums">
            {visible.length} of {facts.length}
          </span>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState className="py-10">
          <EmptyStateTitle>No facts</EmptyStateTitle>
          <EmptyStateDescription>
            {facts.length === 0 ? "The ledger is empty." : "Nothing matches these filters."}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <ol className="journal">
          {visible.map((fact, i) => {
            const day = dayKey(fact.createdAt);
            const newDay = i === 0 || dayKey(visible[i - 1].createdAt) !== day;
            return (
              <Fragment key={fact.id}>
                {newDay ? (
                  <li className="journal-day" aria-hidden>
                    <span />
                    <span />
                    <span className="text-aux font-medium text-muted-foreground">{formatDay(fact.createdAt, now)}</span>
                  </li>
                ) : null}
                <FactRow
                  fact={fact}
                  names={names}
                  task={showTask ? taskNames?.get(fact.taskId) : undefined}
                  showTask={showTask}
                />
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** A session id is a UUID; eight characters is enough to tell two apart. */
function shortSession(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

/** The payload field that carries a fact's substance, in the guardian's words. */
function bodyOf(fact: FactSummary, names: WorkerNames): string {
  const p = fact.payload;
  switch (fact.kind) {
    case "Created":
      return String(p.brief ?? "");
    case "Completed":
    case "Cancelled":
      return String(p.reason ?? "");
    case "Started":
      return p.resumeSessionId
        ? `${workerLabel(names, String(p.workerId ?? ""))} started, resuming session ${shortSession(String(p.resumeSessionId))}`
        : `${workerLabel(names, String(p.workerId ?? ""))} started`;
    case "Opened":
      return `${workerLabel(names, String(p.workerId ?? ""))} is running in session ${shortSession(String(p.romeSessionId ?? ""))}`;
    case "Restarted":
      return `${workerLabel(names, String(p.workerId ?? ""))} could not resume session ${shortSession(String(p.rejectedSessionId ?? ""))} (${humanize(String(p.error ?? ""), names)}) — started a fresh session`;
    case "Returned":
      return String(p.reply ?? "");
    case "Failed":
      return humanize(String(p.error ?? ""), names);
    case "Lost":
      return humanize(String(p.why ?? ""), names);
    case "Question":
      return String(p.why ?? "");
    case "Report":
      return String(p.what ?? "");
    case "Reply":
      return String(p.text ?? "");
    default:
      return "";
  }
}

function FactRow({
  fact,
  names,
  task,
  showTask,
}: {
  fact: FactSummary;
  names: WorkerNames;
  task?: TaskHandle;
  showTask: boolean;
}) {
  const [open, setOpen] = useState(false);
  const body = bodyOf(fact, names);
  const author = authorOf(fact, names);
  const expandable =
    body.length > 140 ||
    fact.source !== undefined ||
    fact.kind === "Started" ||
    fact.kind === "Restarted" ||
    fact.kind === "Report" ||
    body.includes("\n");

  const toggle = () => {
    if (expandable) setOpen((v) => !v);
  };

  return (
    <li className={cn("journal-row group", expandable && "cursor-pointer")}>
      <span className="pt-0.5 text-right font-mono text-aux text-subtle-foreground tabular-nums select-none">
        {fact.seq}
      </span>
      <span className="flex justify-center pt-[7px]">
        <KindDot kind={fact.kind} />
      </span>
      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "min-w-0 rounded-8 px-2 py-1 -mx-2 -my-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          expandable && "group-hover:bg-surface-hover",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-aux text-muted-foreground">
          <KindWord kind={fact.kind} />
          {author.kind === "worker" ? (
            <WorkerLink names={names} workerId={author.raw} />
          ) : (
            <span className={cn(author.kind === "person" && "font-medium text-foreground")} title={author.raw}>
              {author.label}
            </span>
          )}
          {showTask ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigateToApp(fact.taskId);
              }}
              title={fact.taskId}
              className={cn(
                "max-w-[40ch] truncate rounded-4 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                task?.isRef ? "font-mono text-foreground" : "text-foreground",
              )}
            >
              {task?.name ?? fact.taskId}
            </button>
          ) : null}
          <time dateTime={fact.createdAt} className="ml-auto tabular-nums" title={fact.createdAt}>
            {formatTime(fact.createdAt)}
          </time>
        </div>

        {body ? (
          open ? (
            <LightMarkdown className="mt-1 text-ui" markdown={body} />
          ) : (
            <p className="mt-0.5 text-ui text-foreground">{truncate(plain(body), 160)}</p>
          )
        ) : null}

        {open ? (
          <div className="mt-2 flex flex-col gap-1.5 text-aux text-muted-foreground">
            {fact.source ? (
              <div>
                <span className="font-medium text-foreground">Said</span>{" "}
                <span className="whitespace-pre-wrap break-words">{fact.source}</span>
              </div>
            ) : null}
            {fact.kind === "Report" && fact.payload.evidence ? (
              <div>
                <span className="font-medium text-foreground">Evidence</span>{" "}
                <span className="whitespace-pre-wrap break-words">{humanize(String(fact.payload.evidence), names)}</span>
              </div>
            ) : null}
            {fact.kind === "Started" && fact.payload.prompt ? (
              <details className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                <summary className="cursor-pointer select-none text-foreground">The brief this worker was given</summary>
                <pre className="mt-1 max-h-72 overflow-auto rounded-8 bg-surface-muted p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
                  {String(fact.payload.prompt)}
                </pre>
              </details>
            ) : null}
            <div className="font-mono text-subtle-foreground">
              fact {fact.id} · task {fact.taskId} · by {author.raw}
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}
