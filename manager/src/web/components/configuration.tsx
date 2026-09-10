import { useEffect, useId, useState, type ReactNode } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { Input } from "@rome-os/ui/input";
import { Switch } from "@rome-os/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import type { ManagerConfig } from "../../lib/config";
import type { ProjectConfig } from "../../lib/projects";

type Snapshot = { config: ManagerConfig; revision: string };

/** Send only changed, supported fields. Infrastructure never round-trips through a form. */
export function configurationChanges(before: ManagerConfig, after: ManagerConfig) {
  const fields = ["maxWorkers", "startCap", "ageCapHours", "reuseSessions", "closeOnIssueClosed", "intakeLabel",
    ...(before.projects ? ["projects", "defaultProject"] : ["workingDir", "intakeRepos"])] as Array<keyof ManagerConfig>;
  return Object.fromEntries(fields.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => [key, after[key]]));
}

export function ConfigurationEditor({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return <div className="flex flex-col gap-3">
    {!open ? <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" onClick={() => { setSaved(false); setOpen(true); }}>Edit configuration</Button>
      {saved ? <span role="status" className="text-aux text-muted-foreground">Configuration saved.</span> : null}</div>
      : <ConfigurationSession onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); setSaved(true); onSaved(); }} />}
  </div>;
}

function ConfigurationSession({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [draft, setDraft] = useState<ManagerConfig>();
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(undefined);
    void fetchAppApi("config").then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (active) { setSnapshot(data); setDraft(structuredClone(data.config)); setConflict(false); }
    }).catch((e) => { if (active) setError(String(e.message ?? e)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [reload]);
  const dirty = !!(draft && snapshot && Object.keys(configurationChanges(snapshot.config, draft)).length);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (!draft || !snapshot || busy || conflict || !dirty) return;
    setBusy(true); setError(undefined);
    try {
      const res = await fetchAppApi("config", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: snapshot.revision, changes: configurationChanges(snapshot.config, draft) }) });
      const data = await res.json();
      if (!res.ok) { setConflict(data.conflict === true); throw new Error(data.error ?? `HTTP ${res.status}`); }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <form className="flex flex-col gap-5 rounded-12 border border-border bg-surface p-4" aria-label="Edit Manager configuration" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    <div><h3 className="text-section">Edit configuration</h3><p className="mt-1 text-aux text-muted-foreground">Global settings apply across all projects, not just the dashboard filter. Nothing changes until you save.</p></div>
    {draft ? <ConfigurationFields key={reload} config={draft} onChange={setDraft} disabled={busy} /> : busy ? <p role="status" className="text-ui">Loading configuration…</p> : null}
    {error ? <p role="alert" className="text-ui text-destructive">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={!dirty || busy || conflict}>{busy && draft ? "Saving…" : "Save changes"}</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      {conflict || (!draft && error) ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setReload((n) => n + 1)}>{conflict ? "Discard edits & reload" : "Retry loading"}</Button> : null}
      {dirty ? <span className="text-aux text-muted-foreground">Unsaved changes</span> : null}
    </div>
  </form>;
}

export function ConfigurationFields({ config, onChange, disabled }: { config: ManagerConfig; onChange: (config: ManagerConfig) => void; disabled: boolean }) {
  const set = <K extends keyof ManagerConfig>(key: K, value: ManagerConfig[K]) => onChange({ ...config, [key]: value });
  return <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-6">
    <section className="flex flex-col gap-3" aria-label="Worker settings">
      <h4 className="text-section">Workers</h4>
      <p className="text-aux text-muted-foreground">Changes apply on subsequent reconciliation passes. Lowering the worker limit does not stop running workers. Lowering the retry limit can ask for your input sooner.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField title="Global worker limit" value={config.maxWorkers} max={20} onChange={(n) => set("maxWorkers", n)} />
        <NumberField title="Retry limit" hint="Starts since your last reply or a successful deferral." value={config.startCap} max={20} onChange={(n) => set("startCap", n)} />
        <NumberField title="Legacy worker age cap" hint="Hours. Lowering this can mark older legacy workers lost on the next pass. Heartbeat workers use their lease instead." value={config.ageCapHours} max={168} onChange={(n) => set("ageCapHours", n)} />
      </div>
      <Toggle title="Reuse worker sessions" hint="Future follow-ups can continue a returned or failed session. Turning this off does not stop live sessions or discard worktrees." checked={config.reuseSessions} onChange={(v) => set("reuseSessions", v)} disabled={disabled} />
      <Toggle title="Close tasks when GitHub issues close" hint="Applies to existing open tasks on the next pass: completed issues complete tasks; not-planned issues cancel them." checked={config.closeOnIssueClosed} onChange={(v) => set("closeOnIssueClosed", v)} disabled={disabled} />
    </section>
    <section className="flex flex-col gap-4" aria-label="Project settings">
      <h4 className="text-section">Projects & intake</h4>
      <p className="text-aux text-muted-foreground">Source and repository changes affect new tasks only. Existing tasks keep their recorded project and worktree. Intake changes apply on the next pass; enabling intake may create tasks from already-labeled issues.</p>
      <TextField title="Default intake label" value={config.intakeLabel} maxLength={100} onChange={(v) => set("intakeLabel", v)} />
      {config.projects ? <>
        <Choice title="Default project" value={config.defaultProject!} options={Object.keys(config.projects)} disabled={disabled} onChange={(v) => set("defaultProject", v)} />
        <p className="text-aux text-muted-foreground">The default does not reroute existing tasks or resolve ambiguous chat requests. Project IDs are fixed; use manager:setup to add, remove, or rename projects.</p>
        {Object.entries(config.projects).map(([id, project]) => <ProjectFields key={id} id={id} project={project} disabled={disabled}
          onChange={(p) => set("projects", { ...config.projects, [id]: p })} />)}
      </> : <>
        <TextField title="Source directory" value={config.workingDir} onChange={(v) => set("workingDir", v)} />
        <RepositoryList value={config.intakeRepos} onChange={(v) => set("intakeRepos", v)} />
      </>}
    </section>
    <section className="flex flex-col gap-2" aria-label="Fixed infrastructure">
      <h4 className="text-section">Infrastructure · read-only</h4>
      <p className="text-ui break-all">Worker agent: {config.workerAgent} · Reconcile interval: {config.intervalMinutes} minutes</p>
      <p className="text-aux text-muted-foreground">Use manager:setup for these changes. Agent changes need session compatibility planning; cadence changes replace the scheduled routine. This form never restarts workers or changes the schedule.</p>
    </section>
  </fieldset>;
}

function ProjectFields({ id, project, disabled, onChange }: { id: string; project: ProjectConfig; disabled: boolean; onChange: (p: ProjectConfig) => void }) {
  const optional = (key: "repo" | "intakeLabel" | "projectLabel", value: string) => {
    const next = { ...project }; if (value) next[key] = value; else delete next[key]; onChange(next);
  };
  return <div className="flex flex-col gap-3 rounded-8 border border-border p-3">
    <h5 className="text-ui font-medium">{id}</h5>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField title={`${id} source directory`} value={project.workingDir} onChange={(v) => onChange({ ...project, workingDir: v })} />
      <TextField title={`${id} repository`} hint="owner/name. Empty means no GitHub intake or Board routing." value={project.repo ?? ""} required={false} onChange={(v) => optional("repo", v)} />
      <TextField title={`${id} intake label`} hint="Empty inherits the default intake label." value={project.intakeLabel ?? ""} required={false} maxLength={100} onChange={(v) => optional("intakeLabel", v)} />
      <TextField title={`${id} project label`} hint="Required and distinct when enabled projects share a repository." value={project.projectLabel ?? ""} required={false} maxLength={100} onChange={(v) => optional("projectLabel", v)} />
    </div>
    <Toggle title={`Enable ${id} issue intake`} hint="Requires a repository. Disabling intake does not cancel existing tasks or disable manual Board implementation." checked={project.intakeEnabled !== false} disabled={disabled} onChange={(v) => onChange({ ...project, intakeEnabled: v })} />
  </div>;
}
function Field({ title, hint, children }: { title: string; hint?: string; children: (id: string, hintId?: string) => ReactNode }) {
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor={id} className="text-ui font-medium">{title}</label>{children(id, hint ? `${id}-hint` : undefined)}{hint ? <p id={`${id}-hint`} className="text-aux text-muted-foreground">{hint}</p> : null}</div>;
}
function TextField({ title, hint, value, onChange, required = true, maxLength = 4096 }: { title: string; hint?: string; value: string; onChange: (value: string) => void; required?: boolean; maxLength?: number }) {
  return <Field title={title} hint={hint}>{(id, hintId) => <Input id={id} aria-describedby={hintId} value={value} required={required} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />}</Field>;
}
function NumberField({ title, hint, value, max, onChange }: { title: string; hint?: string; value: number; max: number; onChange: (value: number) => void }) {
  return <Field title={title} hint={hint}>{(id, hintId) => <Input id={id} aria-describedby={hintId} type="number" min={1} max={max} step={1} required value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />}</Field>;
}
function Toggle({ title, hint, checked, onChange, disabled }: { title: string; hint: string; checked: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <Field title={title} hint={hint}>{(id, hintId) => <Switch id={id} aria-describedby={hintId} checked={checked} onCheckedChange={onChange} disabled={disabled} />}</Field>;
}
function Choice({ title, value, options, onChange, disabled }: { title: string; value: string; options: string[]; onChange: (value: string) => void; disabled: boolean }) {
  return <Field title={title}>{(id) => <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>}</Field>;
}

function RepositoryList({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  // Keep separators while typing; only the serialized draft is normalized.
  const [text, setText] = useState(() => value.join(", "));
  return <TextField title="Intake repositories" hint="Comma-separated owner/name entries. Leave empty to disable intake." required={false} value={text}
    onChange={(v) => { setText(v); onChange(v.split(",").map((r) => r.trim()).filter(Boolean)); }} />;
}
