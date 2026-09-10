import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Switch } from "@rome-os/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import type { ManagerConfig } from "../../lib/config";
import type { ProjectConfig } from "../../lib/projects";

type Snapshot = { config: ManagerConfig; revision: string };
type Value = string | number | boolean;
export interface Setting {
  id: string; title: string; hint: string; value: Value;
  kind: "text" | "number" | "toggle" | "select";
  max?: number; optional?: boolean; options?: string[];
  changes: (value: Value) => Record<string, unknown>;
}
interface Section { title: string; hint?: string; rows: Setting[] }

/** Each row serializes just its setting; project writes preserve all sibling fields. */
export function configurationRows(config: ManagerConfig): Section[] {
  const field = (key: keyof ManagerConfig, title: string, hint: string, kind: Setting["kind"], extra: Partial<Setting> = {}): Setting => ({
    id: key, title, hint, kind, value: config[key] as Value, changes: (value) => ({ [key]: value }), ...extra,
  });
  const sections: Section[] = [
    { title: "Workers", rows: [
      field("maxWorkers", "Global worker limit", "Across all projects. Lowering this does not stop running workers.", "number", { max: 20 }),
      field("startCap", "Retry limit", "Starts since your last reply or a successful deferral. Lowering it can ask for your input sooner.", "number", { max: 20 }),
      field("ageCapHours", "Legacy worker age cap", "Hours. Lowering this can mark older legacy workers lost next pass. Heartbeat workers use their lease instead.", "number", { max: 168 }),
      field("reuseSessions", "Reuse worker sessions", "Future follow-ups keep session context. Turning this off retains worktrees and live sessions.", "toggle"),
      field("closeOnIssueClosed", "Close tasks when GitHub issues close", "Applies to existing open tasks next pass: completed issues complete tasks; not-planned issues cancel them.", "toggle"),
    ] },
    { title: "Projects & intake", rows: [
      field("intakeLabel", "Default intake label", "Used by projects without their own intake label. Changes apply on the next pass.", "text", { max: 100 }),
      ...(config.projects ? [field("defaultProject", "Default project", "Does not reroute existing tasks or resolve ambiguous chat requests.", "select", { options: Object.keys(config.projects) })] : [
        field("workingDir", "Source directory", "New tasks only. Must be inside an existing local Git repository.", "text"),
        field("intakeRepos", "Intake repositories", "Comma-separated owner/name entries. Empty disables intake; adding repositories may create tasks from already-labeled issues.", "text", {
          value: config.intakeRepos.join(", "), optional: true,
          changes: (value) => ({ intakeRepos: String(value).split(",").map((r) => r.trim()).filter(Boolean) }),
        }),
      ]),
    ] },
  ];
  for (const [id, project] of Object.entries(config.projects ?? {})) {
    const projectField = (key: keyof ProjectConfig, title: string, hint: string, kind: Setting["kind"], extra: Partial<Setting> = {}): Setting => ({
      id: `projects.${id}.${key}`, title, hint, kind,
      value: key === "intakeEnabled" ? project.intakeEnabled !== false : project[key] ?? "",
      changes: (value) => {
        const next = { ...project };
        if (key === "intakeEnabled") next.intakeEnabled = value as boolean;
        else if (key !== "workingDir" && !String(value).trim()) delete next[key];
        else next[key] = String(value);
        return { projects: { ...config.projects, [id]: next } };
      }, ...extra,
    });
    sections.push({ title: id, hint: "Source and repository changes affect new tasks only. Existing tasks retain their project and worktree.", rows: [
      projectField("workingDir", "Source directory", "Must be inside an existing local Git repository. Saving does not create or clone it.", "text"),
      projectField("repo", "Repository", "owner/name. Empty disables GitHub intake and Board routing for this project.", "text", { optional: true }),
      projectField("intakeEnabled", "Issue intake", "Enabling may create tasks from already-labeled issues. Disabling does not cancel existing tasks or disable manual Board implementation.", "toggle"),
      projectField("intakeLabel", "Intake label", "Empty inherits the default intake label.", "text", { optional: true, max: 100 }),
      projectField("projectLabel", "Project label", "Enabled projects sharing a repository need distinct labels. Disable intake first when rearranging shared-repository routes.", "text", { optional: true, max: 100 }),
    ] });
  }
  return sections;
}

export function ConfigurationEditor({ onSaved }: { onSaved: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(undefined);
    void fetchAppApi("config").then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (active) { setSnapshot(data); setConflict(false); }
    }).catch((e) => { if (active) setError(String(e.message ?? e)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [reload]);
  async function save(changes: Record<string, unknown>) {
    if (!snapshot || saving.current || busy || conflict) throw new Error("Wait for settings to finish loading or reload the latest settings.");
    saving.current = true; setBusy(true);
    try {
      const res = await fetchAppApi("config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: snapshot.revision, changes }) });
      const data = await res.json();
      if (!res.ok) { if (data.conflict === true) setConflict(true); throw new Error(data.error ?? `HTTP ${res.status}`); }
      setSnapshot(data); onSaved();
    } finally { saving.current = false; setBusy(false); }
  }
  return <div className="flex flex-col gap-5" aria-label="Manager settings">
    <p className="text-aux text-muted-foreground">Settings apply across all projects. Edit a row, then save it here.</p>
    {snapshot ? <ConfigurationFields key={reload} config={snapshot.config} save={save} disabled={busy || conflict} /> : busy ? <p role="status" className="text-ui">Loading settings…</p> : null}
    {error ? <p role="alert" className="text-ui text-destructive-fg">{error}</p> : null}
    {conflict || error ? <div className="flex flex-wrap items-center gap-3">
      {conflict ? <p role="alert" className="text-aux text-warning-fg">Settings changed elsewhere. Your edits have not been saved.</p> : null}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setReload((n) => n + 1)}>{conflict ? "Discard edits & reload" : "Retry loading"}</Button>
    </div> : null}
  </div>;
}

export function ConfigurationFields({ config, save, disabled }: { config: ManagerConfig; save: (changes: Record<string, unknown>) => Promise<void>; disabled: boolean }) {
  return <div className="flex min-w-0 flex-col gap-6">
    {configurationRows(config).map((section) => <section key={section.title} aria-label={`${section.title} settings`}>
      <h3 className="text-section">{section.title}</h3>
      {section.hint ? <p className="mt-1 text-aux text-muted-foreground">{section.hint}</p> : null}
      <div className="mt-2 divide-y divide-border">
        {section.rows.map((row) => <EditableSettingRow key={row.id} row={row} disabled={disabled} save={save} />)}
      </div>
    </section>)}
  </div>;
}

/** Rome settings pattern: label/description left, naturally-sized control right. */
export function SettingRow({ title, hint, controlId, children }: { title: string; hint?: string; controlId?: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-x-6 gap-y-3 py-3" data-setting-row>
    <div className="min-w-0 flex-1 basis-56">
      {controlId ? <FieldLabel htmlFor={controlId}>{title}</FieldLabel> : <p className="text-ui">{title}</p>}
      {hint ? <p id={controlId ? `${controlId}-hint` : undefined} className="mt-1 text-aux text-muted-foreground">{hint}</p> : null}
    </div>
    <div className="w-full min-w-0 shrink-0 sm:w-auto sm:max-w-[55%]">{children}</div>
  </div>;
}

export function EditableSettingRow({ row, save, disabled }: { row: Setting; save: (changes: Record<string, unknown>) => Promise<void>; disabled: boolean }) {
  const id = useId();
  const [value, setValue] = useState(row.value);
  const [baseline, setBaseline] = useState(row.value);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = !Object.is(value, baseline);
  // Other rows can save without replacing this row's draft. A normalized saved
  // value becomes the new baseline once its own request has completed.
  useEffect(() => { if (!pending && !dirty) { setValue(row.value); setBaseline(row.value); } }, [row.value, pending, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (next: Value) => { setValue(next); setSaved(false); setError(undefined); };
  async function submit() {
    if (!dirty || pending || disabled) return;
    setPending(true); setError(undefined);
    try { await save(row.changes(value)); setBaseline(value); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPending(false); }
  }
  const blocked = disabled || pending;
  return <form aria-label={`${row.title} setting`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    <SettingRow title={row.title} hint={row.hint} controlId={id}>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        {row.kind === "toggle" ? <Switch id={id} aria-describedby={`${id}-hint`} checked={value as boolean} onCheckedChange={change} disabled={blocked} />
          : row.kind === "select" ? <Select value={String(value)} onValueChange={change} disabled={blocked}><SelectTrigger id={id} aria-describedby={`${id}-hint`} className="w-48"><SelectValue /></SelectTrigger><SelectContent>{row.options!.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
          : <Input id={id} aria-describedby={`${id}-hint`} disabled={blocked} className={row.kind === "number" ? "w-24" : "w-full sm:w-72"}
            type={row.kind === "number" ? "number" : "text"} min={row.kind === "number" ? 1 : undefined} max={row.kind === "number" ? row.max : undefined} step={row.kind === "number" ? 1 : undefined}
            maxLength={row.kind === "text" ? row.max ?? 4096 : undefined} required={!row.optional} value={typeof value === "number" && Number.isNaN(value) ? "" : String(value)}
            onChange={(e) => change(row.kind === "number" ? (e.target.value === "" ? NaN : Number(e.target.value)) : e.target.value)} />}
        {dirty ? <div className="flex items-center gap-1">
          <Button type="submit" size="xs" disabled={blocked}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => { setValue(row.value); setBaseline(row.value); setError(undefined); setSaved(false); }}>Cancel</Button>
        </div> : saved ? <span role="status" className="text-aux text-muted-foreground">Saved</span> : null}
        {error ? <p role="alert" className="max-w-72 text-aux text-destructive-fg">{error}</p> : null}
      </div>
    </SettingRow>
  </form>;
}
