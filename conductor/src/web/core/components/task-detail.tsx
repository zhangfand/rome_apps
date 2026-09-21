import { Fragment, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { fetchAppApi, navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@rome-os/ui/card";
import { cn } from "@rome-os/ui/cn";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Spinner } from "@rome-os/ui/spinner";
import { Switch } from "@rome-os/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rome-os/ui/tabs";
import { Textarea } from "@rome-os/ui/textarea";
import { ExternalLink } from "lucide-react";
import { LightMarkdown } from "./light-markdown";
import {
  attentionText,
  activityAuthorLabel,
  authorLabel,
  authorLane,
  expandedTextLabel,
  factBody,
  factLabel,
  factTone,
  hasOutstandingPersonDecision,
  isRoutine,
  isSafetyEvent,
  latestText,
  safeText,
  taskTone,
  TONE_BADGE,
} from "../lib/facts";
import { formatRelative, formatStamp, formatTime } from "../lib/format";
import type { FactJson, TaskDetailJson, TaskSummary } from "../lib/types";
import { workerAgentNames, workerSessions, type WorkerSession } from "../lib/workers";
import { webDomain } from "../domain";
import { StateChip, taskTitle } from "./board";
import { WorkerLink } from "./worker-link";
import { useTaskUsageAnalysis } from "../lib/use-task-usage-analysis";
import { TaskUsageSummary } from "./task-usage";
import { TaskUsageExplorer } from "./task-usage-explorer";

type HistoryView = "Stream" | "Lanes" | "Table";
type DetailTab = "Overview" | "Activity" | "Usage" | "Work";
const VIEW_KEY = "conductor-history-view";
const VIEW_OPTIONS = (["Stream", "Lanes", "Table"] as HistoryView[]).map((value) => ({ value, label: value }));
const DETAIL_REPLIES = ["accepted, thanks", "please revise", "hold for now"];

export function TaskDetail({ taskId, onTaskChanged }: { taskId: string; onTaskChanged: (task: TaskSummary) => void }) {
  const [task, setTask] = useState<TaskDetailJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("Overview");
  const [composerOpen, setComposerOpen] = useState(false);
  const [openEntries, setOpenEntries] = useState<Set<number>>(() => new Set());
  const [historyView, setHistoryView] = useState<HistoryView>(readView);
  const [hideRoutine, setHideRoutine] = useState(true);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerInitialized = useRef(false);
  const usage = useTaskUsageAnalysis(task, detailTab === "Usage");

  const load = useCallback(async () => {
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}`);
      if (!response.ok) throw new Error("This task could not be read. Return to the board and try again.");
      const next = await response.json() as TaskDetailJson;
      setTask(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be read. Return to the board and try again.");
    }
  }, [taskId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 8_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_KEY, historyView); } catch { /* preference persistence is optional */ }
  }, [historyView]);

  useEffect(() => {
    if (!task || composerInitialized.current) return;
    composerInitialized.current = true;
    setComposerOpen(task.state === "open" && hasOutstandingPersonDecision(task));
  }, [task]);

  const send = async () => {
    if (!reply.trim() || !task) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: reply, seenSeq: task.latest.seq }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          await load();
          setError("This task changed before your reply was recorded. Review the new activity and send it again if it still applies.");
          return;
        }
        setError(await responseError(response));
        return;
      }
      setReply("");
      setComposerOpen(false);
      await load();
    } finally {
      setSending(false);
    }
  };

  const closeTask = async (action: "complete" | "cancel") => {
    if (!task) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seenSeq: task.latest.seq }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          await load();
          setError("This task changed before it could be closed. Review the new activity and try again if closing it still applies.");
          return;
        }
        setError(await responseError(response));
        return;
      }
      const next = await response.json() as TaskDetailJson;
      setTask(next);
      onTaskChanged(next);
    } finally {
      setSending(false);
    }
  };

  if (!task) {
    if (error) return <ErrorCard message={error} retry={load} />;
    return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading this task<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;
  }

  const visible = task.facts.filter((item) => !(hideRoutine && isRoutine(item)));
  const rounds = groupRounds(visible);
  const sessions = workerSessions(task.facts);
  const workerAgents = workerAgentNames(task.facts);
  const recent = task.facts.filter((item) => !isRoutine(item)).slice(-3).reverse();
  const now = Date.now();
  const created = task.facts.find((item) => item.kind === "Created");
  // Where the task came from, whichever source opened it. Facts written before
  // the ingest seam carry the older `issue` shape; both read the same here.
  const rawOrigin = created?.payload.origin ?? created?.payload.issue;
  const origin = rawOrigin && typeof rawOrigin === "object" ? rawOrigin as Record<string, unknown> : undefined;
  const originSource = typeof origin?.source === "string" ? origin.source : origin ? webDomain().legacyOriginSource : undefined;
  const originNumber = typeof origin?.number === "number"
    ? origin.number
    : typeof (origin?.data as Record<string, unknown> | undefined)?.number === "number"
      ? (origin!.data as Record<string, number>).number
      : undefined;
  const originLabel = originSource ? ` · ${safeText(originSource)}${originNumber !== undefined ? ` #${originNumber}` : ""}` : "";
  const from = origin ? task.createdBy : "you";
  const openComposer = () => {
    setDetailTab("Overview");
    setComposerOpen(true);
    window.setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      composerRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Button variant="ghost" size="xs" className="w-fit text-muted-foreground" onClick={() => navigateToApp("/")}>← back to board</Button>

      <section className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2.5 text-title">
            <StateChip label={task.state} tone={task.state === "open" ? "info" : taskTone(task)} />
            {taskTitle(task)}
            <Badge variant="outline">{task.id}</Badge>
          </h1>
          <div className="flex flex-wrap gap-3.5 text-aux text-muted-foreground">
          <span>{safeText(task.projectId ?? "no project")}{task.projectSubtitle ? ` · ${safeText(task.projectSubtitle)}` : ""}</span>
          <span>from {safeText(from)}{originLabel}</span>
          <span>opened {formatRelative(task.createdAt, now)}</span>
          </div>
        </div>
        <div>
          <Alert variant="info">
            <AlertTitle>Where it stands</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col items-start gap-2">
                <LightMarkdown markdown={whereItStands(task)} compact className="max-w-[78ch]" />
                {task.liveWorker?.romeSession && (
                  <WorkerLink
                    workerId={task.liveWorker.workerId}
                    session={task.liveWorker.romeSession}
                    label="Open worker session"
                    icon
                    className="text-aux"
                  />
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
        {task.state === "open" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openComposer}>Reply</Button>
            <Button variant="outline" disabled={sending} onClick={() => void closeTask("complete")}>Mark complete</Button>
            <Button variant="ghost" disabled={sending} onClick={() => void closeTask("cancel")}>Cancel task</Button>
          </div>
        )}
        {error && !composerOpen && <DetailError message={error} />}
      </section>

      <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as DetailTab)}>
        <div className="overflow-x-auto border-b border-border pb-1">
          <TabsList aria-label="Task detail sections">
            <TabsTrigger value="Overview">Overview</TabsTrigger>
            <TabsTrigger value="Activity">Activity <span className="text-current/55">{task.factCount}</span></TabsTrigger>
            <TabsTrigger value="Usage">Usage <span className="text-current/55">{task.usageSessions.length}</span></TabsTrigger>
            <TabsTrigger value="Work">Work</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="Overview" className="flex flex-col gap-4 pt-2">
          <OverviewMetrics task={task} workerCount={sessions.size} now={now} />
          <RecentActivity entries={recent} onViewAll={() => setDetailTab("Activity")} />
          {task.state === "open" && composerOpen && (
            <ReplyComposer
              composerRef={composerRef}
              reply={reply}
              setReply={setReply}
              sending={sending}
              error={error}
              onSend={send}
              onClose={() => setComposerOpen(false)}
            />
          )}
        </TabsContent>

        <TabsContent value="Activity" className="flex flex-col gap-3.5 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-title">What happened</h2>
              <span className="font-mono text-[11px] text-subtle-foreground">{task.facts.length} events</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-aux text-muted-foreground">
                <Switch checked={hideRoutine} onCheckedChange={setHideRoutine} />
                hide routine steps
              </label>
              <SegmentedControl options={VIEW_OPTIONS} value={historyView} onValueChange={setHistoryView} size="sm" aria-label="History view" />
            </div>
          </div>
          {historyView === "Stream" ? (
            <StreamView rounds={rounds} sessions={sessions} workerAgents={workerAgents} coordinatorAgent={task.coordinatorAgent} openEntries={openEntries} toggle={(seq) => setOpenEntries((current) => toggleSet(current, seq))} />
          ) : historyView === "Lanes" ? (
            <LanesView entries={visible} sessions={sessions} workerAgents={workerAgents} coordinatorAgent={task.coordinatorAgent} />
          ) : (
            <TableView entries={visible} sessions={sessions} workerAgents={workerAgents} coordinatorAgent={task.coordinatorAgent} openEntries={openEntries} toggle={(seq) => setOpenEntries((current) => toggleSet(current, seq))} />
          )}
        </TabsContent>

        <TabsContent value="Usage" className="flex flex-col gap-3.5 pt-2">
          <TaskUsageSummary usage={usage.analysis?.usage} loading={usage.loading} unavailable={usage.unavailable} />
          <TaskUsageExplorer task={task} analysis={usage.analysis} loading={usage.loading} unavailable={usage.unavailable} />
        </TabsContent>

        <TabsContent value="Work" className="flex flex-col gap-3.5 pt-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-title">Linked work</h2>
              <p className="mt-1 text-ui text-muted-foreground">Pull requests and other deliverables connected to this task appear here.</p>
            </div>
            {task.workRepo && (
              <Button asChild variant="outline" size="sm">
                <a href={task.workRepo.url} target="_blank" rel="noopener noreferrer" title={task.workRepo.repo}>
                  Open work repo <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </Button>
            )}
          </div>
          {webDomain().taskDetailPanels.map((Panel, index) => (
            <Panel key={Panel.displayName ?? Panel.name ?? index} taskId={taskId} task={task} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewMetrics({ task, workerCount, now }: { task: TaskDetailJson; workerCount: number; now: number }) {
  const items = [
    { label: "Events", value: task.factCount.toLocaleString() },
    { label: "Agent sessions", value: task.usageSessions.length.toLocaleString() },
    { label: "Workers", value: workerCount.toLocaleString() },
    { label: "Last update", value: formatRelative(task.updatedAt, now) },
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-8 border border-border sm:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className={cn("min-w-0 px-3.5 py-3", index > 0 && "sm:border-l sm:border-border", index % 2 === 1 && "border-l border-border", index >= 2 && "border-t border-border sm:border-t-0")}>
          <dt className="text-aux text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate font-mono text-[14px] font-semibold text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecentActivity({ entries, onViewAll }: { entries: FactJson[]; onViewAll: () => void }) {
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="recent-activity-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-activity-title" className="text-title">Recent activity</h2>
        <Button variant="link" size="xs" className="px-0" onClick={onViewAll}>View all activity</Button>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {entries.map((item, index) => {
          const content = factBody(item);
          return (
            <div key={item.seq} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3", index > 0 && "border-t border-border")}>
              <HistoryChip item={item} />
              <div className="min-w-0">
                {content.title && <div className="truncate text-ui font-semibold">{content.title}</div>}
                {content.body && <LightMarkdown markdown={content.body} compact className="line-clamp-2 text-ui text-muted-foreground" />}
              </div>
              <span className="whitespace-nowrap font-mono text-[10.5px] text-subtle-foreground">{formatTime(item.createdAt)}</span>
            </div>
          );
        })}
        {!entries.length && (
          <EmptyState>
            <EmptyStateTitle>No activity yet</EmptyStateTitle>
            <EmptyStateDescription>New task updates will appear here.</EmptyStateDescription>
          </EmptyState>
        )}
      </Card>
    </section>
  );
}

function ReplyComposer({ composerRef, reply, setReply, sending, error, onSend, onClose }: {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  reply: string;
  setReply: (value: string) => void;
  sending: boolean;
  error: string | null;
  onSend: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reply</CardTitle>
        <CardAction><Button variant="ghost" size="xs" onClick={onClose}>Close</Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {DETAIL_REPLIES.map((text) => <Button key={text} variant="outline" size="sm" onClick={() => setReply(text)}>{text}</Button>)}
      </CardContent>
      <CardContent>
        <Textarea ref={composerRef} className="min-h-[104px]" value={reply} onChange={(event) => setReply(event.target.value)} aria-label="Reply to this task" />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2.5">
        <Button className="w-fit" onClick={() => void onSend()} disabled={sending || !reply.trim()}>
          {sending && <Spinner />}
          {sending ? "Sending…" : "Send reply"}
        </Button>
        {error && <DetailError message={error} />}
      </CardFooter>
    </Card>
  );
}

function StreamView({ rounds, sessions, workerAgents, coordinatorAgent, openEntries, toggle }: { rounds: Array<{ stamp: string; entries: FactJson[] }>; sessions: ReadonlyMap<string, WorkerSession>; workerAgents: ReadonlyMap<string, string>; coordinatorAgent?: string; openEntries: Set<number>; toggle: (seq: number) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((round, index) => (
        <section key={`${round.stamp}-${index}`} className="flex flex-col gap-[7px]">
          <div className="flex items-center gap-[9px]">
            <span className="font-mono text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{formatTime(round.stamp)}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {round.entries.map((item) => {
            const content = factBody(item);
            const who = authorLabel(item.by, item.kind);
            return (
              <Card key={item.seq} className={cn("grid grid-cols-[80px_minmax(0,1fr)] gap-3 px-[22px] sm:grid-cols-[96px_minmax(0,1fr)]", isRoutine(item) && "bg-background")}>
                <div className="flex flex-col gap-[3px]">
                  <span className="font-mono text-[11px] text-subtle-foreground">#{item.seq} · {formatTime(item.createdAt)}</span>
                  {item.kind !== "Event" && (
                    <FactAuthor item={item} sessions={sessions} workerAgents={workerAgents} coordinatorAgent={coordinatorAgent} className={cn("font-mono text-[10.5px] font-semibold", who === "you" ? "text-info-fg" : who === "conductor" ? "text-foreground" : "text-muted-foreground")} />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-[5px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <HistoryChip item={item} />
                    {content.title && <HistoryTitle item={item} title={content.title} sessions={sessions} />}
                  </div>
                  {content.body && <LightMarkdown markdown={content.body} className="max-w-[76ch] text-[14.5px] leading-[1.6]" />}
                  {content.extra && (
                    <div>
                      <Button variant="link" size="xs" className="w-fit px-0 text-muted-foreground hover:text-foreground" aria-expanded={openEntries.has(item.seq)} onClick={() => toggle(item.seq)}>{openEntries.has(item.seq) ? "hide" : "show"} {expandedTextLabel(item)}</Button>
                      {openEntries.has(item.seq) && <pre className="mt-[7px] whitespace-pre-wrap rounded-lg bg-surface-muted p-2.5 font-mono text-[11.5px] leading-[1.55] shadow-[var(--inset-soft)]">{content.extra}</pre>}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ))}
      {!rounds.length && (
        <Card className="py-0">
          <EmptyState>
            <EmptyStateTitle>No events to show</EmptyStateTitle>
            <EmptyStateDescription>Turn off “hide routine steps” to see the full history.</EmptyStateDescription>
          </EmptyState>
        </Card>
      )}
    </div>
  );
}

function LanesView({ entries, sessions, workerAgents, coordinatorAgent }: { entries: FactJson[]; sessions: ReadonlyMap<string, WorkerSession>; workerAgents: ReadonlyMap<string, string>; coordinatorAgent?: string }) {
  const laneClass = { 1: "col-start-1", 2: "col-start-2", 3: "col-start-3", 4: "col-start-4" } as const;
  return (
    <Card className="overflow-x-auto px-3.5">
      <div className="min-w-[760px]">
        <div className="mb-2.5 grid grid-cols-4 gap-2.5 border-b border-border pb-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          <span>people &amp; sources</span><span>{coordinatorAgent || "coordinator"}</span><span>worker agents</span><span>world</span>
        </div>
        <div className="grid grid-cols-4 items-start gap-x-2.5 gap-y-2">
          {entries.map((item) => {
            const content = factBody(item);
            return (
              <Card key={item.seq} className={cn("min-w-0 gap-1.5 p-[14px]", isRoutine(item) && "bg-background", laneClass[authorLane(item)])}>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10.5px] text-subtle-foreground">#{item.seq}</span>
                  <HistoryChip item={item} />
                  {item.kind !== "Event" && (
                    <FactAuthor item={item} sessions={sessions} workerAgents={workerAgents} coordinatorAgent={coordinatorAgent} className="font-mono text-[10px] text-muted-foreground" />
                  )}
                  <span className="ml-auto font-mono text-[10px] text-subtle-foreground">{formatTime(item.createdAt)}</span>
                </div>
                <span className="truncate text-[12.5px] leading-[1.4] font-medium">{content.title || content.body || "Update"}</span>
              </Card>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function TableView({ entries, sessions, workerAgents, coordinatorAgent, openEntries, toggle }: { entries: FactJson[]; sessions: ReadonlyMap<string, WorkerSession>; workerAgents: ReadonlyMap<string, string>; coordinatorAgent?: string; openEntries: Set<number>; toggle: (seq: number) => void }) {
  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="w-[64px]">#</TableHead>
            <TableHead scope="col" className="w-[120px]">What</TableHead>
            <TableHead scope="col" className="w-[120px]">Who</TableHead>
            <TableHead scope="col">What it says</TableHead>
            <TableHead scope="col" className="w-[90px] text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((item) => {
            const content = factBody(item);
            const oneLine = [content.title, content.body].filter(Boolean).join(" — ") || "Update";
            const open = openEntries.has(item.seq);
            return (
              <Fragment key={item.seq}>
                <TableRow className="cursor-pointer" aria-expanded={open} onClick={() => toggle(item.seq)}>
                  <TableCell className="text-aux text-muted-foreground">#{item.seq}</TableCell>
                  <TableCell><HistoryChip item={item} /></TableCell>
                  <TableCell className="text-aux text-muted-foreground"><FactAuthor item={item} sessions={sessions} workerAgents={workerAgents} coordinatorAgent={coordinatorAgent} /></TableCell>
                  <TableCell className="max-w-0 truncate">{oneLine}</TableCell>
                  <TableCell className="text-right text-aux text-muted-foreground">{formatTime(item.createdAt)}</TableCell>
                </TableRow>
                {open && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="whitespace-normal">
                      <pre className="whitespace-pre-wrap rounded-lg bg-surface-muted p-2.5 font-mono text-[11.5px] leading-[1.55] shadow-[var(--inset-soft)]">{content.extra || oneLine}</pre>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function HistoryChip({ item }: { item: FactJson }) {
  return <Badge variant={TONE_BADGE[factTone(item)]} className="w-fit">{factLabel(item.kind)}</Badge>;
}

function FactAuthor({ item, sessions, workerAgents, coordinatorAgent, className }: { item: FactJson; sessions: ReadonlyMap<string, WorkerSession>; workerAgents: ReadonlyMap<string, string>; coordinatorAgent?: string; className?: string }) {
  const role = authorLabel(item.by, item.kind);
  const label = activityAuthorLabel(item, coordinatorAgent, workerAgents);
  if (role !== "worker") return <span className={className}>{label}</span>;
  return <WorkerLink workerId={item.by} session={sessions.get(item.by)} label={label} className={className} />;
}

function HistoryTitle({ item, title, sessions }: { item: FactJson; title: string; sessions: ReadonlyMap<string, WorkerSession> }) {
  const workerId = typeof item.payload.workerId === "string" ? item.payload.workerId : "";
  if (item.kind === "Dispatched" && workerId) {
    const agent = typeof item.payload.agent === "string" ? item.payload.agent : "";
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-[15px] font-semibold">
        <WorkerLink workerId={workerId} session={sessions.get(workerId)} label={workerId} />
        {agent ? <span>as {agent}</span> : null}
      </span>
    );
  }
  if (item.kind === "Opened" && workerId) {
    return <WorkerLink workerId={workerId} session={sessions.get(workerId)} label={title} icon className="text-[15px] font-semibold" />;
  }
  return <span className="text-[15px] font-semibold">{title}</span>;
}

function whereItStands(task: TaskDetailJson): string {
  if (task.state === "completed") return `This task is complete. ${latestText(task)}`;
  if (task.state === "cancelled") return `This task was cancelled. ${latestText(task)}`;
  if (task.liveWorker) return `Work is moving now. ${latestText(task)}`;
  if (task.pendingJob) return `Job ${task.pendingJob.jobId} is queued for ${task.pendingJob.agent}. Runtime will choose a worker when capacity is available.`;
  if (task.waiting) return `${safeText(task.waiting.reason)} It will continue after ${formatStamp(task.waiting.resumeAfter)}.`;
  if (isSafetyEvent(task.latest)) return `${factBody(task.latest).title}. ${attentionText(task)}`;
  if (hasOutstandingPersonDecision(task) && task.lastDecision?.kind === "Asked") return `${attentionText(task)} Conductor is waiting for your answer.`;
  if (hasOutstandingPersonDecision(task) && task.lastDecision?.kind === "Reported") return `${attentionText(task)} Conductor is waiting for your reply. Nothing is running.`;
  if (task.latest.kind === "Reply" && task.needsAttention) return `Your reply was sent. Conductor is picking it up now.`;
  return `${latestText(task)} Nothing is running right now.`;
}

function groupRounds(entries: FactJson[]): Array<{ stamp: string; entries: FactJson[] }> {
  const groups: Array<{ stamp: string; entries: FactJson[] }> = [];
  let current: { stamp: string; entries: FactJson[] } | undefined;
  for (const item of entries) {
    if (!current) {
      current = { stamp: item.createdAt, entries: [] };
      groups.push(current);
    }
    current.entries.push(item);
    if (authorLabel(item.by, item.kind) === "conductor") current = undefined;
  }
  return groups;
}

function toggleSet(current: Set<number>, value: number): Set<number> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

function readView(): HistoryView {
  try {
    const value = window.localStorage.getItem(VIEW_KEY);
    if (value === "Stream" || value === "Lanes" || value === "Table") return value;
  } catch { /* use the default */ }
  return "Stream";
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error ?? `The request did not finish (HTTP ${response.status}). Try again.`;
}

function DetailError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{safeText(message)}</AlertDescription>
    </Alert>
  );
}

function ErrorCard({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <Alert variant="destructive" className="max-w-[70ch]">
      <AlertTitle>This task could not be read.</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {safeText(message)}
        <Button variant="outline" onClick={() => void retry()}>Try again</Button>
      </AlertDescription>
    </Alert>
  );
}
