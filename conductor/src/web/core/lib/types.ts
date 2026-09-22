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
  workRepo?: { repo: string; url: string };
  createdBy: string;
  /** Agent id configured to coordinate this task (for example conductor:engineer-lead). */
  coordinatorAgent?: string;
  replay?: {
    sourceTaskId: string;
    sourceThroughSeq: number;
    coordinatorAgent: string;
    seed: string;
    workRepoPath: string;
  };
  /** Conductor-owned logical identity whose one Agent Session coordinates this Task. */
  coordinatorInstance?: {
    id: string;
    agent: string;
    status: "active" | "broken" | "retired";
    sessionId?: string;
    deliveredThroughSeq?: number;
  };
  createdAt: string;
  updatedAt: string;
  state: "open" | "completed" | "cancelled";
  liveWorker?: {
    jobId?: string;
    workerId: string;
    agent: string;
    since: string;
    romeSession?: { id: string; type: string };
  };
  pendingJob?: {
    jobId: string;
    agent: string;
    since: string;
  };
  lastDecision?: FactJson;
  latest: FactJson;
  waiting?: { reason: string; resumeAfter: string };
  decisionsSinceLastPersonFact: number;
  needsAttention?: string;
  factCount: number;
  /** Rome sessions whose accounting rolls up to this Task. */
  usageSessions: TaskUsageSession[];
}

export interface TaskUsageSession {
  id: string;
  type: string;
  role: "coordinator" | "worker" | "compactor";
  agent?: string;
  workerId?: string;
  jobId?: string;
  triggerSeq?: number;
  resultSeq?: number;
  firstSeenAt: string;
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
  runtimePaused: boolean;
  tasks: TaskSummary[];
  workers: Array<{ taskId: string; workerId: string; status: string; lastHeartbeatAt?: string; expiresAt?: string }>;
}

export interface ConfigJson {
  projects: Record<string, { workingDir?: string; workspace?: string; [extension: string]: unknown }>;
  defaultProject?: string;
  workerAgents: Record<string, string>;
  orchestratorAgent: string;
  maxWorkers: number;
  intervalMinutes: number;
  reuseSessions: boolean;
  maxDecisionsPerTurn: number;
}

export interface ProjectPresentation { repo?: string; subtitle?: string; workRepo?: { repo: string; url: string }; sourceEnabled?: boolean; sourceLabel?: string; sourceValue?: string; emptySubtitle?: string }

export interface RuntimeJson {
  heartbeatLeaseSeconds: number;
  workspaceKinds: string[];
  defaultWorkspaceKind: string;
  paused: boolean;
  pauseChangedAt?: string;
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

export interface DirectoryBrowserListing {
  path: string;
  parent?: string;
  entries: Array<{ name: string; path: string }>;
  shortcuts: Array<{ label: string; path: string }>;
}

export type FrontdeskShadowStatus = "running" | "completed" | "error" | "skipped_missing_api_key";

export interface FrontdeskShadowDecision {
  intent: "create_task" | "reply_to_task" | "complete_task" | "cancel_task" | "ask_status" | "other" | "ambiguous";
  targetTask: string;
  project: string;
  explicitAcceptance: number;
  explicitCancellation: number;
  answersLatestQuestion: number;
  needsGeneratedResponse: number;
  confidence: { intent: number; targetTask: number; project: number };
}

export interface FrontdeskShadowRun {
  id: string;
  createdAt: string;
  completedAt?: string;
  status: FrontdeskShadowStatus;
  input: string;
  state: {
    message: string;
    tasks: Array<{ id: string; brief: string; projectId?: string; latestDecision?: string; recent: string[] }>;
    projects: string[];
  };
  model?: string;
  decision?: FrontdeskShadowDecision;
  actual: { kind?: string; taskId?: string; projectId?: string };
  matched?: boolean;
  mismatch?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedInputCostUsd?: number;
  latencyMs?: number;
  error?: string;
}

export interface FrontdeskShadowReport {
  summary: {
    returned: number;
    running: number;
    completed: number;
    compared: number;
    matched: number;
    mismatched: number;
    errors: number;
    skippedMissingApiKey: number;
    matchRate?: number;
    inputTokens: number;
    estimatedInputCostUsd: number;
    averageLatencyMs?: number;
  };
  runs: FrontdeskShadowRun[];
}
