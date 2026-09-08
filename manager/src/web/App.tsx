import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAppApi,
  getCurrentAppPath,
  navigateToApp,
  subscribeToAppPath,
  type RomeAppBootstrap,
} from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { Spinner } from "@rome-os/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rome-os/ui/tabs";
import { Check, RefreshCw } from "lucide-react";
import { AttentionPanel } from "./components/attention";
import { Ledger } from "./components/ledger";
import { TaskDetail } from "./components/task-detail";
import { TaskList } from "./components/task-list";
import { WorkerTable } from "./components/worker-table";
import { Board } from "./components/board";
import { type TaskHandle, handleOf, nameWorkers, shortPath } from "./lib/domain";
import { formatRelative, useNow } from "./lib/format";
import type { DashboardView } from "./lib/types";

const POLL_MS = 15_000;
const LEDGER_LIMIT = 300;

type Tab = "tasks" | "board" | "workers" | "ledger";
const TABS: Tab[] = ["tasks", "board", "workers", "ledger"];

/**
 * Routes:
 *   ""            the dashboard, Tasks tab
 *   "workers"     the dashboard, Workers tab
 *   "ledger"      the dashboard, Ledger tab
 *   "board"       GitHub epics joined to Manager tasks
 *   "<taskId>"    one task
 */
export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [route, setRoute] = useState<string>(() => getCurrentAppPath());
  useEffect(() => subscribeToAppPath(setRoute), []);

  const segment = route.replace(/^\/+|\/+$/g, "");
  const tab: Tab = (TABS as string[]).includes(segment) ? (segment as Tab) : "tasks";
  const taskId = segment && !(TABS as string[]).includes(segment) ? segment : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6 md:pt-5">
      {taskId ? <TaskDetail taskId={taskId} /> : <Dashboard tab={tab} />}
    </main>
  );
}

function Dashboard({ tab }: { tab: Tab }) {
  const [projectId, setProjectId] = useState("");
  const requestId = useRef(0);
  const [view, setView] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const res = await fetchAppApi(`state?ledgerLimit=${LEDGER_LIMIT}&projectId=${encodeURIComponent(projectId)}`);
      if (request !== requestId.current) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const next = (await res.json()) as DashboardView;
      if (request !== requestId.current) return;
      setView(next);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (e) {
      if (request !== requestId.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      requestId.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // The guardian's names for things, derived once per snapshot.
  const handles = useMemo(() => {
    const map = new Map<string, TaskHandle>();
    for (const task of view?.tasks ?? []) map.set(task.id, handleOf(task));
    return map;
  }, [view]);
  const names = useMemo(() => nameWorkers(view?.tasks ?? []), [view]);

  const attention = useMemo(
    () =>
      (view?.tasks ?? [])
        .filter((t) => t.attention !== undefined)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [view],
  );

  const tabHref = (t: Tab) => (t === "tasks" ? "" : t);

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-title">Manager</h1>
          <div className="flex items-center gap-3">
            {view?.lock.held ? (
              <span
                className="inline-flex items-center gap-1.5 text-aux text-muted-foreground"
                title={`Reconcile lock held until ${view.lock.heldUntil}`}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-brand" />
                </span>
                reconciling
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="-mr-2 px-2 font-normal text-muted-foreground hover:text-foreground"
              title="Refreshes every 15 seconds and when you come back — click to refresh now"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
              <span className="tabular-nums">
                {loading ? "Refreshing…" : fetchedAt ? formatRelative(fetchedAt, now) : "Not loaded"}
              </span>
            </Button>
          </div>
        </div>
        {view ? <Tally view={view} /> : null}
        {view?.config ? <ConfigLine view={view} /> : null}
        {view?.projects?.length && tab !== "board" ? (
          <label className="flex items-center gap-2 text-aux text-muted-foreground">
            Project
            <select aria-label="Filter by project" value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="max-w-full rounded-6 border border-border bg-surface px-2 py-1 text-ui text-foreground focus-visible:outline-2 focus-visible:outline-ring">
              <option value="">All projects</option>
              {view.projects.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        ) : null}
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not read the ledger</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {view && !view.configured ? (
        <Alert variant="warning">
          <AlertTitle>Manager is not set up</AlertTitle>
          <AlertDescription>
            Run <code className="font-mono">manager:setup</code> with a <code className="font-mono">workingDir</code>{" "}
            so the reconcile routine exists and workers know where to work.
          </AlertDescription>
        </Alert>
      ) : null}

      {!view && !error ? (
        <div className="flex items-center gap-2 py-10 text-ui text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : null}

      {view ? (
        <>
          <section aria-labelledby="needs-you" className="flex flex-col gap-3">
            <h2 id="needs-you" className="flex items-baseline gap-2 text-section">
              Needs you
              {attention.length > 0 ? (
                <span className="text-aux font-normal text-warning-fg tabular-nums">{attention.length}</span>
              ) : null}
            </h2>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-ui text-muted-foreground">
                <Check className="size-4 text-success" aria-hidden />
                {quietLine(view)}
              </p>
            ) : (
              attention.map((task) => (
                <AttentionPanel
                  key={task.id}
                  taskId={task.id}
                  projectId={task.projectId}
                  handle={handles.get(task.id) ?? handleOf(task)}
                  brief={task.brief}
                  kind={task.attention!.kind}
                  text={task.attention!.text}
                  evidence={task.attention!.evidence}
                  updatedAt={task.updatedAt}
                  names={names}
                />
              ))
            )}
          </section>

          <Tabs value={tab} onValueChange={(v) => navigateTab(tabHref(v as Tab))}>
            <TabsList>
              <TabsTrigger value="tasks">
                Tasks
                <Count n={view.counts.tasks.created + view.counts.tasks.taken} />
              </TabsTrigger>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="workers">
                Workers
                <Count n={view.counts.workers.running} />
              </TabsTrigger>
              <TabsTrigger value="ledger">
                Ledger
                <Count n={view.counts.facts} />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="mt-3">
              <TaskList tasks={view.tasks} handles={handles} names={names} />
            </TabsContent>
            <TabsContent value="board" className="mt-3">
              <Board />
            </TabsContent>
            <TabsContent value="workers" className="mt-3">
              <WorkerTable workers={view.workers} names={names} handles={handles} />
            </TabsContent>
            <TabsContent value="ledger" className="mt-3">
              {view.counts.facts > view.ledger.length ? (
                <p className="mb-2 text-aux text-muted-foreground">
                  The newest {view.ledger.length} of {view.counts.facts} facts. Open a task for its full history.
                </p>
              ) : null}
              <Ledger facts={view.ledger} names={names} taskNames={handles} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </>
  );
}

function navigateTab(path: string) {
  navigateToApp(path, { replace: true });
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-4 bg-surface-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
      {n}
    </span>
  );
}

/** What to say when nothing is waiting on the guardian. Emptiness as direction. */
function quietLine(view: DashboardView): string {
  const running = view.counts.workers.running;
  const open = view.counts.tasks.created + view.counts.tasks.taken;
  if (open === 0) return "Nothing is waiting on you, and nothing is open. Tell the manager what you want in chat.";
  if (running === 0) return `Nothing is waiting on you. ${open} ${open === 1 ? "task is" : "tasks are"} open; the runtime will continue eligible work automatically.`;
  return `Nothing is waiting on you. ${running} ${running === 1 ? "worker is" : "workers are"} running across ${open} open ${open === 1 ? "task" : "tasks"}.`;
}

/**
 * The numbers as one line of prose-like tallies: value in the foreground,
 * label muted, and only the count that asks for the guardian gets a colour.
 */
function Tally({ view }: { view: DashboardView }) {
  const { counts, config } = view;
  const needs = counts.positions.stuck + counts.positions.reported;
  const cells: { label: string; value: string | number; hint: string; tone?: "warning" }[] = [
    { label: "open", value: counts.tasks.created + counts.tasks.taken, hint: "Created + Taken" },
    { label: "working", value: counts.positions.working, hint: "Taken tasks with a worker on them" },
    { label: "waiting", value: counts.positions.waiting, hint: "Unfinished tasks scheduled for an automatic revisit" },
    {
      label: needs === 1 ? "needs you" : "need you",
      value: needs,
      hint: "Stuck on a question or holding a report",
      tone: needs > 0 ? "warning" : undefined,
    },
    {
      label: "running",
      value: config ? `${counts.workers.running} of ${config.maxWorkers}` : counts.workers.running,
      hint: "Workers in this view over the global cap across all projects",
    },
    { label: "closed", value: counts.tasks.completed + counts.tasks.cancelled, hint: "Completed + Cancelled" },
    { label: "facts", value: counts.facts, hint: "Rows in the append-only ledger" },
  ];

  return (
    <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-ui">
      {cells.map((cell, i) => (
        <div key={cell.label} className="flex items-baseline gap-1.5" title={cell.hint}>
          {i > 0 ? <span className="mr-2.5 text-subtle-foreground select-none" aria-hidden>·</span> : null}
          <dd className={cn("font-medium tabular-nums", cell.tone === "warning" ? "text-warning-fg" : "text-foreground")}>
            {cell.value}
          </dd>
          <dt className={cn(cell.tone === "warning" ? "text-warning-fg" : "text-muted-foreground")}>{cell.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function ConfigLine({ view }: { view: DashboardView }) {
  const c = view.config!;
  return (
    <p className="text-aux text-subtle-foreground">
      {c.projects ? `${Object.keys(c.projects).length} projects · default directory ` : "Working in "}
      <span className="font-mono text-muted-foreground" title={c.workingDir}>
        {shortPath(c.workingDir)}
      </span>{" "}
      with <span className="font-mono text-muted-foreground">{c.workerAgent}</span> · up to {c.maxWorkers} workers ·{" "}
      {c.startCap} attempt retry limit · lost after {c.ageCapHours}h of silence · reconciles every {c.intervalMinutes}m
    </p>
  );
}
