import { Badge } from "@rome-os/ui/badge";
import { cn } from "@rome-os/ui/cn";
import type { FactKind, Position, TaskState, WorkerStatus } from "../lib/types";

/**
 * Every categorical status in the app, mapped once onto the kit's semantic
 * vocabulary so the same state reads the same everywhere.
 */

const TASK_STATE: Record<TaskState, { label: string; variant: "info" | "brand" | "success" | "muted" }> = {
  created: { label: "Created", variant: "info" },
  taken: { label: "Taken", variant: "brand" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const POSITION: Record<Position, { label: string; variant: "default" | "warning" | "info" }> = {
  waiting: { label: "Waiting", variant: "default" },
  working: { label: "Working", variant: "default" },
  stuck: { label: "Stuck", variant: "warning" },
  reported: { label: "Reported", variant: "info" },
};

const WORKER: Record<WorkerStatus, { label: string; variant: "brand" | "success" | "destructive" | "warning" }> = {
  running: { label: "Running", variant: "brand" },
  returned: { label: "Returned", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  lost: { label: "Lost", variant: "warning" },
};

export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "destructive" | "muted";

/**
 * The ledger's own grammar, from the README: a participle is something that
 * happened, a noun is something somebody said. The journal draws the first as
 * a filled dot and the second as a ring, so the shape alone tells you whether
 * a row is an event or a message. Colour carries the outcome.
 */
export const KIND: Record<FactKind, { tone: Tone; said: boolean }> = {
  Bound: { tone: "muted", said: false },
  Created: { tone: "neutral", said: false },
  Taken: { tone: "brand", said: false },
  Completed: { tone: "success", said: false },
  Cancelled: { tone: "muted", said: false },
  Started: { tone: "brand", said: false },
  Opened: { tone: "muted", said: false },
  Restarted: { tone: "warning", said: false },
  Returned: { tone: "success", said: false },
  Failed: { tone: "destructive", said: false },
  Deferred: { tone: "muted", said: false },
  Lost: { tone: "muted", said: false },
  Question: { tone: "warning", said: true },
  Report: { tone: "info", said: true },
  Reply: { tone: "neutral", said: true },
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  brand: "text-brand",
  info: "text-info-fg",
  success: "text-success-fg",
  warning: "text-warning-fg",
  destructive: "text-destructive-fg",
  muted: "text-muted-foreground",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-foreground border-foreground",
  brand: "bg-brand border-brand",
  info: "bg-info border-info",
  success: "bg-success border-success",
  warning: "bg-warning border-warning",
  destructive: "bg-destructive border-destructive",
  muted: "bg-muted-foreground border-muted-foreground",
};

export function TaskStateBadge({ state }: { state: TaskState }) {
  const spec = TASK_STATE[state];
  return <Badge variant={spec.variant}>{spec.label}</Badge>;
}

export function PositionBadge({ position }: { position: Position }) {
  const spec = POSITION[position];
  return <Badge variant={spec.variant}>{spec.label}</Badge>;
}

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const spec = WORKER[status];
  return <Badge variant={spec.variant}>{spec.label}</Badge>;
}

/** A fact's kind as a quiet mono word in its tone — no chip. */
export function KindWord({ kind, className }: { kind: FactKind; className?: string }) {
  return (
    <span className={cn("font-mono text-aux font-medium", TONE_TEXT[KIND[kind].tone], className)}>
      {kind}
    </span>
  );
}

/** The journal's marker: filled for something that happened, a ring for something said. */
export function KindDot({ kind, className }: { kind: FactKind; className?: string }) {
  const spec = KIND[kind];
  return (
    <span
      aria-hidden
      className={cn(
        "block size-2.5 rounded-full border-2",
        TONE_DOT[spec.tone],
        spec.said && "bg-background!",
        className,
      )}
    />
  );
}

/** A task's position, as a dot for list rows where a pill would shout. */
export function StateDot({ state, position }: { state: TaskState; position?: Position }) {
  const tone: Tone =
    state === "completed"
      ? "success"
      : state === "cancelled"
        ? "muted"
        : state === "created"
          ? "info"
          : position === "waiting"
            ? "muted"
            : position === "stuck"
              ? "warning"
              : position === "reported"
                ? "info"
                : "brand";
  const said = position === "stuck" || position === "reported";
  return (
    <span
      aria-hidden
      className={cn("block size-2.5 shrink-0 rounded-full border-2", TONE_DOT[tone], said && "bg-background!")}
    />
  );
}

export function stateLabel(state: TaskState, position?: Position): string {
  if (state === "taken" && position) return POSITION[position].label;
  return TASK_STATE[state].label;
}
