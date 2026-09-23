import { useCallback, useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import { Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { responseError, type ConfigResponse } from "../lib/config-api";
import { safeText } from "../lib/facts";
import { formatRelative } from "../lib/format";
import type { RuntimeJson, StateJson } from "../lib/types";

/**
 * The Runtime tab is intentionally operational: live workers and immediate
 * developer controls. Persistent settings live in the Settings dialog.
 */
export function Runtime({ state }: { state: StateJson | null }) {
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pauseSaving, setPauseSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetchAppApi("config");
      if (!response.ok) throw new Error(await responseError(response));
      const body = await response.json() as ConfigResponse;
      setRuntime(body.runtime);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The runtime settings could not be read. Try again.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setPaused = useCallback(async (paused: boolean) => {
    setPauseSaving(true);
    try {
      const response = await fetchAppApi("runtime/pause", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const control = await response.json() as Pick<RuntimeJson, "paused" | "pauseChangedAt">;
      setRuntime((current) => current ? { ...current, ...control } : current);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The runtime control could not be changed. Try again.");
    } finally {
      setPauseSaving(false);
    }
  }, []);

  if (error && !runtime) {
    return (
      <Alert variant="destructive" className="max-w-[70ch]">
        <AlertTitle>The runtime settings could not be read.</AlertTitle>
        <AlertDescription>{safeText(error)}</AlertDescription>
      </Alert>
    );
  }
  if (!runtime) return <Loading />;

  const now = state ? Date.parse(state.now) : Date.now();
  const workers = state?.workers ?? [];
  const maxWorkers = state?.maxWorkers ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Now</SectionTitle>
            <SectionDescription>
              {state?.runtimePaused ? "Runtime paused." : state?.tickRunning ? "A tick is running." : "Idle between ticks."}
              {` ${workers.length} of ${maxWorkers} worker slot${maxWorkers === 1 ? "" : "s"} in use.`}
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
            <SectionTitle>Developer</SectionTitle>
            <SectionDescription>
              Pause the loop while debugging. Existing workers keep running, but ticks, coordinator wakes, and new worker dispatches stop. Queued jobs remain pending.
            </SectionDescription>
          </SectionHeading>
        </SectionHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={runtime.paused ? "warning" : "success"}>{runtime.paused ? "Runtime paused" : "Runtime active"}</Badge>
          <Button
            variant={runtime.paused ? "outline" : "destructive"}
            size="sm"
            disabled={pauseSaving}
            onClick={() => void setPaused(!runtime.paused)}
          >
            {pauseSaving ? "Saving…" : runtime.paused ? "Resume runtime" : "Pause runtime"}
          </Button>
          {runtime.pauseChangedAt && <span className="text-aux text-muted-foreground">changed {formatRelative(runtime.pauseChangedAt, now)}</span>}
        </div>
        {error && <p className="mt-3 text-ui text-destructive">{safeText(error)}</p>}
      </Section>

    </div>
  );
}

function Loading() {
  return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading runtime<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;
}
