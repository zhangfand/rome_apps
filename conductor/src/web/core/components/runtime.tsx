import { useCallback, useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { FormRow, FormRowControl, FormRowDescription, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import { Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { presentConfig, responseError, type ConfigResponse } from "../lib/config-api";
import { safeText } from "../lib/facts";
import { formatRelative } from "../lib/format";
import type { ConfigJson, RuntimeJson, StateJson } from "../lib/types";

/**
 * The Runtime tab: what the loop is set to and what it is doing right now.
 * The limits are read-only here — they are set with `conductor:setup` — and
 * the live part comes from the same state feed the board polls.
 */
export function Runtime({ state }: { state: StateJson | null }) {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchAppApi("config");
      if (!response.ok) throw new Error(await responseError(response));
      const body = await response.json() as ConfigResponse;
      setConfig(presentConfig(body.config));
      setRuntime(body.runtime);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The runtime settings could not be read. Try again.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error && !config) {
    return (
      <Alert variant="destructive" className="max-w-[70ch]">
        <AlertTitle>The runtime settings could not be read.</AlertTitle>
        <AlertDescription>{safeText(error)}</AlertDescription>
      </Alert>
    );
  }
  if (!config || !runtime) return <Loading />;

  const now = state ? Date.parse(state.now) : Date.now();
  const workers = state?.workers ?? [];
  const limits: Array<[string, string, string?]> = [
    ["Coordinator", coordinatorName(config.orchestratorAgent), "The agent that reads each task's history and records the next step."],
    ["Max workers", String(config.maxWorkers), "Across all tasks at once."],
    ["Tick every", `${config.intervalMinutes} min`, "How often sources are polled and open tasks are looked at."],
    ["Reuse sessions", config.reuseSessions ? "on" : "off", "A follow-up worker continues the previous worker's session."],
    ["Decisions per turn", String(config.maxDecisionsPerTurn), "Steps taken on a task before it waits for a person."],
    ["Heartbeat lease", compactSeconds(runtime.heartbeatLeaseSeconds), "A worker silent this long is treated as gone."],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Now</SectionTitle>
            <SectionDescription>
              {state?.tickRunning ? "A tick is running." : "Idle between ticks."}
              {` ${workers.length} of ${config.maxWorkers} worker slot${config.maxWorkers === 1 ? "" : "s"} in use.`}
            </SectionDescription>
          </SectionHeading>
        </SectionHeader>
        {workers.length > 0 && (
          <List>
            {workers.map((worker) => (
              <ListRow key={worker.workerId}>
                <ListRowContent>
                  <ListRowTitle className="font-mono text-aux">{safeText(worker.workerId)} <span className="text-muted-foreground">on {safeText(worker.taskId)}</span></ListRowTitle>
                  <ListRowDescription>
                    {worker.lastHeartbeatAt ? `last heartbeat ${formatRelative(worker.lastHeartbeatAt, now)}` : "no heartbeat yet"}
                  </ListRowDescription>
                </ListRowContent>
                <Badge variant={worker.status === "alive" ? "success" : "muted"}>{safeText(worker.status)}</Badge>
              </ListRow>
            ))}
          </List>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Limits</SectionTitle>
            <SectionDescription>Set with <code className="rounded bg-surface-muted px-1.5 font-mono">conductor:setup</code>.</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        <FormRows>
          {limits.map(([label, value, description]) => (
            <FormRow key={label}>
              <FormRowHeading>
                <FormRowLabel>{label}</FormRowLabel>
                {description && <FormRowDescription>{description}</FormRowDescription>}
              </FormRowHeading>
              <FormRowControl><span className="font-mono text-aux">{value}</span></FormRowControl>
            </FormRow>
          ))}
        </FormRows>
      </Section>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Worker agents</SectionTitle>
            <SectionDescription>What the coordinator may hand a task to.</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        <List>
          {Object.entries(config.workerAgents).map(([id, description]) => (
            <ListRow key={id}>
              <ListRowContent>
                <ListRowTitle className="font-mono text-aux">{safeText(id)}</ListRowTitle>
                <ListRowDescription>{safeText(description)}</ListRowDescription>
              </ListRowContent>
            </ListRow>
          ))}
        </List>
      </Section>
    </div>
  );
}

function coordinatorName(value: string): string {
  const safe = safeText(value);
  const parts = safe.split(":");
  return parts.length === 2 && parts[0] === parts[1] ? parts[0] : safe;
}

function compactSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

function Loading() {
  return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading runtime<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;
}
