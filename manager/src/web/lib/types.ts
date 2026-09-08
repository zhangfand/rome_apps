/** Mirrors src/lib/view.ts across the API boundary. Keep the two in step. */

export type TaskState = "created" | "taken" | "completed" | "cancelled";
export type Position = "working" | "waiting" | "stuck" | "reported";
export type WorkerStatus = "running" | "returned" | "failed" | "lost";
export type FactKind =
  | "Bound"
  | "Created"
  | "Taken"
  | "Completed"
  | "Cancelled"
  | "Started"
  | "Opened"
  | "Restarted"
  | "Returned"
  | "Failed"
  | "Lost"
  | "Deferred"
  | "Question"
  | "Report"
  | "Reply";

export const FACT_KINDS: FactKind[] = [
  "Bound",
  "Created",
  "Taken",
  "Completed",
  "Cancelled",
  "Started",
  "Opened",
  "Restarted",
  "Returned",
  "Failed",
  "Lost",
  "Deferred",
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
  projectId?: string;
  workerId: string;
  taskId: string;
  taskBrief: string;
  status: WorkerStatus;
  startedAt: string;
  endedAt?: string;
  ageMs: number;
  outcome?: string;
  startedSeq: number;
  resumedSessionId?: string;
  workspace?: { commonDir: string; root: string; workingDir: string; branch: string; baseCommit: string };
  restarted?: { rejectedSessionId: string; error: string };
  sessionId?: string;
  romeSession?: { id: string; type: string };
}

export interface TaskSummary {
  projectId?: string;
  project?: { workingDir: string; repo?: string };
  id: string;
  brief: string;
  state: TaskState;
  position?: Position;
  waiting?: { reason: string; resumeAfter: string };
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
  projects?: Record<string, { workingDir: string; repo?: string }>;
  defaultProject?: string;
  workingDir: string;
  workerAgent: string;
  startCap: number;
  maxWorkers: number;
  ageCapHours: number;
  intervalMinutes: number;
}

export interface DashboardView {
  projects?: string[];
  projectId?: string;
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
  projectId?: string;
  project?: { workingDir: string; repo?: string };
  id: string;
  brief: string;
  state: TaskState;
  position?: Position;
  waiting?: { reason: string; resumeAfter: string };
  liveWorkerId?: string;
  startsSinceLastPersonFact: number;
  facts: FactSummary[];
  workers: WorkerSummary[];
}
