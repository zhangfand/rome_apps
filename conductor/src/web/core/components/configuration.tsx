import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@rome-os/ui/card";
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { Spinner } from "@rome-os/ui/spinner";
import { Switch } from "@rome-os/ui/switch";
import { Textarea } from "@rome-os/ui/textarea";
import { webDomain } from "../domain";
import { reconcileDefaultSelection, workspaceInspectionStatus } from "../lib/configuration";
import { safeText } from "../lib/facts";
import type { ConfigJson, ProjectPresentation, RuntimeJson, WorkspaceInspection } from "../lib/types";

type ProjectValue = ConfigJson["projects"][string];
type ConfigResponse = {
  configured?: boolean;
  config: ConfigJson;
  runtime: RuntimeJson;
  projectPresentation?: Record<string, ProjectPresentation>;
};

export function Configuration() {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [projectPresentation, setProjectPresentation] = useState<Record<string, ProjectPresentation>>({});
  const [sop, setSop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);

  const accept = useCallback((body: ConfigResponse) => {
    const presented = presentConfig(body.config);
    setConfig(presented);
    setRuntime(body.runtime);
    setProjectPresentation(body.projectPresentation ?? {});
    setSop(presented.sop);
    setError(null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetchAppApi("config");
        if (!response.ok) throw new Error(await responseError(response));
        accept(await response.json() as ConfigResponse);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The settings could not be read. Try again.");
      }
    })();
  }, [accept]);

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
      accept(await response.json() as ConfigResponse);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (error && !config) return <ErrorCard message={error} />;
  if (!config || !runtime) return <Loading />;

  const sopDirty = sop !== config.sop;
  const runtimeRows = [
    ["Coordinator", coordinatorName(config.orchestratorAgent)],
    ["Max workers", String(config.maxWorkers)],
    ["Tick every", `${config.intervalMinutes} min`],
    ["Reuse sessions", String(config.reuseSessions)],
    ["Decisions per turn", String(config.maxDecisionsPerTurn)],
    ["Heartbeat lease", compactSeconds(runtime.heartbeatLeaseSeconds)],
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-title">Projects</h2>
            <p className="mt-1 text-xs text-muted-foreground">Each task keeps the project binding it was created with.</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>Add project</Button>
        </div>
        {Object.entries(config.projects).map(([id, project]) => (
          <ProjectRow
            key={id}
            id={id}
            project={project}
            isDefault={config.defaultProject === id}
            runtime={runtime}
            presentation={projectPresentation[id]}
            reservedIds={Object.keys(config.projects)}
            onAccepted={accept}
          />
        ))}
        {adding && (
          <ProjectRow
            id=""
            project={{ workspace: runtime.defaultWorkspaceKind }}
            isDefault={Object.keys(config.projects).length === 0}
            runtime={runtime}
            creating
            reservedIds={Object.keys(config.projects)}
            onAccepted={(body) => { accept(body); setAdding(false); }}
            onCancelCreate={() => setAdding(false)}
          />
        )}
        {!adding && Object.keys(config.projects).length === 0 && (
          <Card><CardContent className="py-5 text-sm text-muted-foreground">Add the first project to finish configuring Conductor.</CardContent></Card>
        )}
      </section>

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
                {sopDirty && <Badge variant="warning" className="ml-auto">unsaved changes</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea className="block min-h-[420px] resize-y font-mono text-xs leading-[1.65]" value={sop} onChange={(event) => { setSop(event.target.value); setSaved(false); }} aria-label="Global SOP" />
            </CardContent>
            <CardFooter className="flex-wrap">
              <Button disabled={saving || !sopDirty} onClick={() => void updateSop(sop)}>{saving && <Spinner />}{saving ? "Saving…" : "Save SOP"}</Button>
              <Button variant="outline" disabled={saving} onClick={() => void updateSop("", true)}>Revert to built-in</Button>
              {saved && <span className="text-aux text-muted-foreground">Saved.</span>}
            </CardFooter>
            {error && <CardContent><Alert variant="destructive"><AlertDescription>{safeText(error)}</AlertDescription></Alert></CardContent>}
          </Card>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
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
              {Object.entries(config.workerAgents).map(([id, description]) => (
                <CardContent key={id} className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0">
                  <span className="font-mono text-[11.5px]">{id}</span>
                  <span className="text-xs leading-[1.45] text-muted-foreground">{safeText(description)}</span>
                </CardContent>
              ))}
            </Card>
          </RailSection>
        </div>
      </div>
    </div>
  );
}

function ProjectRow({ id: initialId, project, isDefault: initialDefault, runtime, presentation, creating = false, reservedIds, onAccepted, onCancelCreate }: {
  id: string;
  project: ProjectValue;
  isDefault: boolean;
  runtime: RuntimeJson;
  presentation?: ProjectPresentation;
  creating?: boolean;
  reservedIds: string[];
  onAccepted(body: ConfigResponse): void;
  onCancelCreate?: () => void;
}) {
  const [id, setId] = useState(initialId);
  const [draft, setDraft] = useState<ProjectValue>(() => ({ ...project }));
  const [isDefault, setIsDefault] = useState(initialDefault);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<WorkspaceInspection | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const inspectionSequence = useRef(0);
  const acknowledgedDefault = useRef(initialDefault);
  const fields = webDomain().projectSettingsFields;
  const shownDefault = reconcileDefaultSelection(isDefault, acknowledgedDefault.current, initialDefault);
  const dirty = creating || id !== initialId || JSON.stringify(draft) !== JSON.stringify(project) || shownDefault !== initialDefault;
  const workspace = typeof draft.workspace === "string" ? draft.workspace : runtime.defaultWorkspaceKind;
  const workingDir = typeof draft.workingDir === "string" ? draft.workingDir : "";

  useEffect(() => {
    const previous = acknowledgedDefault.current;
    acknowledgedDefault.current = initialDefault;
    setIsDefault((current) => reconcileDefaultSelection(current, previous, initialDefault));
  }, [initialDefault]);

  const inspect = useCallback(async () => {
    const sequence = ++inspectionSequence.current;
    if (!workingDir) {
      setInspection(null);
      setInspectionError(workspace === "none" ? null : "Enter an absolute working directory.");
      return;
    }
    if (!workingDir.startsWith("/")) {
      setInspection(null);
      setInspectionError("Working directory must be absolute.");
      return;
    }
    setInspectionError(null);
    try {
      const query = new URLSearchParams({ workspace, workingDir });
      const response = await fetchAppApi(`config/inspect?${query}`);
      if (!response.ok) throw new Error(await responseError(response));
      const next = await response.json() as WorkspaceInspection;
      if (sequence === inspectionSequence.current) setInspection(next);
    } catch (caught) {
      if (sequence === inspectionSequence.current) setInspectionError(caught instanceof Error ? caught.message : "Inspection failed.");
    }
  }, [workingDir, workspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => void inspect(), 500);
    return () => window.clearTimeout(timer);
  }, [inspect]);

  const change = (next: ProjectValue) => { setDraft(next); setRowError(null); };

  const save = async () => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      setRowError("Project id must use lowercase letters, numbers, and hyphens, and start with a letter or number.");
      return;
    }
    if (creating && reservedIds.includes(id)) {
      setRowError(`A project named ${id} already exists.`);
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      const response = await fetchAppApi("config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projects: { [id]: draft },
          ...(shownDefault ? { defaultProject: id } : initialDefault ? { defaultProject: "" } : {}),
        }),
      });
      if (!response.ok) { setRowError(await responseError(response)); return; }
      const body = await response.json() as ConfigResponse;
      setDraft({ ...body.config.projects[id] });
      setIsDefault(body.config.defaultProject === id);
      onAccepted(body);
    } finally { setSaving(false); }
  };

  const remove = async (force = false) => {
    setSaving(true);
    setRowError(null);
    try {
      const response = await fetchAppApi(`config${force ? "?force=1" : ""}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projects: { [initialId]: null } }),
      });
      if (response.status === 409 && !force) {
        const body = await response.json() as { error?: string; count?: number };
        if (typeof body.count === "number") { setConfirmCount(body.count); return; }
        setRowError(body.error ?? "The project could not be removed.");
        return;
      }
      if (!response.ok) { setRowError(await responseError(response)); return; }
      setConfirmCount(null);
      onAccepted(await response.json() as ConfigResponse);
    } finally { setSaving(false); }
  };

  const cancel = () => {
    if (creating) { onCancelCreate?.(); return; }
    setId(initialId);
    setDraft({ ...project });
    setIsDefault(initialDefault);
    setRowError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {creating ? "New project" : safeText(initialId)}
          {!creating && shownDefault && <Badge variant="info">default</Badge>}
          {presentation?.subtitle && <span className="min-w-0 truncate font-mono text-[11px] font-normal text-muted-foreground">{safeText(presentation.subtitle)}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`project-id-${initialId || "new"}`}>Project id</FieldLabel>
            <Input id={`project-id-${initialId || "new"}`} value={id} disabled={!creating || saving} onChange={(event) => setId(event.target.value)} placeholder="my-project" />
            <FieldDescription>{creating ? "Permanent slug after creation." : "Project ids cannot be renamed."}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`project-dir-${initialId || "new"}`}>Working directory</FieldLabel>
            <Input id={`project-dir-${initialId || "new"}`} value={workingDir} disabled={saving} onChange={(event) => change({ ...draft, workingDir: event.target.value })} placeholder="/absolute/path" />
          </Field>
          <Field>
            <FieldLabel>Workspace kind</FieldLabel>
            <Select value={workspace} disabled={saving} onValueChange={(value) => change({ ...draft, workspace: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{runtime.workspaceKinds.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field className="justify-center">
            <div className="flex min-h-9 items-center gap-3">
              <Switch id={`project-default-${initialId || "new"}`} checked={shownDefault} disabled={saving} onCheckedChange={setIsDefault} />
              <FieldLabel htmlFor={`project-default-${initialId || "new"}`}>Use as default project</FieldLabel>
            </div>
          </Field>
        </FieldGroup>
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-surface-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{workspaceInspectionStatus(inspection, inspectionError, workspace === "none")}</span>
          {!creating && <Button type="button" variant="ghost" size="xs" onClick={() => void inspect()}>Refresh</Button>}
        </div>
        {fields.map((SettingsFields, index) => (
          <SettingsFields key={index} projectId={id} project={draft as Record<string, unknown>} onChange={(next) => change(next as ProjectValue)} inspection={inspection} refreshInspection={() => void inspect()} disabled={saving} />
        ))}
        <Field>
          <FieldLabel htmlFor={`project-sop-${initialId || "new"}`}>Project SOP override</FieldLabel>
          <Textarea id={`project-sop-${initialId || "new"}`} value={typeof draft.sop === "string" ? draft.sop : ""} disabled={saving} onChange={(event) => change({ ...draft, sop: event.target.value })} placeholder="Leave empty to use the global SOP." className="min-h-24" />
        </Field>
        {rowError && <FieldError errors={[safeText(rowError)]} />}
      </CardContent>
      <CardFooter className="flex-wrap">
        {dirty && <>
          <Button disabled={saving} onClick={() => void save()}>{saving && <Spinner />}{saving ? "Saving…" : "Save"}</Button>
          <Button variant="outline" disabled={saving} onClick={cancel}>Cancel</Button>
        </>}
        {!creating && <Button className="ml-auto" variant="destructive" size="sm" disabled={saving} onClick={() => void remove()}>Remove project</Button>}
      </CardFooter>
      <Dialog open={confirmCount !== null} onClose={() => setConfirmCount(null)} modal size="sm">
        <DialogHeader onClose={() => setConfirmCount(null)}><DialogTitle>Remove project?</DialogTitle></DialogHeader>
        <DialogBody>
          <DialogDescription>{confirmCount} open task{confirmCount === 1 ? " is" : "s are"} still bound to this project. Those tasks keep their pinned project details, but removing the project can make future intake unavailable.</DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmCount(null)}>Cancel</Button>
          <Button variant="destructive" disabled={saving} onClick={() => void remove(true)}>Remove anyway</Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}

function RailSection({ title, children }: { title: string; children: ReactNode }) {
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

function Loading() {
  return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading settings<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="max-w-[70ch]">
      <AlertTitle>The settings could not be read.</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">{safeText(message)}<span className="text-muted-foreground">Try again after checking that the app is running.</span></AlertDescription>
    </Alert>
  );
}
