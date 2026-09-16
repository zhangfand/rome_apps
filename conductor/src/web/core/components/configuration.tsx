import { Fragment, useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@rome-os/ui/card";
import { Separator } from "@rome-os/ui/separator";
import { Spinner } from "@rome-os/ui/spinner";
import { Textarea } from "@rome-os/ui/textarea";
import { safeText } from "../lib/facts";
import type { ConfigJson, ProjectPresentation, RuntimeJson } from "../lib/types";

export function Configuration() {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [projectPresentation, setProjectPresentation] = useState<Record<string, ProjectPresentation>>({});
  const [sop, setSop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetchAppApi("config");
        if (!response.ok) throw new Error(await responseError(response));
        const body = await response.json() as { config: ConfigJson; runtime: RuntimeJson; projectPresentation?: Record<string, ProjectPresentation> };
        const presented = presentConfig(body.config);
        setConfig(presented);
        setRuntime(body.runtime);
        setProjectPresentation(body.projectPresentation ?? {});
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
      const body = await response.json() as { config: ConfigJson; runtime: RuntimeJson; projectPresentation?: Record<string, ProjectPresentation> };
      const presented = presentConfig(body.config);
      setConfig(presented);
      setRuntime(body.runtime);
      setProjectPresentation(body.projectPresentation ?? {});
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
          <h2 className="text-title">SOP · the workflow, as a prompt</h2>
          <span className="font-mono text-[11px] text-subtle-foreground">takes effect on every open task</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2.5 text-aux font-normal text-muted-foreground">
              global sop · markdown · {sop.length.toLocaleString()} chars
              {dirty && <Badge variant="warning" className="ml-auto">unsaved changes</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              className="block min-h-[420px] resize-y font-mono text-xs leading-[1.65]"
              value={sop}
              onChange={(event) => { setSop(event.target.value); setSaved(false); }}
              aria-label="Global SOP"
            />
          </CardContent>
          <CardFooter className="flex-wrap">
            <Button disabled={saving || !dirty} onClick={() => void updateSop(sop)}>
              {saving && <Spinner />}
              {saving ? "Saving…" : "Save SOP"}
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => void updateSop("", true)}>Revert to built-in</Button>
            {saved && <span className="text-aux text-muted-foreground">Saved.</span>}
          </CardFooter>
          {error && <CardContent><Alert variant="destructive"><AlertDescription>{safeText(error)}</AlertDescription></Alert></CardContent>}
        </Card>
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <RailSection title="Projects">
          <Card className="gap-0 py-0">
            {Object.entries(config.projects).map(([id, project], rowIndex) => {
              const presentation = projectPresentation[id] ?? {};
              const sourceOn = presentation.sourceEnabled === true;
              return (
                <Fragment key={id}>
                  {rowIndex > 0 && <Separator />}
                  <CardContent className="flex flex-col gap-[3px] py-2.5">
                    <div className="flex items-center gap-[7px]">
                      <span className="text-[13px] font-semibold">{safeText(id)}</span>
                      {project.sop && <Badge variant="info">own SOP</Badge>}
                      {project.workspace === "none" && <Badge variant="muted">no workspace</Badge>}
                      <Badge variant={sourceOn ? "success" : "muted"} className="ml-auto">{safeText(presentation.sourceLabel ?? "source")} {sourceOn ? "on" : "off"}</Badge>
                    </div>
                    <span className="truncate font-mono text-[11px] text-subtle-foreground">{project.workingDir ? safeText(project.workingDir) : "no working directory"}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{safeText(presentation.subtitle ?? presentation.emptySubtitle ?? "no external source")}</span>
                  </CardContent>
                </Fragment>
              );
            })}
          </Card>
        </RailSection>

        <RailSection title="Runtime">
          <Card className="gap-[7px] py-3 [&>*]:px-3">
            {runtimeRows.map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-2.5 px-3">
                <span className="text-[12.5px] text-muted-foreground">{label}</span>
                <span className="relative -top-[3px] flex-1 border-b border-dotted border-border-strong" />
                <span className="text-right font-mono text-[11.5px]">{value}</span>
              </div>
            ))}
            <p className="mt-1 px-3 text-[11.5px] leading-[1.45] text-subtle-foreground">Change these with <code className="rounded bg-surface-muted px-1.5 font-mono">conductor:setup</code>.</p>
          </Card>
        </RailSection>

        <RailSection title="Worker agents">
          <Card className="gap-0 py-0">
            {Object.entries(config.workerAgents).map(([id, description], rowIndex) => (
              <Fragment key={id}>
                {rowIndex > 0 && <Separator />}
                <CardContent className="flex flex-col gap-0.5 py-2.5">
                  <span className="font-mono text-[11.5px]">{id}</span>
                  <span className="text-xs leading-[1.45] text-muted-foreground">{safeText(description)}</span>
                </CardContent>
              </Fragment>
            ))}
          </Card>
        </RailSection>
      </div>
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-2"><h2 className="text-title">{title}</h2>{children}</section>;
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
    <Alert variant="destructive" className="max-w-[70ch]">
      <AlertTitle>The settings could not be read.</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        {safeText(message)}
        <span className="text-muted-foreground">Return to this page after checking that the app is configured.</span>
      </AlertDescription>
    </Alert>
  );
}
