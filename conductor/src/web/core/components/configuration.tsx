import { useCallback, useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { DialogBody, DialogFooter } from "@rome-os/ui/dialog";
import { Field, FieldError, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { FormRow, FormRowControl, FormRowDescription, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { List, ListRow } from "@rome-os/ui/list-row";
import { Section, SectionActions, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import { Textarea } from "@rome-os/ui/textarea";
import { ChevronRight } from "lucide-react";
import { presentConfig, responseError, type ConfigResponse } from "../lib/config-api";
import { deriveProjectStatus } from "../lib/configuration";
import { safeText } from "../lib/facts";
import { useInspection } from "../lib/use-inspection";
import type { ConfigJson, ProjectPresentation, RuntimeJson } from "../lib/types";
import { ProjectStatusDot } from "./project-status";

const JSON_HEADERS = { "content-type": "application/json" };
type ProjectValue = ConfigJson["projects"][string];

function useConfig() {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [projectPresentation, setProjectPresentation] = useState<Record<string, ProjectPresentation>>({});
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback((body: ConfigResponse) => {
    setConfig(presentConfig(body.config));
    setRuntime(body.runtime);
    setProjectPresentation(body.projectPresentation ?? {});
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

  return { config, runtime, projectPresentation, error, accept, setError };
}

export function ProjectsOverview({ onOpenProject, onAddProject, onEditSop }: {
  onOpenProject: (id: string) => void;
  onAddProject: () => void;
  onEditSop: () => void;
}) {
  const { config, runtime, projectPresentation, error } = useConfig();

  if (error && !config) return <ErrorCard message={error} />;
  if (!config || !runtime) return <Loading />;

  const projects = Object.entries(config.projects);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Projects</SectionTitle>
            <SectionDescription>Each task keeps the project binding it was created with.</SectionDescription>
          </SectionHeading>
          <SectionActions>
            <Button size="sm" onClick={onAddProject}>Add project</Button>
          </SectionActions>
        </SectionHeader>
        {projects.length === 0 ? (
          <p className="text-ui text-muted-foreground">Add the first project to finish configuring Conductor.</p>
        ) : (
          <List>
            {projects.map(([id, project]) => (
              <ProjectListRow
                key={id}
                id={id}
                project={project}
                isDefault={config.defaultProject === id}
                runtime={runtime}
                presentation={projectPresentation[id]}
                onOpen={onOpenProject}
              />
            ))}
          </List>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Operating procedure</SectionTitle>
            <SectionDescription>The workflow, as a prompt. Takes effect on every open task.</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        <FormRows>
          <FormRow>
            <FormRowHeading>
              <FormRowLabel>Global SOP</FormRowLabel>
              <FormRowDescription>{runtime.sopBuiltIn ? "Built-in" : "Custom"} · {config.sop.length.toLocaleString()} chars</FormRowDescription>
            </FormRowHeading>
            <FormRowControl>
              <Button variant="outline" size="sm" onClick={onEditSop}>Edit</Button>
            </FormRowControl>
          </FormRow>
        </FormRows>
      </Section>
    </div>
  );
}

function ProjectListRow({ id, project, isDefault, runtime, presentation, onOpen }: {
  id: string;
  project: ProjectValue;
  isDefault: boolean;
  runtime: RuntimeJson;
  presentation?: ProjectPresentation;
  onOpen: (id: string) => void;
}) {
  const workspace = typeof project.workspace === "string" ? project.workspace : runtime.defaultWorkspaceKind;
  const workingDir = typeof project.workingDir === "string" ? project.workingDir : "";
  const { inspection, inspectionError } = useInspection(workspace, workingDir);
  const status = deriveProjectStatus(inspection, inspectionError, false, workspace === "none");
  const reference = presentation?.repo ?? "";
  const intake = presentation?.sourceEnabled ? presentation.sourceValue ?? "on" : "off";

  return (
    <ListRow asChild interactive className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.6fr)_auto_auto] gap-3">
      <button type="button" onClick={() => onOpen(id)}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{safeText(id)}</span>
          {isDefault && <Badge variant="info">default</Badge>}
        </span>
        <span className="truncate font-mono text-aux text-muted-foreground">{reference ? safeText(reference) : "—"}</span>
        <span className="truncate text-aux text-muted-foreground">{safeText(intake)}</span>
        <ProjectStatusDot status={status} showLabel />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </ListRow>
  );
}

export function AddProjectBody({ onBack, onCreated }: {
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const { config, runtime, error: loadError } = useConfig();
  const [id, setId] = useState("");
  const [workingDir, setWorkingDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!config || !runtime) return;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      setError("Project id must use lowercase letters, numbers, and hyphens, and start with a letter or number.");
      return;
    }
    if (Object.keys(config.projects).includes(id)) {
      setError(`A project named ${id} already exists.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetchAppApi("config", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ projects: { [id]: { workingDir, workspace: runtime.defaultWorkspaceKind } } }),
      });
      if (!response.ok) { setError(await responseError(response)); return; }
      onCreated(id);
    } finally {
      setSaving(false);
    }
  };

  const ready = Boolean(config && runtime);

  return (
    <>
      <DialogBody className="flex min-h-[60vh] flex-col gap-4">
        {loadError && !ready ? (
          <ErrorCard message={loadError} />
        ) : !ready ? (
          <Loading />
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="add-project-id">Project id</FieldLabel>
              <Input id="add-project-id" value={id} onChange={(event) => { setId(event.target.value); setError(null); }} placeholder="my-project" />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-project-dir">Working directory</FieldLabel>
              <Input id="add-project-dir" className="font-mono" value={workingDir} onChange={(event) => setWorkingDir(event.target.value)} placeholder="/absolute/path" />
            </Field>
            {error && <FieldError errors={[safeText(error)]} />}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onBack} disabled={saving}>Cancel</Button>
        <Button onClick={() => void submit()} disabled={!ready || saving || !id}>{saving && <Spinner />}Create</Button>
      </DialogFooter>
    </>
  );
}

export function SopEditorBody({ onBack, onSaved, onDirtyChange }: {
  onBack: () => void;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { config, runtime, error: loadError, accept, setError } = useConfig();
  const [draft, setDraft] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config && !seeded) { setDraft(config.sop); setSeeded(true); }
  }, [config, seeded]);

  const dirty = seeded && config !== null && draft !== config.sop;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const submit = async (revert = false) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetchAppApi("config", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ sop: revert ? "" : draft }),
      });
      if (!response.ok) { setError(await responseError(response)); return; }
      accept(await response.json() as ConfigResponse);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const ready = Boolean(config && runtime);
  const builtIn = runtime?.sopBuiltIn ?? true;

  return (
    <>
      <DialogBody className="flex min-h-[60vh] flex-col gap-2">
        {loadError && !ready ? (
          <ErrorCard message={loadError} />
        ) : !ready ? (
          <Loading />
        ) : (
          <>
            <Textarea
              className="block min-h-[50vh] flex-1 resize-none font-mono text-xs leading-[1.65]"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Global SOP"
              spellCheck={false}
            />
            <span className="text-aux text-muted-foreground">markdown · {draft.length.toLocaleString()} chars{builtIn && !dirty ? " · built-in" : ""}</span>
          </>
        )}
      </DialogBody>
      <DialogFooter className="flex-wrap">
        {ready && !builtIn && <Button variant="outline" disabled={saving} onClick={() => void submit(true)}>Revert to built-in</Button>}
        <span className="flex-1" />
        <Button variant="ghost" disabled={saving} onClick={onBack}>Cancel</Button>
        <Button disabled={!ready || saving || !dirty} onClick={() => void submit()}>{saving && <Spinner />}{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </>
  );
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
