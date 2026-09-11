export interface FactJson {
  seq: number;
  id: string;
  taskId: string;
  kind: string;
  by: string;
  source?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TaskSummary {
  id: string;
  brief: string;
  projectId?: string;
  repo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  state: "open" | "completed" | "cancelled";
  liveWorker?: { workerId: string; agent: string; since: string };
  lastDecision?: FactJson;
  latest: FactJson;
  waiting?: { reason: string; resumeAfter: string };
  decisionsSinceLastPersonFact: number;
  needsAttention?: string;
  factCount: number;
}

export interface TaskDetailJson extends TaskSummary {
  facts: FactJson[];
}

export interface StateJson {
  now: string;
  configured: boolean;
  projects: Record<string, { workingDir: string; repo?: string }>;
  tickRunning: boolean;
  tasks: TaskSummary[];
  workers: Array<{ taskId: string; workerId: string; status: string; lastHeartbeatAt?: string; expiresAt?: string }>;
}

export interface ConfigJson {
  projects: Record<string, { workingDir: string; repo?: string; intakeLabel?: string; projectLabel?: string; intakeEnabled?: boolean; sop?: string }>;
  defaultProject?: string;
  sop: string;
  workerAgents: Record<string, string>;
  orchestratorAgent: string;
  maxWorkers: number;
  intervalMinutes: number;
  reuseSessions: boolean;
  intakeLabel: string;
  maxDecisionsPerTurn: number;
}
