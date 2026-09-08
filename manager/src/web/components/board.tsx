import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAppApi, navigateRome, navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rome-os/ui/dropdown-menu";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { Spinner } from "@rome-os/ui/spinner";
import {
  CircleCheck,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Github,
  ListFilter,
  Lock,
  Play,
  RefreshCw,
  Unplug,
} from "lucide-react";
import type { BoardIssue, BoardState, BoardStatus } from "../../lib/board.js";
import type { BoardEpic, PullRequestSummary } from "../../lib/board-snapshot.js";
import { PositionBadge } from "./badges";
import { WorkerLink } from "./worker-link";
import { nameWorkers, type WorkerNames } from "../lib/domain";
import { formatRelative, useNow } from "../lib/format";
import type { TaskSummary } from "../lib/types";

interface RepositoryOption {
  fullName: string;
  private: boolean;
  archived: boolean;
}

interface BoardPayload {
  selectedRepo: string | null;
  snapshot: BoardState | null;
  managerTasks: TaskSummary[];
}

const COLUMNS: Array<{
  status: BoardStatus;
  label: string;
  hint: string;
  dot: string;
  empty: string;
}> = [
  { status: "ready", label: "Ready", hint: "Open with every known blocker closed", dot: "bg-success", empty: "Nothing is ready." },
  { status: "in-progress", label: "In Progress", hint: "Named by an open Manager task", dot: "bg-brand", empty: "Nothing is in progress." },
  { status: "blocked", label: "Blocked", hint: "Waiting on an open known blocker", dot: "bg-warning", empty: "Nothing is blocked." },
  { status: "done", label: "Done", hint: "Closed on GitHub", dot: "bg-muted-foreground", empty: "Nothing is done yet." },
];

const DEFAULT_STATUSES: BoardStatus[] = ["ready", "in-progress", "blocked"];
const STATUS_STORAGE = "manager:board-statuses";
const AUTO_REFRESH_MS = 5 * 60_000;

class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function readApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchAppApi(path, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!response.ok) throw new ApiError(payload.message ?? payload.error ?? `HTTP ${response.status}`, payload.error);
  return payload;
}

function savedStatuses(): BoardStatus[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STATUS_STORAGE) ?? "null") as unknown;
    if (!Array.isArray(value)) return DEFAULT_STATUSES;
    const valid = COLUMNS.map((column) => column.status).filter((status) => value.includes(status));
    return valid.length ? valid : DEFAULT_STATUSES;
  } catch {
    return DEFAULT_STATUSES;
  }
}

export function Board() {
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [snapshot, setSnapshot] = useState<BoardState | null>(null);
  const [managerTasks, setManagerTasks] = useState<TaskSummary[]>([]);
  const [selectedEpic, setSelectedEpic] = useState("");
  const [visibleStatuses, setVisibleStatuses] = useState<BoardStatus[]>(savedStatuses);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const activeRepo = useRef("");
  const now = useNow();

  const loadState = useCallback(async (repo?: string) => {
    const query = repo ? `?repo=${encodeURIComponent(repo)}` : "";
    const payload = await readApi<BoardPayload>(`board/state${query}`);
    const selected = payload.selectedRepo ?? "";
    if (repo && activeRepo.current !== repo) return selected;
    activeRepo.current = selected;
    setSelectedRepo(selected);
    setSnapshot(payload.snapshot);
    setManagerTasks(payload.managerTasks);
    return selected;
  }, []);

  const sync = useCallback(async (repo: string) => {
    if (!repo) return;
    setSyncing(true);
    setError(null);
    try {
      await readApi("board/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      if (activeRepo.current === repo) await loadState(repo);
    } catch (cause) {
      // Do not clear snapshot: the latest successful sync remains useful.
      setError(cause instanceof ApiError ? cause : new ApiError(cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setSyncing(false);
    }
  }, [loadState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const selected = await loadState();
        setLoading(false);
        void readApi<{ repositories: RepositoryOption[] }>("board/repositories")
          .then((payload) => { if (!cancelled) setRepositories(payload.repositories); })
          .catch((cause) => { if (!cancelled) setError(cause instanceof ApiError ? cause : new ApiError(String(cause))); });
        if (!cancelled && selected) void sync(selected);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause : new ApiError(cause instanceof Error ? cause.message : String(cause)));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loadState, sync]);

  useEffect(() => {
    const refresh = () => {
      const repo = activeRepo.current;
      if (repo && document.visibilityState === "visible") void sync(repo);
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [sync]);

  const epics = useMemo(() => (snapshot?.epics ?? []).filter((epic) => epic.state === "OPEN"), [snapshot]);
  useEffect(() => {
    setSelectedEpic((current) => epics.some((epic) => epic.id === current) ? current : epics[0]?.id ?? "");
  }, [epics]);

  const names = useMemo(() => nameWorkers(managerTasks), [managerTasks]);
  const currentEpic = epics.find((epic) => epic.id === selectedEpic);
  const members = useMemo(() => {
    if (!snapshot || !currentEpic) return [];
    const ids = new Set(currentEpic.issueIds);
    return snapshot.nodes.filter((issue) => ids.has(issue.id));
  }, [currentEpic, snapshot]);

  const columns = COLUMNS
    .filter((column) => visibleStatuses.includes(column.status))
    .map((column) => ({ ...column, issues: members.filter((issue) => issue.boardStatus === column.status) }));

  async function chooseRepo(repo: string) {
    activeRepo.current = repo;
    setSelectedRepo(repo);
    setSnapshot(null);
    setManagerTasks([]);
    setSelectedEpic("");
    setError(null);
    try {
      await readApi("board/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      // Selection returns the stored raw snapshot. Read board/state next so
      // cached cards are joined to the current ledger even if refresh fails.
      if (activeRepo.current === repo) await loadState(repo);
      void sync(repo);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(cause instanceof Error ? cause.message : String(cause)));
    }
  }

  function toggleStatus(status: BoardStatus, checked: boolean) {
    setVisibleStatuses((current) => {
      if (!checked && current.length === 1 && current.includes(status)) return current;
      const set = new Set(current);
      if (checked) set.add(status);
      else set.delete(status);
      const next = COLUMNS.map((column) => column.status).filter((value) => set.has(value));
      try { window.localStorage.setItem(STATUS_STORAGE, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedRepo || undefined} onValueChange={(repo) => void chooseRepo(repo)}>
          <SelectTrigger className="w-[260px] max-w-full" aria-label="Repository">
            <Github className="size-4 text-muted-foreground" />
            <SelectValue placeholder="Choose a repository" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {repositories.map((repo) => (
              <SelectItem key={repo.fullName} value={repo.fullName} disabled={repo.archived}>
                {repo.fullName}{repo.archived ? " (archived)" : repo.private ? " (private)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEpic || undefined} onValueChange={setSelectedEpic} disabled={epics.length === 0}>
          <SelectTrigger className="w-[260px] max-w-full" aria-label="Epic">
            <SelectValue placeholder="Choose an epic" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {epics.map((epic) => (
              <SelectItem key={epic.id} value={epic.id}>
                {epic.title} ({epic.openCount}/{epic.openCount + epic.closedCount} open)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ListFilter /> States <span className="text-muted-foreground">{visibleStatuses.length}/4</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuLabel>Show board states</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.map((column) => {
              const checked = visibleStatuses.includes(column.status);
              return (
                <DropdownMenuCheckboxItem
                  key={column.status}
                  checked={checked}
                  disabled={checked && visibleStatuses.length === 1}
                  onCheckedChange={(value) => toggleStatus(column.status, value === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className={`size-2 rounded-full ${column.dot}`} /> {column.label}
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {members.filter((issue) => issue.boardStatus === column.status).length}
                  </span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          disabled={!selectedRepo || syncing}
          onClick={() => void sync(selectedRepo)}
          className="ml-auto font-normal text-muted-foreground"
        >
          <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Refreshing…" : snapshot ? formatRelative(snapshot.syncedAt, now) : "Not synced"}
        </Button>
      </div>

      {error?.code === "github_connection_required" ? (
        <Alert variant="destructive">
          <Unplug className="size-4" />
          <AlertTitle>Reconnect GitHub</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => navigateRome({ path: "settings", tab: "integrations" })}>
              Open integrations
            </Button>
          </AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive"><AlertTitle>Board refresh failed</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-ui text-muted-foreground"><Spinner className="size-4" /> Loading board…</div>
      ) : !selectedRepo ? (
        <EmptyState className="py-12"><EmptyStateTitle>Choose a repository</EmptyStateTitle><EmptyStateDescription>GitHub Projects linked to it become epics.</EmptyStateDescription></EmptyState>
      ) : !snapshot ? (
        <EmptyState className="py-12"><EmptyStateTitle>No saved board yet</EmptyStateTitle><EmptyStateDescription>{syncing ? "Reading GitHub…" : "Refresh to build the first snapshot."}</EmptyStateDescription></EmptyState>
      ) : epics.length === 0 ? (
        <EmptyState className="py-12"><EmptyStateTitle>No active epics</EmptyStateTitle><EmptyStateDescription>No open Project is linked and no untriaged issue was found.</EmptyStateDescription></EmptyState>
      ) : currentEpic && members.length === 0 ? (
        <EmptyState className="py-12"><EmptyStateTitle>This epic is empty</EmptyStateTitle><EmptyStateDescription>No GitHub issue items are in it.</EmptyStateDescription></EmptyState>
      ) : (
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <section key={column.status} className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-12 border border-border bg-surface-muted/50">
              <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5" title={column.hint}>
                <span className={`size-2 rounded-full ${column.dot}`} />
                <h3 className="text-ui font-medium">{column.label}</h3>
                <Badge variant="muted" className="ml-auto tabular-nums">{column.issues.length}</Badge>
              </header>
              <div className="flex flex-col gap-2 p-2">
                {column.issues.length ? column.issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} snapshot={snapshot} names={names} />
                )) : <p className="px-2 py-8 text-center text-aux text-muted-foreground">{column.empty}</p>}
              </div>
            </section>
          ))}
        </div>
      )}

      {snapshot?.warnings.map((warning) => <p key={warning} className="text-aux text-muted-foreground">{warning}</p>)}
    </div>
  );
}

function IssueCard({ issue, snapshot, names }: { issue: BoardIssue; snapshot: BoardState; names: WorkerNames }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blockers = issue.blockedBy.map((id) => snapshot.nodes.find((node) => node.id === id)).filter(Boolean) as BoardIssue[];

  async function implement() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const payload = await readApi<{ taskId?: string }>("board/implement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id }),
      });
      if (!payload.taskId) throw new Error("Manager did not return a task id.");
      navigateToApp(payload.taskId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStarting(false);
    }
  }

  return (
    <Card className={`gap-0 overflow-hidden py-0 shadow-sm ${issue.state === "CLOSED" ? "opacity-70" : ""}`}>
      <CardHeader className="gap-1.5 border-b border-border px-3 py-3">
        <div className="flex items-center gap-2 text-aux text-muted-foreground">
          <span>{issue.external ? `${issue.repo} · ` : ""}#{issue.number}</span>
          {issue.state === "CLOSED" ? <CircleCheck className="ml-auto size-3.5" /> : null}
        </div>
        <CardTitle className="text-ui leading-snug">
          <a href={issue.url} target="_blank" rel="noreferrer noopener" className="hover:underline">
            {issue.title} <ExternalLink className="inline size-3 text-muted-foreground" />
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-3 py-3">
        {issue.pullRequests.length ? (
          <div className="flex flex-wrap gap-1.5">
            {issue.pullRequests.map((pr) => <PullRequestLink key={`${pr.repo}#${pr.number}`} pr={pr} />)}
          </div>
        ) : null}
        {blockers.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-aux text-muted-foreground">
            <Lock className="size-3.5" /> Blocked by
            {blockers.map((blocker) => (
              <a key={blocker.id} href={blocker.url} target="_blank" rel="noreferrer noopener" className={blocker.state === "CLOSED" ? "line-through" : "text-foreground hover:underline"}>
                {blocker.repo === issue.repo ? `#${blocker.number}` : `${blocker.repo}#${blocker.number}`}
              </a>
            ))}
          </div>
        ) : null}
        {issue.managerTask ? (
          <div className="flex flex-wrap items-center gap-2">
            {issue.managerTask.position ? <PositionBadge position={issue.managerTask.position} /> : null}
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigateToApp(issue.managerTask!.taskId)}>
              Open task
            </Button>
            {issue.managerTask.liveWorkerId ? (
              <span className="ml-auto text-aux text-muted-foreground">
                <WorkerLink names={names} workerId={issue.managerTask.liveWorkerId} icon />
              </span>
            ) : null}
          </div>
        ) : issue.boardStatus === "ready" ? (
          <Button size="sm" onClick={() => void implement()} disabled={starting}>
            <Play /> {starting ? "Starting…" : "Implement"}
          </Button>
        ) : null}
        {error ? <p className="text-aux text-destructive-fg">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function PullRequestLink({ pr }: { pr: PullRequestSummary }) {
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer noopener"
      title={`${pr.repo} PR #${pr.number} · ${pr.title}`}
      className="inline-flex items-center gap-1 rounded-4 bg-surface-muted px-1.5 py-0.5 text-aux text-muted-foreground hover:text-foreground"
    >
      {pr.state === "MERGED" ? <GitMerge className="size-3.5" /> : <GitPullRequest className="size-3.5" />}
      {pr.repo}#{pr.number}
    </a>
  );
}
