import { useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { Textarea } from "@rome-os/ui/textarea";
import { cn } from "@rome-os/ui/cn";
import { safeText } from "../lib/facts";
import type { ConfigJson, RuntimeJson } from "../lib/types";

export function Configuration() {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [sop, setSop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetchAppApi("config");
        if (!response.ok) throw new Error(await responseError(response));
        const body = await response.json() as { config: ConfigJson; runtime: RuntimeJson };
        const presented = presentConfig(body.config);
        setConfig(presented);
        setRuntime(body.runtime);
        setSop(presented.sop);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The settings could not be read. Try again.");
      }
    })();
  }, []);

  const updateSop = async (nextSop: string, builtIn = false) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetchAppApi("config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sop: builtIn ? "" : nextSop }),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const body = await response.json() as { config: ConfigJson; runtime: RuntimeJson };
      const presented = presentConfig(body.config);
      setConfig(presented);
      setRuntime(body.runtime);
      setSop(presented.sop);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (error && !config) return <ErrorCard message={error} />;
  if (!config) return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading settings<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;

  const dirty = sop !== config.sop;
  const runtimeRows = [
    ["Coordinator", coordinatorName(config.orchestratorAgent)],
    ["Max workers", String(config.maxWorkers)],
    ["Tick every", `${config.intervalMinutes} min`],
    ["Reuse sessions", String(config.reuseSessions)],
    ["Decisions per turn", String(config.maxDecisionsPerTurn)],
    ["Heartbeat lease", runtime ? compactSeconds(runtime.heartbeatLeaseSeconds) : "—"],
  ];

  return (
    <div className="grid items-start gap-[18px] md:grid-cols-[minmax(0,1.55fr)_minmax(260px,1fr)]">
      <section className="flex min-w-0 flex-col gap-[9px]">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="font-serif text-[22px] font-medium tracking-[-0.01em]">SOP · the workflow, as a prompt</h2>
          <span className="font-mono text-[11px] text-subtle-foreground">takes effect on every open task</span>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
          <div className="flex items-center gap-2.5 border-b border-border bg-surface-muted px-5 py-2.5">
            <span className="font-mono text-[10.5px] text-muted-foreground">global sop · markdown · {sop.length.toLocaleString()} chars</span>
            {dirty && <span className="ml-auto font-mono text-[10.5px] text-warning-fg">unsaved changes</span>}
          </div>
          <Textarea
            className="block min-h-[420px] resize-y rounded-none border-0 bg-surface px-3.5 py-3 font-mono text-xs leading-[1.65] focus-visible:outline-1"
            value={sop}
            onChange={(event) => { setSop(event.target.value); setSaved(false); }}
            aria-label="Global SOP"
          />
        </div>
        <div className="flex flex-wrap items-center gap-[9px]">
          <Button className="hover:bg-primary-hover" disabled={saving || !dirty} onClick={() => void updateSop(sop)}>{saving ? "Saving…" : "Save SOP"}</Button>
          <Button variant="outline" className="border-border-strong bg-surface hover:bg-surface-hover" disabled={saving} onClick={() => void updateSop("", true)}>Revert to built-in</Button>
          {saved && <span className="text-[11.5px] text-subtle-foreground">Saved.</span>}
          {error && <span role="alert" className="text-[11.5px] text-destructive-fg">{safeText(error)}</span>}
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <RailSection title="Projects">
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            {Object.entries(config.projects).map(([id, project]) => {
              const intakeOn = Boolean(project.repo) && project.intakeEnabled !== false;
              const labels = [project.intakeLabel ?? config.intakeLabel, project.projectLabel].filter(Boolean);
              return (
                <div key={id} className="flex flex-col gap-[3px] border-t border-border-subtle px-3 py-2.5 first:border-t-0">
                  <div className="flex items-center gap-[7px]">
                    <span className="text-[13px] font-semibold">{safeText(id)}</span>
                    {project.sop && <span className="inline-flex h-[18px] items-center rounded-[5px] bg-accent px-[7px] font-mono text-[10px] text-info-fg">own SOP</span>}
                    <span className={cn("ml-auto inline-flex items-center gap-[5px] font-mono text-[10px]", intakeOn ? "text-success-fg" : "text-subtle-foreground")}>
                      <span className={cn("size-[5px] rounded-full", intakeOn ? "bg-success" : "bg-subtle-foreground")} />
                      intake {intakeOn ? "on" : "off"}
                    </span>
                  </div>
                  <span className="truncate font-mono text-[11px] text-subtle-foreground">{safeText(project.workingDir)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{project.repo ? `${safeText(project.repo)} · ${labels.length === 1 ? "label" : "labels"} ${labels.map((label) => `“${safeText(label!)}”`).join(" + ")}` : "no repository · chat intake only"}</span>
                </div>
              );
            })}
          </div>
        </RailSection>

        <RailSection title="Runtime">
          <div className="flex flex-col gap-[7px] rounded-[14px] border border-border bg-surface p-3">
            {runtimeRows.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-2.5">
                <span className="text-[12.5px] text-muted-foreground">{label}</span>
                <span className="relative -top-[3px] flex-1 border-b border-dotted border-border-strong" />
                <span className="text-right font-mono text-[11.5px]">{value}</span>
              </div>
            ))}
            <p className="mt-1 text-[11.5px] leading-[1.45] text-subtle-foreground">Change these with <code className="rounded bg-surface-muted px-1.5 font-mono">conductor:setup</code>.</p>
          </div>
        </RailSection>

        <RailSection title="Worker agents">
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            {Object.entries(config.workerAgents).map(([id, description]) => (
              <div key={id} className="flex flex-col gap-0.5 border-t border-border-subtle px-3 py-2.5 first:border-t-0">
                <span className="font-mono text-[11.5px]">{id}</span>
                <span className="text-xs leading-[1.45] text-muted-foreground">{safeText(description)}</span>
              </div>
            ))}
          </div>
        </RailSection>
      </div>
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-2"><h2 className="font-serif text-[22px] font-medium tracking-[-0.01em]">{title}</h2>{children}</section>;
}

function coordinatorName(value: string): string {
  const safe = safeText(value);
  const parts = safe.split(":");
  return parts.length === 2 && parts[0] === parts[1] ? parts[0] : safe;
}

function presentConfig(config: ConfigJson): ConfigJson {
  return { ...config, sop: safeText(config.sop) };
}

function compactSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error ?? `The change did not save (HTTP ${response.status}). Try again.`;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex max-w-[70ch] flex-col gap-3 rounded-[14px] border border-destructive-border bg-destructive-bg p-5">
      <strong className="text-[15px] text-destructive-fg">The settings could not be read.</strong>
      <p className="text-sm">{safeText(message)}</p>
      <p className="text-xs text-muted-foreground">Return to this page after checking that the app is configured.</p>
    </div>
  );
}
