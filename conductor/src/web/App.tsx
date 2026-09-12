import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAppApi, getCurrentAppPath, navigateToApp, subscribeToAppPath, type RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { cn } from "@rome-os/ui/cn";
import { ActionButton } from "./components/ui-bits";
import { Board } from "./components/board";
import { Configuration } from "./components/configuration";
import { TaskDetail } from "./components/task-detail";
import { TaskList } from "./components/task-list";
import { bucketTask } from "./lib/facts";
import type { StateJson, TaskSummary } from "./lib/types";

const POLL_MS = 10_000;
const FRESH_MS = 60_000;
type Page = "board" | "tasks" | "config" | "detail";

function route(path: string): { page: Page; taskId: string | null } {
  const segment = path.replace(/^\/+|\/+$/g, "");
  if (!segment) return { page: "board", taskId: null };
  if (segment === "tasks") return { page: "tasks", taskId: null };
  if (segment === "config") return { page: "config", taskId: null };
  return { page: "detail", taskId: segment };
}

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [path, setPath] = useState(() => getCurrentAppPath());
  const { page, taskId } = route(path);
  const feed = useStateFeed();
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => subscribeToAppPath(setPath), []);
  useEffect(() => {
    if (page !== "board") return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [page]);

  const counts = useMemo(() => {
    const tasks = feed.state?.tasks ?? [];
    return {
      needsYou: tasks.filter((task) => bucketTask(task) === "needs-you").length,
      total: tasks.length,
    };
  }, [feed.state]);

  return (
    <main className="conductor-root mx-auto flex w-full max-w-[1060px] flex-col gap-4 px-5 pt-7 pb-20 text-foreground sm:px-8 sm:pt-9 md:px-11 md:pt-10 md:pb-[104px]">
      <header className="flex flex-wrap items-center justify-between gap-5">
        <h1 className="text-[19px] leading-6 font-semibold tracking-[-0.02em]">Conductor</h1>
      </header>
      <nav className="flex items-stretch gap-0.5 border-b border-border" aria-label="Conductor pages">
        <NavItem active={page === "board"} onClick={() => navigateToApp("/")}>
          Board
          {counts.needsYou > 0 && <span className="inline-flex h-[17px] items-center rounded-full bg-warning-bg px-1.5 font-mono text-[10.5px] font-semibold text-warning-fg">{counts.needsYou}</span>}
        </NavItem>
        <NavItem active={page === "tasks"} onClick={() => navigateToApp("/tasks")}>
          Tasks
          <span className="font-mono text-[10.5px] text-subtle-foreground">{counts.total}</span>
        </NavItem>
        <NavItem active={page === "config"} onClick={() => navigateToApp("/config")}>SOP &amp; runtime</NavItem>
      </nav>

      {page === "detail" && taskId ? (
        <TaskDetail key={taskId} taskId={taskId} onTaskChanged={feed.updateTask} />
      ) : page === "config" ? (
        <Configuration />
      ) : page === "tasks" ? (
        <StateGate feed={feed}>
          {(state) => <TaskList tasks={state.tasks} now={state.now} freshIds={feed.freshIds} />}
        </StateGate>
      ) : (
        <StateGate feed={feed} board>
          {(state) => <Board state={state} now={clock} freshIds={feed.freshIds} reload={feed.load} updateTask={feed.updateTask} />}
        </StateGate>
      )}
    </main>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex h-[34px] items-center gap-[7px] border-0 border-b-2 px-3 text-[13px] font-semibold transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-classical)] outline-none hover:bg-surface-hover active:translate-y-px focus-visible:border-ring focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-ring",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface Feed {
  state: StateJson | null;
  error: string | null;
  load: () => Promise<void>;
  updateTask: (task: TaskSummary) => void;
  freshIds: Set<string>;
}

function StateGate({ feed, board = false, children }: { feed: Feed; board?: boolean; children: (state: StateJson) => React.ReactNode }) {
  if (feed.error) {
    return (
      <div className="flex max-w-[70ch] flex-col gap-3 rounded-[14px] border border-destructive-border bg-destructive-bg p-5 text-foreground">
        <strong className="text-[15px] font-semibold text-destructive-fg">I couldn't read this app's history.</strong>
        <p className="text-sm leading-[1.55]">The app's database did not answer. Nothing has been removed. Try again, and if it keeps failing, check that the app is running.</p>
        <ActionButton variant="outline" className="w-fit border-border-strong bg-surface hover:bg-surface-hover" onClick={() => void feed.load()}>Try again</ActionButton>
      </div>
    );
  }
  if (!feed.state) {
    return (
      <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">
        reading this app's history<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span>
      </p>
    );
  }
  if (!feed.state.configured) {
    return board ? (
      <div className="flex max-w-[64ch] flex-col gap-3.5 py-10">
        <h2 className="font-serif text-[32px] font-medium tracking-[-0.015em]">Nothing to conduct yet.</h2>
        <p className="text-[15px] leading-[1.6] text-muted-foreground">Point Conductor at a working directory and a repository, and it will take in labeled issues from there.</p>
        <pre className="overflow-x-auto rounded-[10px] border border-border bg-surface-muted px-[18px] py-4 font-mono text-[12.5px] leading-[1.7] shadow-[var(--inset-soft)]">{`conductor:setup {
  projects: { playground: {
    workingDir: "/abs/path",
    repo: "owner/name",
    intakeLabel: "conductor" } }
}`}</pre>
      </div>
    ) : <p className="text-sm text-muted-foreground">Nothing to list yet. Run <code className="rounded bg-surface-muted px-1.5 font-mono">conductor:setup</code> first.</p>;
  }
  return <>{children(feed.state)}</>;
}

function useStateFeed(): Feed {
  const [state, setState] = useState<StateJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const previous = useRef<Map<string, Pick<TaskSummary, "updatedAt" | "factCount">> | null>(null);
  const timers = useRef(new Map<string, number>());

  const markFresh = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFreshIds((current) => new Set([...current, ...ids]));
    for (const id of ids) {
      const oldTimer = timers.current.get(id);
      if (oldTimer) window.clearTimeout(oldTimer);
      timers.current.set(id, window.setTimeout(() => {
        setFreshIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        timers.current.delete(id);
      }, FRESH_MS));
    }
  }, []);

  const accept = useCallback((next: StateJson) => {
    const incoming = new Map(next.tasks.map((task) => [task.id, { updatedAt: task.updatedAt, factCount: task.factCount }]));
    if (previous.current) {
      markFresh(next.tasks.filter((task) => {
        const before = previous.current?.get(task.id);
        return !before || before.updatedAt !== task.updatedAt || before.factCount !== task.factCount;
      }).map((task) => task.id));
    }
    previous.current = incoming;
    setState(next);
    setError(null);
  }, [markFresh]);

  const load = useCallback(async () => {
    try {
      const response = await fetchAppApi("state");
      if (!response.ok) throw new Error("state_unavailable");
      accept(await response.json() as StateJson);
    } catch {
      setError("state_unavailable");
    }
  }, [accept]);

  const updateTask = useCallback((task: TaskSummary) => {
    setState((current) => current ? { ...current, now: new Date().toISOString(), tasks: current.tasks.map((item) => item.id === task.id ? task : item) } : current);
    previous.current?.set(task.id, { updatedAt: task.updatedAt, factCount: task.factCount });
    markFresh([task.id]);
  }, [markFresh]);

  useEffect(() => {
    void load();
    const poller = window.setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poller);
      window.removeEventListener("focus", onFocus);
      for (const timer of timers.current.values()) window.clearTimeout(timer);
    };
  }, [load]);

  return { state, error, load, updateTask, freshIds };
}
