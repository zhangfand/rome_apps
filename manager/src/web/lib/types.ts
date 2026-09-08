/** Mirrors src/lib/view.ts across the API boundary. Keep the two in step. */

export type TaskState = "created" | "taken" | "completed" | "cancelled";
export type Position = "working" | "stuck" | "reported";
export type WorkerStatus = "running" | "returned" | "failed" | "lost";
export type FactKind =
  | "Created"
  | "Taken"
  | "Completed"
  | "Cancelled"
  | "Started"
  | "Returned"
  | "Failed"
  | "Lost"
  | "Question"
  | "Report"
  | "Reply";

export const FACT_KINDS: FactKind[] = [
  "Created",
  "Taken",
  "Completed",
  "Cancelled",
  "Started",
  "Returned",
  "Failed",
  "Lost",
  "Question",
  "Report",
  "Reply",
];

export interface FactSummary {
  seq: number;
  id: string;
  taskId: string;
  kind: FactKind;
  by: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  line: string;
}

export interface WorkerSummary {
  workerId: string;
  taskId: string;
  taskBrief: string;
  status: WorkerStatus;
  startedAt: string;
  endedAt?: string;
  ageMs: number;
  outcome?: string;
  startedSeq: number;
}

export interface TaskSummary {
  id: string;
  brief: string;
  state: TaskState;
  position?: Position;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  factCount: number;
  liveWorkerId?: string;
  startsSinceLastPersonFact: number;
  latest: FactSummary;
  attention?: { kind: "Question" | "Report"; text: string; evidence?: string };
  workers: WorkerSummary[];
}

export interface ManagerConfig {
  workingDir: string;
  workerAgent: string;
  startCap: number;
  maxWorkers: number;
  ageCapHours: number;
  intervalMinutes: number;
}

export interface DashboardView {
  now: string;
  configured: boolean;
  config?: ManagerConfig;
  lock: { name: string; held: boolean; heldUntil?: string };
  counts: {
    tasks: Record<TaskState, number>;
    positions: Record<Position, number>;
    workers: Record<WorkerStatus, number>;
    facts: number;
  };
  tasks: TaskSummary[];
  workers: WorkerSummary[];
  ledger: FactSummary[];
}

export interface TaskDetail {
  id: string;
  brief: string;
  state: TaskState;
  position?: Position;
  liveWorkerId?: string;
  startsSinceLastPersonFact: number;
  facts: FactSummary[];
  workers: WorkerSummary[];
}
