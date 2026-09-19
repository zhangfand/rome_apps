import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Input } from "@rome-os/ui/input";
import { Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { formatStamp, truncate } from "../lib/format";
import type { FrontdeskShadowReport, FrontdeskShadowRun } from "../lib/types";

const POLL_MS = 10_000;
type Filter = "All" | "Matches" | "Mismatches" | "Unresolved";

export function FrontdeskShadow() {
  const [report, setReport] = useState<FrontdeskShadowReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAppApi("frontdesk-shadow?limit=100");
      if (!response.ok) throw new Error(`comparison history returned ${response.status}`);
      setReport(await response.json() as FrontdeskShadowReport);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The comparison history could not be read.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poller = window.setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poller);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const counts = useMemo(() => {
    const runs = report?.runs ?? [];
    return {
      All: runs.length,
      Matches: runs.filter((run) => run.matched === true).length,
      Mismatches: runs.filter((run) => run.matched === false).length,
      Unresolved: runs.filter((run) => run.matched === undefined).length,
    } satisfies Record<Filter, number>;
  }, [report]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (report?.runs ?? []).filter((run) => {
      const inFilter = filter === "All"
        || (filter === "Matches" && run.matched === true)
        || (filter === "Mismatches" && run.matched === false)
        || (filter === "Unresolved" && run.matched === undefined);
      if (!inFilter) return false;
      if (!needle) return true;
      return [
        run.input,
        run.status,
        run.decision?.intent,
        run.decision?.targetTask,
        run.decision?.project,
        run.actual.kind,
        run.actual.taskId,
        run.actual.projectId,
        run.mismatch,
        run.error,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [filter, query, report]);

  const options = (Object.keys(counts) as Filter[]).map((value) => ({
    value,
    label: <span className="inline-flex items-center gap-1.5">{value}<span className="text-current/60">{counts[value]}</span></span>,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Front desk shadow</SectionTitle>
            <SectionDescription>
              Jev predicts the route while the existing LLM remains authoritative. This page compares both decisions; shadow mode never changes task history.
            </SectionDescription>
          </SectionHeading>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh"}</Button>
        </SectionHeader>

        <Alert>
          <AlertTitle>Credentials stay outside Conductor</AlertTitle>
          <AlertDescription>
            Provide <code className="rounded bg-surface-muted px-1.5 font-mono">TYPESAFE_API_KEY</code> through Rome's deployment environment. This app intentionally never accepts, displays, or stores the key. Rows marked “No key” confirm that a turn was observed but not sent to Jev.
          </AlertDescription>
        </Alert>
      </Section>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>The comparison history could not be read.</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            {error}
            <Button variant="outline" onClick={() => void load()}>Try again</Button>
          </AlertDescription>
        </Alert>
      )}

      {report && <Summary report={report} />}

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Recent decisions</SectionTitle>
            <SectionDescription>The newest 100 front-desk turns. Search message text, task IDs, projects, decisions, or errors.</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="overflow-x-auto pb-0.5">
              <SegmentedControl options={options} value={filter} onValueChange={setFilter} size="sm" aria-label="Filter shadow comparisons" />
            </div>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search comparisons"
              aria-label="Search comparisons"
              className="w-full sm:w-64"
            />
          </div>
          <ComparisonTable runs={visible} waiting={!report && !error} filtered={Boolean(query.trim()) || filter !== "All"} />
        </div>
      </Section>
    </div>
  );
}

function Summary({ report }: { report: FrontdeskShadowReport }) {
  const summary = report.summary;
  const unresolved = summary.running + summary.errors + summary.skippedMissingApiKey;
  const metrics: Array<[string, string, string]> = [
    ["Agreement", summary.matchRate === undefined ? "—" : `${(summary.matchRate * 100).toFixed(1)}%`, `${summary.matched} of ${summary.compared} compared`],
    ["Mismatches", String(summary.mismatched), "Jev route differed from the LLM"],
    ["Unresolved", String(unresolved), `${summary.running} running · ${summary.errors} errors · ${summary.skippedMissingApiKey} no key`],
    ["Avg latency", summary.averageLatencyMs === undefined ? "—" : formatLatency(summary.averageLatencyMs), "Jev request only"],
    ["Est. cost", formatCost(summary.estimatedInputCostUsd), `${summary.inputTokens.toLocaleString()} Jev input tokens`],
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Shadow summary">
      {metrics.map(([label, value, note]) => (
        <Card key={label} className="gap-2 py-4">
          <CardHeader className="px-4"><CardTitle className="text-aux font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
          <CardContent className="px-4">
            <p className="font-mono text-xl font-semibold tracking-[-0.03em]">{value}</p>
            <p className="mt-1 text-[11.5px] leading-4 text-muted-foreground">{note}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function ComparisonTable({ runs, waiting, filtered }: { runs: FrontdeskShadowRun[]; waiting: boolean; filtered: boolean }) {
  return (
    <Card className="overflow-hidden py-0">
      {waiting ? (
        <p className="p-6 font-mono text-[13px] text-muted-foreground">reading comparisons…</p>
      ) : runs.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="w-[145px]">Observed</TableHead>
                <TableHead scope="col" className="min-w-[220px]">Message</TableHead>
                <TableHead scope="col" className="min-w-[180px]">Jev prediction</TableHead>
                <TableHead scope="col" className="min-w-[160px]">LLM outcome</TableHead>
                <TableHead scope="col" className="w-[130px]">Result</TableHead>
                <TableHead scope="col" className="w-[105px] text-right">Telemetry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-aux text-muted-foreground">{formatStamp(run.createdAt)}</TableCell>
                  <TableCell className="max-w-[340px] whitespace-normal">
                    <p className="text-[13px] leading-5 text-foreground" title={run.input}>{truncate(run.input, 180) || "(empty message)"}</p>
                    <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">{run.id.slice(0, 8)} · {run.state.tasks.length} open task{run.state.tasks.length === 1 ? "" : "s"}</p>
                  </TableCell>
                  <TableCell className="whitespace-normal">{jevOutcome(run)}</TableCell>
                  <TableCell className="whitespace-normal">{llmOutcome(run)}</TableCell>
                  <TableCell className="whitespace-normal">{comparisonResult(run)}</TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                    <span className="block">{run.latencyMs === undefined ? "—" : formatLatency(run.latencyMs)}</span>
                    <span className="block">{formatCost(run.estimatedInputCostUsd)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState>
          <EmptyStateTitle>{filtered ? "No comparisons match" : "No shadow comparisons yet"}</EmptyStateTitle>
          <EmptyStateDescription>
            {filtered
              ? "Change the filter or search to see other runs."
              : "Send a message to the Conductor front desk. The next turn will appear here; without an externally configured key it will be marked No key."}
          </EmptyStateDescription>
        </EmptyState>
      )}
    </Card>
  );
}

function jevOutcome(run: FrontdeskShadowRun) {
  if (run.status === "running") return <Badge variant="info">Running</Badge>;
  if (run.status === "skipped_missing_api_key") return <Badge variant="warning">No key</Badge>;
  if (run.status === "error") return <><Badge variant="destructive">Error</Badge><p className="mt-1 text-aux text-muted-foreground">{run.error ?? "Jev request failed"}</p></>;
  const decision = run.decision;
  if (!decision) return <span className="text-muted-foreground">—</span>;
  const target = decision.intent === "create_task"
    ? decision.project
    : decision.targetTask && decision.targetTask !== "none" ? decision.targetTask : undefined;
  return (
    <div>
      <p className="font-mono text-[12px] text-foreground">{intentLabel(decision.intent)}</p>
      {target && <p className="mt-0.5 text-aux text-muted-foreground">{target}</p>}
      <p className="mt-1 text-[10.5px] text-muted-foreground">intent {(decision.confidence.intent * 100).toFixed(0)}%</p>
    </div>
  );
}

function llmOutcome(run: FrontdeskShadowRun) {
  if (!run.actual.kind) return <span className="text-aux text-muted-foreground">No ledger write</span>;
  return (
    <div>
      <p className="font-mono text-[12px] text-foreground">{run.actual.kind}</p>
      {(run.actual.taskId || run.actual.projectId) && <p className="mt-0.5 text-aux text-muted-foreground">{run.actual.taskId ?? run.actual.projectId}</p>}
    </div>
  );
}

function comparisonResult(run: FrontdeskShadowRun) {
  if (run.matched === true) return <Badge variant="success">Match</Badge>;
  if (run.matched === false) return <><Badge variant="destructive">Mismatch</Badge><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{run.mismatch}</p></>;
  return <Badge variant="muted">Not compared</Badge>;
}

function intentLabel(intent: FrontdeskShadowRun["decision"] extends infer _T ? NonNullable<FrontdeskShadowRun["decision"]>["intent"] : never): string {
  return intent.replaceAll("_", " ");
}

function formatLatency(milliseconds: number): string {
  return milliseconds < 1_000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1_000).toFixed(2)} s`;
}

function formatCost(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  return value < 0.01 ? `$${value.toFixed(6)}` : `$${value.toFixed(4)}`;
}
