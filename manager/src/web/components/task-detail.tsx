import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Spinner } from "@rome-os/ui/spinner";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { AttentionPanel, chatAbout } from "./attention";
import { PositionBadge, TaskStateBadge } from "./badges";
import { Ledger } from "./ledger";
import { TaskName } from "./refs";
import { WorkerLink } from "./worker-link";
import { WorkerTable } from "./worker-table";
import { briefText, handleOf, nameWorkers } from "../lib/domain";
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
  const awaiting = task && openWord && task.state === "taken" && task.position !== "working";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigateToApp("")} className="-ml-2">
          <ArrowLeft className="size-4" aria-hidden />
          All tasks
        </Button>
        {task && handle ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void chatAbout(taskId, handle, "status")}
          >
            <MessageSquare className="size-4" aria-hidden />
            Discuss in chat
          </Button>
        ) : null}
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

            <h1 className="max-w-prose font-serif text-title leading-snug whitespace-pre-wrap text-foreground">
              {briefText(task.brief, handle)}
            </h1>

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
