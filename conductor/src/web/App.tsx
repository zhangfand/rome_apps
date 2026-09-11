import "./styles.css";
import { useCallback, useEffect, useState } from "react";
import { fetchAppApi, getCurrentAppPath, navigateToApp, subscribeToAppPath, type RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { cn } from "@rome-os/ui/cn";
import { TaskList } from "./components/task-list";
import { TaskDetail } from "./components/task-detail";
import { Configuration } from "./components/configuration";
import type { StateJson } from "./lib/types";

const POLL_MS = 10_000;
type Page = "tasks" | "config";

function route(path: string): { page: Page; taskId: string | null } {
  const segment = path.replace(/^\/+|\/+$/g, "");
  if (!segment || segment === "tasks") return { page: "tasks", taskId: null };
  if (segment === "config") return { page: "config", taskId: null };
  return { page: "tasks", taskId: segment };
}

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [path, setPath] = useState(() => getCurrentAppPath());
  useEffect(() => subscribeToAppPath(setPath), []);
  const { page, taskId } = route(path);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Conductor</h1>
          <span className="text-sm text-muted-foreground">workflow as a prompt</span>
        </div>
        <nav className="flex gap-1">
          {(["tasks", "config"] as Page[]).map((p) => (
            <Button key={p} variant="ghost" size="sm" className={cn(page === p && !taskId && "bg-muted")} onClick={() => navigateToApp(`/${p}`)}>
              {p === "tasks" ? "Tasks" : "Configuration"}
            </Button>
          ))}
        </nav>
      </header>
      {taskId ? <TaskDetail key={taskId} taskId={taskId} /> : page === "config" ? <Configuration /> : <Tasks />}
    </main>
  );
}

function Tasks() {
  const [state, setState] = useState<StateJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetchAppApi("state");
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
      setState((await res.json()) as StateJson);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);
  const tick = async () => {
    setTicking(true);
    try { await fetchAppApi("tick", { method: "POST" }); await load(); } finally { setTicking(false); }
  };
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!state) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!state.configured) return <p className="text-sm text-muted-foreground">Not configured. Run <code>conductor:setup</code> with a projects map first.</p>;
  const open = state.tasks.filter((t) => t.state === "open");
  const closed = state.tasks.filter((t) => t.state !== "open");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {open.length} open · {closed.length} closed · {state.workers.length} worker{state.workers.length === 1 ? "" : "s"} live
          {state.tickRunning ? " · tick running" : ""}
        </p>
        <Button size="sm" variant="outline" onClick={tick} disabled={ticking}>{ticking ? "Ticking…" : "Tick now"}</Button>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Open</h2>
        <TaskList tasks={open} now={state.now} empty="No open tasks. Ask the conductor agent in chat, or label an issue in a watched repository." />
      </section>
      {closed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Closed</h2>
          <TaskList tasks={[...closed].reverse()} now={state.now} empty="" />
        </section>
      )}
    </div>
  );
}
