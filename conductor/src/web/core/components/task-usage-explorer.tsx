import { useMemo, useState } from "react";
import { Badge } from "@rome-os/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Spinner } from "@rome-os/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { cn } from "@rome-os/ui/cn";
import type { FactJson, TaskDetailJson } from "../lib/types.js";
import type { SessionUsageAnalysis, TaskUsageAnalysis } from "../lib/task-usage-analysis.js";
import { formatCost, formatTokens, type SessionRecord } from "../lib/task-usage.js";
import { formatDuration } from "../lib/format.js";
import { WorkerLink } from "./worker-link.js";

type View = "Waterfall" | "Icicle" | "Hotspots";
const VIEW_OPTIONS = (["Waterfall", "Icicle", "Hotspots"] as View[]).map((value) => ({ value, label: value }));
const SEGMENT_TONES = [
  "bg-primary/20 text-foreground",
  "bg-info-bg text-info-fg",
  "bg-warning-bg text-warning-fg",
  "bg-success-bg text-success-fg",
  "bg-surface-muted text-muted-foreground",
] as const;

export function TaskUsageExplorer({ task, analysis, loading, unavailable }: {
  task: TaskDetailJson;
  analysis: TaskUsageAnalysis | null;
  loading: boolean;
  unavailable: boolean;
}) {
  const [view, setView] = useState<View>("Waterfall");
  if (!task.usageSessions.length) return null;
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Why it cost this much</CardTitle>
          <p className="mt-1 text-aux text-muted-foreground">Follow causal handoffs, inspect hierarchical contribution, or rank the largest runs.</p>
        </div>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onValueChange={setView} size="sm" aria-label="Token analysis view" />
      </CardHeader>
      {loading && !analysis ? (
        <CardContent className="flex items-center gap-2 text-ui text-muted-foreground"><Spinner /> reading turn traces and models…</CardContent>
      ) : unavailable || !analysis ? (
        <CardContent className="text-ui text-muted-foreground">Deep session accounting is temporarily unavailable. The totals above remain available.</CardContent>
      ) : (
        <>
          <WhySummary analysis={analysis} />
          <ModelBreakdown analysis={analysis} />
          {view === "Waterfall" ? <Waterfall task={task} analysis={analysis} />
            : view === "Icicle" ? <Icicle analysis={analysis} />
              : <Hotspots task={task} analysis={analysis} />}
        </>
      )}
    </Card>
  );
}

function WhySummary({ analysis }: { analysis: TaskUsageAnalysis }) {
  const total = analysis.usage.totalTokens || 1;
  const cacheShare = analysis.usage.cacheReadTokens / total;
  const coordinatorShare = analysis.usage.coordinator.totalTokens / total;
  const jobs = new Map<string, number>();
  for (const session of analysis.sessions) if (session.ref.jobId) jobs.set(session.ref.jobId, (jobs.get(session.ref.jobId) ?? 0) + 1);
  const retryRuns = [...jobs.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const largest = [...analysis.sessions].sort((a, b) => sessionTokens(b) - sessionTokens(a))[0];
  return (
    <CardContent className="grid gap-2 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
      <Insight label="Context replay" value={`${Math.round(cacheShare * 100)}% cache read`} detail={cacheShare >= 0.75 ? "Most volume is repeated context, not newly generated text." : "Context reuse is not the dominant source."} />
      <Insight label="Coordination" value={`${Math.round(coordinatorShare * 100)}% of tokens`} detail={`${formatTokens(analysis.usage.coordinator.totalTokens)} in coordinator wakes.`} />
      <Insight label="Retries" value={`${retryRuns} extra attempt${retryRuns === 1 ? "" : "s"}`} detail={retryRuns ? "Multiple sessions were opened for the same Job." : "No repeated Job sessions were linked."} />
      <Insight label="Largest contributor" value={largest ? stageLabel(largest) : "—"} detail={largest ? `${formatTokens(sessionTokens(largest))} · ${sessionModels(largest)}` : "No session accounting."} />
    </CardContent>
  );
}

function Insight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-8 border border-border bg-surface-muted/45 px-3 py-2.5">
      <div className="text-aux text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-ui font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</div>
    </div>
  );
}

function ModelBreakdown({ analysis }: { analysis: TaskUsageAnalysis }) {
  if (!analysis.models.length) return null;
  const total = analysis.usage.totalTokens || 1;
  return (
    <CardContent className="border-t pt-4">
      <div className="mb-2 text-aux font-semibold tracking-[0.08em] text-subtle-foreground uppercase">Models</div>
      <div className="flex flex-wrap gap-2">
        {analysis.models.map((model) => (
          <div key={model.key} className="min-w-[180px] flex-1 rounded-8 border border-border px-3 py-2 sm:max-w-[260px]">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[12px] font-semibold text-foreground">{model.label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{Math.round(model.usage.totalTokens / total * 100)}%</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
              <span>{model.provider ?? "unknown provider"}</span>
              <span>{formatTokens(model.usage.totalTokens, true)} tokens</span>
              <span>{formatCost(model.usage.costUsd ?? undefined)}</span>
              <span>{model.runCount} run{model.runCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  );
}

function Waterfall({ task, analysis }: { task: TaskDetailJson; analysis: TaskUsageAnalysis }) {
  const facts = new Map(task.facts.map((fact) => [fact.seq, fact]));
  const ordered = [...analysis.sessions].sort((a, b) => a.ref.firstSeenAt.localeCompare(b.ref.firstSeenAt));
  const max = Math.max(1, ...ordered.map(sessionTokens));
  const attempts = attemptCounts(analysis.sessions);
  return (
    <CardContent className="border-t pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <Legend tone="bg-muted-foreground/35" label="uncached input" />
        <Legend tone="bg-primary/55" label="cache read/write" />
        <Legend tone="bg-success/65" label="output" />
        <span>Bar width = session tokens · rows follow causal time</span>
      </div>
      <div className="flex flex-col gap-2">
        {ordered.map((session, index) => {
          const total = sessionTokens(session);
          const usage = session.record?.stats.usage;
          const width = Math.max(10, total / max * 100);
          const trigger = session.ref.triggerSeq ? facts.get(session.ref.triggerSeq) : undefined;
          const result = session.ref.resultSeq ? facts.get(session.ref.resultSeq) : undefined;
          return (
            <div key={session.ref.id} className="grid gap-1.5 rounded-8 border border-border px-3 py-2.5 md:grid-cols-[132px_minmax(0,1fr)]">
              <div className="flex items-start gap-2 md:flex-col md:gap-0.5">
                <Badge variant={session.ref.role === "coordinator" ? "brand" : "outline"}>{stageLabel(session)}</Badge>
                <span className="font-mono text-[10px] text-subtle-foreground">{index + 1} / {ordered.length}</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-aux">
                  <span className="text-muted-foreground">{trigger ? factRef(trigger) : "session opened"}</span>
                  <span aria-hidden>→</span>
                  <strong className="font-mono font-semibold text-foreground">{sessionModels(session)}</strong>
                  {attempts.get(session.ref.jobId ?? "")! > 1 && <Badge variant="warning">retry</Badge>}
                  <span aria-hidden>→</span>
                  <span className="text-muted-foreground">{result ? factRef(result) : "in progress / unlinked result"}</span>
                </div>
                <div className="mt-2 h-3 max-w-full overflow-hidden rounded-full bg-surface-muted" style={{ width: `${width}%` }} title={usageTitle(session)}>
                  {usage && <UsageBar usage={usage} />}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <strong className="font-mono font-semibold text-foreground">{formatTokens(total)}</strong>
                  <span>{formatCost(usage?.costUsd ?? undefined)}</span>
                  <span>{session.record?.stats.runCount ?? session.turns.length} model run{(session.record?.stats.runCount ?? session.turns.length) === 1 ? "" : "s"}</span>
                  {session.turns.reduce((sum, turn) => sum + (turn.durationMs ?? 0), 0) > 0 && <span>{formatDuration(session.turns.reduce((sum, turn) => sum + (turn.durationMs ?? 0), 0))}</span>}
                  <WorkerLink workerId={session.ref.workerId ?? "coordinator"} session={{ id: session.ref.id, type: session.ref.type }} label="open session" icon />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CardContent>
  );
}

function Icicle({ analysis }: { analysis: TaskUsageAnalysis }) {
  const sessions = analysis.sessions.filter((session) => sessionTokens(session) > 0);
  const roles = groupSegments(sessions, (session) => session.ref.role === "coordinator" ? "Coordinator" : "Workers");
  const agents = groupSegments(sessions, (session) => `${session.ref.role === "coordinator" ? "Coordinator" : "Worker"} · ${session.ref.agent ?? "unknown agent"}`);
  const models = groupSegments(sessions, sessionModels);
  return (
    <CardContent className="border-t pt-4">
      <p className="mb-3 text-aux text-muted-foreground">Width is proportional to token contribution. Read downward from Task → role → agent → model → session.</p>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[720px] rounded-8 border border-border p-2">
          <IcicleRow label="Task" segments={[{ key: "task", label: "Task total", tokens: analysis.usage.totalTokens, detail: `${formatTokens(analysis.usage.totalTokens)} tokens` }]} depth={0} total={analysis.usage.totalTokens} />
          <IcicleRow label="Role" segments={roles} depth={1} total={analysis.usage.totalTokens} />
          <IcicleRow label="Agent" segments={agents} depth={2} total={analysis.usage.totalTokens} />
          <IcicleRow label="Model" segments={models} depth={3} total={analysis.usage.totalTokens} />
          <IcicleRow label="Session" segments={sessions.map((session) => ({
            key: session.ref.id,
            label: shortStage(session),
            tokens: sessionTokens(session),
            detail: `${stageLabel(session)} · ${sessionModels(session)} · ${formatTokens(sessionTokens(session))}`,
          }))} depth={4} total={analysis.usage.totalTokens} />
        </div>
      </div>
    </CardContent>
  );
}

interface IcicleSegment { key: string; label: string; tokens: number; detail: string }

function IcicleRow({ label, segments, depth, total }: { label: string; segments: IcicleSegment[]; depth: number; total: number }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-stretch gap-2 border-b border-border-subtle last:border-0">
      <div className="flex items-center py-2 font-mono text-[10px] text-subtle-foreground uppercase">{label}</div>
      <div className="flex min-h-10 gap-px py-1">
        {segments.map((segment, index) => {
          const share = total ? segment.tokens / total : 0;
          return (
            <div
              key={segment.key}
              title={`${segment.detail} · ${Math.round(share * 100)}%`}
              className={cn("flex min-w-[2px] items-center overflow-hidden rounded-4 px-1.5 text-[10px] font-medium", SEGMENT_TONES[(index + depth) % SEGMENT_TONES.length])}
              style={{ flexGrow: Math.max(0.0001, segment.tokens), flexBasis: 0 }}
            >
              {share >= 0.055 ? <span className="truncate">{segment.label}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Hotspots({ task, analysis }: { task: TaskDetailJson; analysis: TaskUsageAnalysis }) {
  const attempts = attemptCounts(analysis.sessions);
  const rows = [...analysis.sessions].sort((a, b) => sessionTokens(b) - sessionTokens(a));
  return (
    <CardContent className="overflow-x-auto border-t px-0 pt-0">
      <Table>
        <TableHeader><TableRow className="hover:bg-transparent">
          <TableHead className="pl-6">Stage</TableHead><TableHead>Model</TableHead><TableHead>Why it is large</TableHead>
          <TableHead className="text-right">Input</TableHead><TableHead className="text-right">Cache</TableHead><TableHead className="text-right">Output</TableHead>
          <TableHead className="text-right">Total</TableHead><TableHead className="pr-6 text-right">Cost</TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map((session) => {
          const usage = session.record?.stats.usage;
          return <TableRow key={session.ref.id}>
            <TableCell className="pl-6">
              <WorkerLink workerId={session.ref.workerId ?? "coordinator"} session={{ id: session.ref.id, type: session.ref.type }} label={stageLabel(session)} />
              {session.ref.jobId && <span className="mt-0.5 block font-mono text-[10px] text-subtle-foreground">{session.ref.jobId}</span>}
            </TableCell>
            <TableCell className="font-mono text-[11px]">{sessionModels(session)}</TableCell>
            <TableCell className="max-w-[260px] whitespace-normal text-aux text-muted-foreground">{whyLarge(session, attempts, task)}</TableCell>
            <NumberCell value={usage?.inputTokens} /><NumberCell value={(usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0)} />
            <NumberCell value={usage?.outputTokens} /><NumberCell value={usage?.totalTokens} strong />
            <TableCell className="pr-6 text-right font-mono text-[11px]">{formatCost(usage?.costUsd ?? undefined)}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </CardContent>
  );
}

function NumberCell({ value, strong = false }: { value?: number; strong?: boolean }) {
  return <TableCell className={cn("text-right font-mono text-[11px]", strong ? "font-semibold text-foreground" : "text-muted-foreground")}>{value === undefined ? "—" : formatTokens(value, true)}</TableCell>;
}

function UsageBar({ usage }: { usage: SessionRecord["stats"]["usage"] }) {
  const total = usage.totalTokens || 1;
  const input = usage.inputTokens / total * 100;
  const cache = (usage.cacheReadTokens + usage.cacheWriteTokens) / total * 100;
  const output = usage.outputTokens / total * 100;
  return <div className="flex h-full w-full"><span className="bg-muted-foreground/35" style={{ width: `${input}%` }} /><span className="bg-primary/55" style={{ width: `${cache}%` }} /><span className="bg-success/65" style={{ width: `${output}%` }} /></div>;
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", tone)} />{label}</span>;
}

function groupSegments(sessions: SessionUsageAnalysis[], keyOf: (session: SessionUsageAnalysis) => string): IcicleSegment[] {
  const grouped = new Map<string, number>();
  for (const session of sessions) grouped.set(keyOf(session), (grouped.get(keyOf(session)) ?? 0) + sessionTokens(session));
  return [...grouped].map(([key, tokens]) => ({ key, label: key, tokens, detail: `${key} · ${formatTokens(tokens)} tokens` }));
}

function sessionTokens(session: SessionUsageAnalysis): number { return session.record?.stats.usage.totalTokens ?? 0; }
function stageLabel(session: SessionUsageAnalysis): string { return session.ref.role === "coordinator" ? "Coordinator" : (session.ref.agent?.split(":").at(-1) ?? "Worker"); }
function shortStage(session: SessionUsageAnalysis): string { return session.ref.jobId ?? stageLabel(session); }
function sessionModels(session: SessionUsageAnalysis): string { return session.models.join(" + ") || session.record?.largeModelSelection || "unknown model"; }
function factRef(fact: FactJson): string { return `#${fact.seq} ${fact.kind}`; }
function attemptCounts(sessions: SessionUsageAnalysis[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const session of sessions) if (session.ref.jobId) counts.set(session.ref.jobId, (counts.get(session.ref.jobId) ?? 0) + 1);
  return counts;
}
function usageTitle(session: SessionUsageAnalysis): string {
  const usage = session.record?.stats.usage;
  return usage ? `${formatTokens(usage.inputTokens)} input · ${formatTokens(usage.cacheReadTokens + usage.cacheWriteTokens)} cache · ${formatTokens(usage.outputTokens)} output` : "Accounting unavailable";
}
function whyLarge(session: SessionUsageAnalysis, attempts: Map<string, number>, task: TaskDetailJson): string {
  const usage = session.record?.stats.usage;
  if (!usage) return "Session accounting unavailable.";
  const reasons: string[] = [];
  const cache = (usage.cacheReadTokens + usage.cacheWriteTokens) / Math.max(1, usage.totalTokens);
  if (cache >= 0.8) reasons.push(`${Math.round(cache * 100)}% repeated/cache context`);
  if (session.ref.role === "coordinator") reasons.push("coordination handoff");
  if (session.ref.jobId && (attempts.get(session.ref.jobId) ?? 0) > 1) reasons.push("repeated Job attempt");
  const outcome = session.ref.resultSeq ? task.facts.find((fact) => fact.seq === session.ref.resultSeq) : undefined;
  if (outcome && ["Failed", "Lost"].includes(outcome.kind)) reasons.push(outcome.kind.toLowerCase());
  if (usage.outputTokens / Math.max(1, usage.totalTokens) >= 0.15) reasons.push("generation-heavy");
  return reasons.length ? reasons.join(" · ") : "Normal run; inspect the session for prompt and tool detail.";
}
