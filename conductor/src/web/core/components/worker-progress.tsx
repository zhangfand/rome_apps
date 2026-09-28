import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { cn } from "@rome-os/ui/cn";
import { Check, Circle, LoaderCircle } from "lucide-react";
import { useWorkerPlan } from "../lib/use-worker-plan";
import type { WorkerPlan, WorkerPlanStep } from "../lib/worker-plan";

/**
 * "3/7 done · Running tests" for a live worker's row. Renders nothing until the
 * worker has written a todo list, so a row without one looks as it did before.
 */
export function WorkerProgressInline({ sessionId, className }: { sessionId?: string; className?: string }) {
  const plan = useWorkerPlan(sessionId);
  if (!plan) return null;
  return (
    <span className={cn("inline-flex min-w-0 max-w-[52ch] items-baseline gap-1.5 text-aux", className)} title={progressTitle(plan)}>
      <span className="whitespace-nowrap font-mono text-foreground">{plan.done}/{plan.total} done</span>
      {plan.current && <span className="truncate text-muted-foreground">· {plan.current}</span>}
    </span>
  );
}

/** The live worker's own checklist, shown above the task's activity history. */
export function WorkerChecklist({ sessionId, worker }: { sessionId?: string; worker: ReactNode }) {
  const plan = useWorkerPlan(sessionId);
  if (!plan) return null;
  return (
    <Card className="gap-3 py-4" aria-label="Worker progress">
      <CardHeader className="px-4">
        <CardTitle className="flex min-w-0 items-baseline gap-2 text-ui">
          <span>Worker progress</span>
          <span className="truncate text-aux font-normal text-muted-foreground">{worker}</span>
        </CardTitle>
        <CardAction className="font-mono text-[12px] text-foreground">{plan.done}/{plan.total} done</CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 px-4">
        {plan.current && <p className="text-ui text-foreground">{plan.current}</p>}
        <ol className="flex flex-col gap-1.5">
          {plan.steps.map((step, index) => (
            <li key={`${index}:${step.text}`} className="flex items-start gap-2 text-ui">
              <StepIcon status={step.status} />
              <span className={cn(
                "min-w-0",
                step.status === "completed" && "text-muted-foreground line-through decoration-border",
                step.status === "in_progress" && "font-medium text-foreground",
                step.status === "pending" && "text-muted-foreground",
              )}>
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function StepIcon({ status }: { status: WorkerPlanStep["status"] }) {
  const className = "mt-[3px] size-3.5 shrink-0";
  if (status === "completed") return <Check className={cn(className, "text-muted-foreground")} aria-label="done" />;
  if (status === "in_progress") {
    return <LoaderCircle className={cn(className, "text-foreground motion-safe:animate-spin")} aria-label="in progress" />;
  }
  return <Circle className={cn(className, "text-subtle-foreground")} aria-label="not started" />;
}

function progressTitle(plan: WorkerPlan): string {
  const count = `${plan.done} of ${plan.total} steps done`;
  return plan.current ? `${count}. Now: ${plan.current}` : count;
}
