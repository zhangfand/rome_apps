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
  projectSubtitle?: string;
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
  projects: Record<string, { workingDir?: string; repo?: string; workspace?: string }>;
  maxWorkers: number;
  tickRunning: boolean;
  tasks: TaskSummary[];
  workers: Array<{ taskId: string; workerId: string; status: string; lastHeartbeatAt?: string; expiresAt?: string }>;
}

export interface ConfigJson {
  projects: Record<string, { workingDir?: string; workspace?: string; sop?: string; [extension: string]: unknown }>;
  defaultProject?: string;
  sop: string;
  workerAgents: Record<string, string>;
  orchestratorAgent: string;
  maxWorkers: number;
  intervalMinutes: number;
  reuseSessions: boolean;
  maxDecisionsPerTurn: number;
}

export interface ProjectPresentation { repo?: string; subtitle?: string; sourceEnabled?: boolean; sourceLabel?: string; emptySubtitle?: string }

export interface RuntimeJson {
  heartbeatLeaseSeconds: number;
  workspaceKinds: string[];
  defaultWorkspaceKind: string;
}

export interface WorkspaceInspection {
  exists: boolean;
  isRepository: boolean;
  root?: string;
  originUrl?: string;
  originRepo?: string;
  defaultBranch?: string;
  dirty?: boolean;
  problem?: string;
}
