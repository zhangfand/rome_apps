import { Badge } from "@rome-os/ui/badge";
import type { FactKind, Position, TaskState, WorkerStatus } from "../lib/types";

/**
 * Every categorical status in the app, mapped once onto the kit's semantic
 * badge variants so the same state reads the same everywhere.
 */

const TASK_STATE: Record<TaskState, { label: string; variant: "info" | "brand" | "success" | "muted" }> = {
  created: { label: "Created", variant: "info" },
  taken: { label: "Taken", variant: "brand" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const POSITION: Record<Position, { label: string; variant: "default" | "warning" | "info" }> = {
  working: { label: "Working", variant: "default" },
  stuck: { label: "Stuck — needs you", variant: "warning" },
  reported: { label: "Reported", variant: "info" },
};

const WORKER: Record<WorkerStatus, { label: string; variant: "brand" | "success" | "destructive" | "warning" }> = {
  running: { label: "Running", variant: "brand" },
  returned: { label: "Returned", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  lost: { label: "Lost", variant: "warning" },
};

const KIND: Record<FactKind, "default" | "info" | "success" | "warning" | "brand" | "destructive" | "muted" | "outline"> = {
  Created: "info",
  Taken: "brand",
  Completed: "success",
  Cancelled: "muted",
  Started: "default",
  Returned: "success",
  Failed: "destructive",
  Lost: "warning",
  Question: "warning",
  Report: "info",
  Reply: "outline",
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

export function KindBadge({ kind }: { kind: FactKind }) {
  return (
    <Badge variant={KIND[kind]} shape="square" className="font-mono text-[11px]">
      {kind}
    </Badge>
  );
}
