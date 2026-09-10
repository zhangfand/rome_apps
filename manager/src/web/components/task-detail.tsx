import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Spinner } from "@rome-os/ui/spinner";
import { ArrowLeft } from "lucide-react";
import { AttentionPanel } from "./attention";
import { PositionBadge, TaskStateBadge } from "./badges";
import { Ledger } from "./ledger";
import { LightMarkdown } from "./light-markdown";
import { TaskName } from "./refs";
import { TaskComposer } from "./task-composer";
import { WorkerLink } from "./worker-link";
import { WorkerTable } from "./worker-table";
import { handleOf, nameWorkers } from "../lib/domain";
import { formatStamp } from "../lib/format";
import type { TaskDetail as TaskDetailData } from "../lib/types";

const POLL_MS = 15_000;

export function TaskDetail({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setTask((await res.json()) as TaskDetailData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [taskId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const handle = useMemo(() => (task ? handleOf(task) : undefined), [task]);
  const names = useMemo(() => (task ? nameWorkers([task]) : new Map()), [task]);

  const created = task?.facts[0];
  const openWord = task
    ? [...task.facts].reverse().find((f) => f.kind === "Question" || f.kind === "Report")
    : undefined;
  const awaiting = task && openWord && task.state === "taken" && (task.position === "stuck" || task.position === "reported");

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigateToApp("")} className="-ml-2">
          <ArrowLeft className="size-4" aria-hidden />
          Overview
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load this task</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!task && !error ? (
        <div className="flex items-center gap-2 py-10 text-ui text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : null}

      {task && handle ? (
        <>
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <TaskName handle={handle} rawId={task.id} size="section" />
              {task.projectId ? <span className="rounded-4 bg-surface-muted px-1.5 text-aux text-muted-foreground" title={task.project?.workingDir}>{task.projectId}</span> : null}
              <span className="inline-flex items-center gap-1.5">
                <TaskStateBadge state={task.state} />
                {task.position ? <PositionBadge position={task.position} /> : null}
              </span>
              {created ? (
                <span className="ml-auto text-aux text-muted-foreground">
                  opened by <span className="font-medium text-foreground">{created.by}</span> ·{" "}
                  <span className="tabular-nums">{formatStamp(created.createdAt)}</span>
                </span>
              ) : null}
            </div>

            <h1 className="sr-only">Task details: {handle.name}</h1>
            <LightMarkdown
              className="min-w-0 max-w-prose break-words text-ui text-foreground"
              markdown={task.brief}
            />

            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-aux text-muted-foreground">
              <Stat n={task.facts.length} one="fact" many="facts" />
              <Stat n={task.workers.length} one="worker" many="workers" />
              {task.liveWorkerId ? (
                <div>
                  <WorkerLink names={names} workerId={task.liveWorkerId} className="text-foreground" /> running now
                </div>
              ) : null}
              {task.startsSinceLastPersonFact > 0 && task.state === "taken" ? (
                <div>
                  <span className="tabular-nums text-foreground">{task.startsSinceLastPersonFact}</span>{" "}
                  {task.startsSinceLastPersonFact === 1 ? "start" : "starts"} since your last word
                </div>
              ) : null}
              <div className="font-mono text-subtle-foreground" title="The ledger's id for this task">
                {task.id}
              </div>
            </dl>
          </header>

          {task.waiting ? (
            <section className="rounded-12 border border-border p-4 text-ui">
              <h2 className="font-medium">Waiting for an automatic revisit</h2>
              <p className="mt-1 whitespace-pre-wrap">{task.waiting.reason}</p>
              <p className="mt-1 text-muted-foreground">
                Eligible after {formatStamp(task.waiting.resumeAfter)}. Resumes on a scheduled pass with a free worker slot. No input needed.
              </p>
            </section>
          ) : null}

          {awaiting && openWord ? (
            <AttentionPanel
              taskId={task.id}
              handle={handle}
              kind={openWord.kind as "Question" | "Report"}
              text={String(openWord.payload.why ?? openWord.payload.what ?? "")}
              evidence={openWord.payload.evidence ? String(openWord.payload.evidence) : undefined}
              showOpen={false}
              names={names}
            />
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-section">Workers</h2>
            <WorkerTable workers={task.workers} names={names} showTask={false} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-section">History</h2>
            <Ledger facts={task.facts} names={names} showTask={false} oldestFirst filterable={false} />
          </section>
          <div data-task-composer-dock className="sticky bottom-0 z-10 mt-auto shrink-0 bg-background pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <TaskComposer key={task.id} taskId={task.id} closed={task.state === "completed" || task.state === "cancelled"} onSent={() => void load()} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <div>
      <span className="tabular-nums text-foreground">{n}</span> {n === 1 ? one : many}
    </div>
  );
}
