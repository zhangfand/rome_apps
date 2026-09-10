import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAppApi, getCurrentAppPath, navigateToApp, subscribeToAppPath, type RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@rome-os/ui/dropdown-menu";
import { ChevronDown, RefreshCw, TriangleAlert } from "lucide-react";
import { Ledger } from "./components/ledger";
import { TaskDetail } from "./components/task-detail";
import { TaskList } from "./components/task-list";
import { WorkerTable } from "./components/worker-table";
import { Board } from "./components/board";
import { ConfigurationEditor, SettingRow } from "./components/configuration";
import { Overview } from "./components/overview";
import { handleOf, nameWorkers } from "./lib/domain";
import { useNow } from "./lib/format";
import type { DashboardView } from "./lib/types";

const POLL_MS = 15_000;
const LEDGER_LIMIT = 300;
export type Page = "overview" | "tasks" | "board" | "history" | "workers" | "ledger" | "diagnostics" | "status";
const PAGES: Page[] = ["overview", "tasks", "board", "history", "workers", "ledger", "diagnostics", "status"];
const MORE: Array<{ page: Page; label: string }> = [
  { page: "history", label: "History" }, { page: "diagnostics", label: "Configuration" },
  { page: "status", label: "Runtime status" },
  { page: "workers", label: "Workers" }, { page: "ledger", label: "Ledger" },
];

export function dashboardRoute(route: string): { page: Page; taskId: string | null } {
  const segment = route.replace(/^\/+|\/+$/g, "");
  return !segment ? { page: "overview", taskId: null }
    : PAGES.includes(segment as Page) ? { page: segment as Page, taskId: null }
    : { page: "overview", taskId: segment };
}

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [route, setRoute] = useState(() => getCurrentAppPath());
  useEffect(() => subscribeToAppPath(setRoute), []);
  const { page, taskId } = dashboardRoute(route);
  return <main className={`mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6 md:pt-5${taskId ? " min-h-dvh pb-0 md:pb-0" : ""}`}>
    {taskId ? <TaskDetail key={taskId} taskId={taskId} /> : <Dashboard page={page} />}
  </main>;
}

function Dashboard({ page }: { page: Page }) {
  const [projectId, setProjectId] = useState("");
  const requestId = useRef(0);
  const [view, setView] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number>();
  const now = useNow();
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    try {
      const res = await fetchAppApi(`state?ledgerLimit=${LEDGER_LIMIT}&projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const next = await res.json() as DashboardView;
      if (request !== requestId.current) return;
      setView(next); setFetchedAt(Date.now()); setError(null);
    } catch (e) {
      if (request === requestId.current) setError(e instanceof Error ? e.message : String(e));
    } finally { if (request === requestId.current) setLoading(false); }
  }, [projectId]);
  useEffect(() => {
    void load();
    const tick = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { requestId.current++; clearInterval(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [load]);
  const changeProject = (value: string) => {
    // Never label the previous project's tasks as the new selection while loading.
    requestId.current++; setView(null); setFetchedAt(undefined); setError(null); setProjectId(value);
  };
  return <DashboardScreen page={page} view={view} projectId={projectId} onProject={changeProject}
    loading={loading} warning={error ?? (fetchedAt && now - fetchedAt > 3 * 60_000 ? "Dashboard data is over 3 minutes old." : undefined)} retry={() => void load()} />;
}

/** Rendering is separate from polling so the navigation/content contract is testable. */
export function DashboardScreen({ page, view, projectId, onProject, loading, warning, retry }: {
  page: Page; view: DashboardView | null; projectId: string; onProject: (id: string) => void;
  loading: boolean; warning?: string | null; retry: () => void;
}) {
  const handles = useMemo(() => new Map((view?.tasks ?? []).map((t) => [t.id, handleOf(t)])), [view]);
  const names = useMemo(() => nameWorkers(view?.tasks ?? []), [view]);
  const showProject = !projectId && (view?.projects?.length ?? 0) > 1;
  const go = (next: Page) => navigateToApp(next === "overview" ? "" : next, { replace: true });
  return <>
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border pb-3">
      <h1 className="text-title">Manager</h1>
      {view && (view.projects?.length ?? 0) > 1 && page !== "board" ? (
        <Select value={projectId ? `project:${projectId}` : "all"} onValueChange={(value) => onProject(value === "all" ? "" : value.slice(8))}>
          <SelectTrigger size="sm" className="w-auto max-w-48" aria-label="Filter by project">
            <SelectValue>{projectId || "All projects"}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="all">All projects</SelectItem>
            {view.projects!.map((id) => <SelectItem key={id} value={`project:${id}`}>{id}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : null}
      <nav aria-label="Manager navigation" className="flex flex-wrap items-center gap-1 md:ml-auto">
        {([{ page: "overview", label: "Overview" }, { page: "tasks", label: "All tasks" }, { page: "board", label: "Board" }] as const).map((item) =>
          <Button key={item.page} size="sm" variant="ghost" aria-current={page === item.page ? "page" : undefined}
            className={cn("px-2", page === item.page && "bg-surface-muted")} onClick={() => go(item.page)}>{item.label}</Button>)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className={cn("px-2", MORE.some((m) => m.page === page) && "bg-surface-muted")}>More<ChevronDown className="size-3" aria-hidden /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => go("history")}>History</DropdownMenuItem>
            <DropdownMenuSeparator /><DropdownMenuLabel>Manager</DropdownMenuLabel>
            {MORE.slice(1).map((item) => <DropdownMenuItem key={item.page} onSelect={() => go(item.page)}>{item.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <DashboardFreshness loading={loading} warning={warning} retry={retry} />
    </header>
    {!view ? <div className="py-6 text-ui text-muted-foreground" role={warning ? "alert" : undefined}>
      {warning ? <>Could not load Manager. <Button variant="ghost" size="sm" onClick={retry}>Try again</Button></> : "Loading tasks…"}
    </div> : <>
      {!view.configured ? <p role="status" className="text-ui text-warning-fg">Manager is not configured. <button type="button" className="underline" onClick={() => go("diagnostics")}>Open configuration instructions</button></p> : null}
      {page === "overview" ? <Overview tasks={view.tasks} names={names} showProject={showProject} /> : null}
      {page === "tasks" || page === "history" ? <TaskList key={page} tasks={view.tasks} showProject={showProject} history={page === "history"} /> : null}
      {page === "board" ? <Board /> : null}
      {page === "workers" ? <section className="flex flex-col gap-3"><h2 className="text-section">Workers</h2><WorkerTable workers={view.workers} names={names} handles={handles} /></section> : null}
      {page === "ledger" ? <section className="flex flex-col gap-3"><h2 className="text-section">Ledger</h2><p className="text-aux text-muted-foreground">Newest {view.ledger.length} of {view.counts.facts} entries. Open a task for its full history.</p><Ledger facts={view.ledger} names={names} taskNames={handles} /></section> : null}
      {page === "diagnostics" ? <Configuration view={view} onSaved={retry} /> : null}
      {page === "status" ? <RuntimeStatus view={view} /> : null}
    </>}
  </>;
}

export function DashboardFreshness({ loading, warning, retry }: { loading: boolean; warning?: string | null; retry: () => void }) {
  if (loading) return <span role="status" aria-label="Refreshing dashboard" className="inline-flex text-muted-foreground"><RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /></span>;
  if (!warning) return null;
  return <Button variant="ghost" size="xs" onClick={retry} title={`${warning} Click to retry.`} aria-label={`${warning} Retry loading dashboard.`}><TriangleAlert className="size-3.5 text-warning-fg" aria-hidden /></Button>;
}

function Configuration({ view, onSaved }: { view: DashboardView; onSaved: () => void }) {
  const config = view.config;
  return <section className="flex flex-col gap-6" aria-label="Configuration">
    <h2 className="text-section">Configuration</h2>
    {config ? <ConfigurationEditor onSaved={onSaved} /> : <p className="text-ui">Run <code>manager:setup</code> with a project directory to configure workers and the reconcile schedule.</p>}
    {config ? <section aria-label="Infrastructure settings">
      <h3 className="text-section">Infrastructure</h3>
      <div className="mt-2 divide-y divide-border">
        <SettingRow title="Worker agent" hint="Read-only here. Changing agents needs session compatibility planning via manager:setup."><span className="text-ui">{config.workerAgent}</span></SettingRow>
        <SettingRow title="Reconcile interval" hint="Read-only here. Changing cadence replaces the scheduled routine via manager:setup."><span className="text-ui">{config.intervalMinutes} minutes</span></SettingRow>
        <SettingRow title="Project IDs" hint="Use manager:setup to add, remove, or rename projects."><span className="text-ui break-words">{Object.keys(config.projects ?? { default: {} }).join(", ")}</span></SettingRow>
      </div>
    </section> : null}
  </section>;
}

function RuntimeStatus({ view }: { view: DashboardView }) {
  const rows: Array<[string, string | number]> = [
    ["Open tasks", view.counts.tasks.created + view.counts.tasks.taken], ["Completed / cancelled", view.counts.tasks.completed + view.counts.tasks.cancelled],
    ["Ledger entries", view.counts.facts], ["Running workers in this view", view.counts.workers.running], ["Reconcile lock", view.lock.held ? "Held" : "Free"],
  ];
  return <section className="flex flex-col gap-4" aria-label="Runtime status">
    <h2 className="text-section">Runtime status</h2>
    <p className="text-aux text-muted-foreground">Task, worker, and ledger counts follow the selected project. The reconcile lock is shared across all projects.</p>
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map(([label, value]) => <div key={label}><dt className="text-aux text-muted-foreground">{label}</dt><dd className="mt-1 text-ui break-words">{value}</dd></div>)}
    </dl>
  </section>;
}
