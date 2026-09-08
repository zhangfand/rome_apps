import { useCallback, useEffect, useState } from "react";
import { fetchAppApi, navigateToApp, startChat } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { Spinner } from "@rome-os/ui/spinner";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { PositionBadge, TaskStateBadge } from "./badges";
import { Ledger } from "./ledger";
import { WorkerTable } from "./worker-table";
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

  const created = task?.facts[0];
  const openQuestion = task
    ? [...task.facts].reverse().find((f) => f.kind === "Question" || f.kind === "Report")
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigateToApp("")}>
          <ArrowLeft className="size-4" aria-hidden />
          All tasks
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{taskId}</span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() =>
            void startChat({
              message: `Show me where task ${taskId} stands: "${task?.brief ?? ""}"`,
              agentName: "manager:manager",
            })
          }
        >
          <MessageSquare className="size-4" aria-hidden />
          Discuss in chat
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load task</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!task && !error ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : null}

      {task ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-1.5">
                <TaskStateBadge state={task.state} />
                {task.position ? <PositionBadge position={task.position} /> : null}
                {created ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    opened by <span className="font-mono">{created.by}</span> ·{" "}
                    {formatStamp(created.createdAt)}
                  </span>
                ) : null}
              </div>
              <CardTitle className="text-base leading-snug font-medium whitespace-pre-wrap">
                {task.brief}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>{task.facts.length} facts</span>
              <span>{task.workers.length} workers</span>
              <span>
                starts since last reply: <span className="tabular-nums">{task.startsSinceLastPersonFact}</span>
              </span>
              {task.liveWorkerId ? (
                <span>
                  live worker <span className="font-mono">{task.liveWorkerId}</span>
                </span>
              ) : null}
            </CardContent>
          </Card>

          {openQuestion && task.state === "taken" && task.position !== "working" ? (
            <Alert variant={openQuestion.kind === "Question" ? "warning" : "info"}>
              <AlertTitle>
                {openQuestion.kind === "Question" ? "The runtime is asking" : "The runtime reports"}
              </AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {String(openQuestion.payload.why ?? openQuestion.payload.what ?? "")}
                {openQuestion.kind === "Report" && openQuestion.payload.evidence ? (
                  <div className="mt-1 text-xs opacity-80">
                    evidence: {String(openQuestion.payload.evidence)}
                  </div>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Workers</h2>
            <WorkerTable workers={task.workers} showTask={false} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">History</h2>
            <Ledger facts={task.facts} showTask={false} oldestFirst filterable={false} />
          </section>
        </>
      ) : null}
    </div>
  );
}
