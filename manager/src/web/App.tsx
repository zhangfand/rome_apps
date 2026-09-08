import "./styles.css";
import { useCallback, useEffect, useState } from "react";
import {
  fetchAppApi,
  getCurrentAppPath,
  navigateToApp,
  subscribeToAppPath,
  type RomeAppBootstrap,
} from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent } from "@rome-os/ui/card";
import { Spinner } from "@rome-os/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rome-os/ui/tabs";
import { Lock, RefreshCw } from "lucide-react";
import { Ledger } from "./components/ledger";
import { TaskDetail } from "./components/task-detail";
import { TaskList } from "./components/task-list";
import { WorkerTable } from "./components/worker-table";
import { formatRelative, useNow } from "./lib/format";
import type { DashboardView } from "./lib/types";

const POLL_MS = 15_000;
const LEDGER_LIMIT = 300;

type Tab = "tasks" | "workers" | "ledger";
const TABS: Tab[] = ["tasks", "workers", "ledger"];

/**
 * Routes:
 *   ""            the dashboard, Tasks tab
 *   "workers"     the dashboard, Workers tab
 *   "ledger"      the dashboard, Ledger tab
 *   "<taskId>"    one task
 */
export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [route, setRoute] = useState<string>(() => getCurrentAppPath());
  useEffect(() => subscribeToAppPath(setRoute), []);

  const segment = route.replace(/^\/+|\/+$/g, "");
  const tab: Tab = (TABS as string[]).includes(segment) ? (segment as Tab) : "tasks";
  const taskId = segment && !(TABS as string[]).includes(segment) ? segment : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      {taskId ? <TaskDetail taskId={taskId} /> : <Dashboard tab={tab} />}
    </main>
  );
}

function Dashboard({ tab }: { tab: Tab }) {
  const [view, setView] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAppApi(`state?ledgerLimit=${LEDGER_LIMIT}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setView((await res.json()) as DashboardView);
      setFetchedAt(new Date().toISOString());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const tabHref = (t: Tab) => (t === "tasks" ? "" : t);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Manager</h1>
          <p className="text-sm text-muted-foreground">
            Tasks, the workers on them, and the ledger they are folded from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view?.lock.held ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              title={`Reconcile lock held until ${view.lock.heldUntil}`}
            >
              <Lock className="size-3.5" aria-hidden /> reconciling
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="px-2 font-normal text-muted-foreground hover:text-foreground"
            title="Auto-refreshes every 15 seconds and on focus — click to refresh now"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            <span className="tabular-nums">
              {loading ? "Refreshing…" : fetchedAt ? formatRelative(fetchedAt, now) : "Not loaded"}
            </span>
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the ledger</AlertTitle>
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
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : null}

      {view ? (
        <>
          <SummaryStrip view={view} />

          <Tabs value={tab} onValueChange={(v) => navigateTab(tabHref(v as Tab))}>
            <TabsList>
              <TabsTrigger value="tasks">
                Tasks
                <Count n={view.counts.tasks.created + view.counts.tasks.taken} />
              </TabsTrigger>
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
              <TaskList tasks={view.tasks} />
            </TabsContent>
            <TabsContent value="workers" className="mt-3">
              <WorkerTable workers={view.workers} />
            </TabsContent>
            <TabsContent value="ledger" className="mt-3">
              {view.counts.facts > view.ledger.length ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  Showing the newest {view.ledger.length} of {view.counts.facts} facts. Open a task
                  for its full history.
                </p>
              ) : null}
              <Ledger facts={view.ledger} />
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
  return <span className="ml-1.5 rounded-sm bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{n}</span>;
}

function SummaryStrip({ view }: { view: DashboardView }) {
  const { counts, config } = view;
  const cells: { label: string; value: string | number; hint?: string }[] = [
    { label: "Open", value: counts.tasks.created + counts.tasks.taken, hint: "Created + Taken" },
    { label: "Working", value: counts.positions.working, hint: "Taken tasks with a worker on them" },
    { label: "Needs you", value: counts.positions.stuck + counts.positions.reported, hint: "Stuck on a question or holding a report" },
    {
      label: "Running workers",
      value: config ? `${counts.workers.running} / ${config.maxWorkers}` : counts.workers.running,
      hint: "Live workers over the configured cap",
    },
    { label: "Closed", value: counts.tasks.completed + counts.tasks.cancelled, hint: "Completed + Cancelled" },
    { label: "Facts", value: counts.facts, hint: "Rows in the append-only ledger" },
  ];

  return (
    <Card className="py-3">
      <CardContent className="flex flex-col gap-3 px-4">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 md:grid-cols-6">
          {cells.map((cell) => (
            <div key={cell.label} title={cell.hint}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{cell.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{cell.value}</dd>
            </div>
          ))}
        </dl>
        {config ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
            <span>
              workingDir <span className="font-mono text-foreground/80">{config.workingDir}</span>
            </span>
            <span>
              worker <span className="font-mono text-foreground/80">{config.workerAgent}</span>
            </span>
            <span>start cap {config.startCap}</span>
            <span>age cap {config.ageCapHours}h</span>
            <span>reconcile every {config.intervalMinutes}m</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
