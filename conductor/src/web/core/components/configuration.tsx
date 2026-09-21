import { useCallback, useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card } from "@rome-os/ui/card";
import { DialogBody, DialogFooter } from "@rome-os/ui/dialog";
import { Field, FieldError, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Section, SectionActions, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { ChevronRight } from "lucide-react";
import { presentConfig, responseError, type ConfigResponse } from "../lib/config-api";
import { safeText } from "../lib/facts";
import type { ConfigJson, ProjectPresentation, RuntimeJson } from "../lib/types";
import { PathSelector } from "./path-selector";

const JSON_HEADERS = { "content-type": "application/json" };

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

export function ProjectsOverview({ onOpenProject, onAddProject }: {
  onOpenProject: (id: string) => void;
  onAddProject: () => void;
}) {
  const { config, projectPresentation, error } = useConfig();

  if (error && !config) return <ErrorCard message={error} />;
  if (!config) return <Loading />;

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
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="border-r border-border-subtle">Project</TableHead>
                  <TableHead scope="col" className="border-r border-border-subtle">Repository</TableHead>
                  <TableHead scope="col" className="w-28 border-r border-border-subtle">Intake</TableHead>
                  <TableHead scope="col" className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map(([id]) => (
                  <ProjectTableRow
                    key={id}
                    id={id}
                    isDefault={config.defaultProject === id}
                    presentation={projectPresentation[id]}
                    onOpen={onOpenProject}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Section>

    </div>
  );
}

function ProjectTableRow({ id, isDefault, presentation, onOpen }: {
  id: string;
  isDefault: boolean;
  presentation?: ProjectPresentation;
  onOpen: (id: string) => void;
}) {
  const reference = presentation?.repo ?? "";
  const intake = presentation?.sourceEnabled ? presentation.sourceValue ?? "on" : "off";

  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(id)}>
      <TableCell className="border-r border-border-subtle">
        <span className="flex min-w-0 items-center gap-2">
          <Button variant="link" size="xs" align="start" className="min-w-0 truncate px-0 font-medium text-foreground" onClick={() => onOpen(id)}>
            {safeText(id)}
          </Button>
          {isDefault && <Badge variant="info">default</Badge>}
        </span>
      </TableCell>
      <TableCell className="max-w-0 border-r border-border-subtle font-mono text-aux text-muted-foreground">
        <span className="block truncate">{reference ? safeText(reference) : "—"}</span>
      </TableCell>
      <TableCell className="border-r border-border-subtle text-aux text-muted-foreground">{safeText(intake)}</TableCell>
      <TableCell className="text-right"><ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" /></TableCell>
    </TableRow>
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
              <PathSelector id="add-project-dir" value={workingDir} onValueChange={(value) => setWorkingDir(value)} />
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
