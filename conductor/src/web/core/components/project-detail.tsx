import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { FieldError } from "@rome-os/ui/field";
import { FormRow, FormRowControl, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { Section, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rome-os/ui/select";
import { Switch } from "@rome-os/ui/switch";
import { Textarea } from "@rome-os/ui/textarea";
import { webDomain } from "../domain";
import { presentConfig, responseError, type ConfigResponse } from "../lib/config-api";
import { createSaveQueue, saveStatusText, type SaveQueue } from "../lib/configuration";
import { safeText } from "../lib/facts";
import { useInspection } from "../lib/use-inspection";
import type { ConfigJson, RuntimeJson } from "../lib/types";
import { PathSelector } from "./path-selector";

const JSON_HEADERS = { "content-type": "application/json" };
const IDLE_MS = 600;
type ProjectValue = ConfigJson["projects"][string];

export function ProjectSettingsBody({ projectId, onBack, reportStatus, reportHeading }: {
  projectId: string;
  onBack: () => void;
  reportStatus: (text: string) => void;
  reportHeading: (heading: { isDefault: boolean }) => void;
}) {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [runtime, setRuntime] = useState<RuntimeJson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const accept = useCallback((body: ConfigResponse) => {
    setConfig(presentConfig(body.config));
    setRuntime(body.runtime);
    setLoadError(null);
    setReady(true);
  }, []);

  useEffect(() => {
    setReady(false);
    void (async () => {
      try {
        const response = await fetchAppApi("config");
        if (!response.ok) throw new Error(await responseError(response));
        accept(await response.json() as ConfigResponse);
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : "The settings could not be read. Try again.");
        setReady(true);
      }
    })();
  }, [accept, projectId]);

  if (!ready) return <Loading />;
  if (loadError && !config) return <NotConfigured message={loadError} onBack={onBack} />;
  if (!config || !runtime) return <Loading />;
  if (!config.projects[projectId]) return <NotFound projectId={projectId} onBack={onBack} />;

  return (
    <ProjectDetailBody
      key={projectId}
      projectId={projectId}
      initialConfig={config}
      runtime={runtime}
      onServerConfig={setConfig}
      onBack={onBack}
      reportStatus={reportStatus}
      reportHeading={reportHeading}
    />
  );
}

function ProjectDetailBody({ projectId, initialConfig, runtime, onServerConfig, onBack, reportStatus, reportHeading }: {
  projectId: string;
  initialConfig: ConfigJson;
  runtime: RuntimeJson;
  onServerConfig: (config: ConfigJson) => void;
  onBack: () => void;
  reportStatus: (text: string) => void;
  reportHeading: (heading: { isDefault: boolean }) => void;
}) {
  const initialProject = initialConfig.projects[projectId] as ProjectValue;
  const [draft, setDraftState] = useState<ProjectValue>(() => ({ ...initialProject }));
  const [isDefault, setIsDefaultState] = useState(initialConfig.defaultProject === projectId);

  const draftRef = useRef(draft);
  const isDefaultRef = useRef(isDefault);
  const configRef = useRef(initialConfig);
  const debounce = useRef<number | undefined>(undefined);
  const pending = useRef(false);

  const setDraft = (next: ProjectValue) => { draftRef.current = next; setDraftState(next); };
  const setIsDefault = (next: boolean) => { isDefaultRef.current = next; setIsDefaultState(next); };

  const buildBody = useCallback((project: ProjectValue, defaultOn: boolean): Record<string, unknown> => ({
    projects: { [projectId]: project },
    ...(defaultOn
      ? { defaultProject: projectId }
      : configRef.current.defaultProject === projectId
        ? { defaultProject: "" }
        : {}),
  }), [projectId]);

  const save = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetchAppApi("config", { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(await responseError(response));
    const data = await response.json() as ConfigResponse;
    const presented = presentConfig(data.config);
    configRef.current = presented;
    onServerConfig(presented);
    const sentProject = (body.projects as Record<string, ProjectValue>)[projectId];
    const serverProject = presented.projects[projectId];
    if (serverProject && JSON.stringify(draftRef.current) === JSON.stringify(sentProject)) {
      setDraft({ ...serverProject });
      setIsDefault(presented.defaultProject === projectId);
    }
  }, [projectId, onServerConfig]);

  const queue: SaveQueue<Record<string, unknown>> = useMemo(() => createSaveQueue({ save }), [save]);
  const status = useSyncExternalStore(queue.subscribe, () => queue.status);

  useEffect(() => { reportStatus(saveStatusText(status)); }, [status, reportStatus]);

  const scheduleSave = useCallback((immediate: boolean) => {
    window.clearTimeout(debounce.current);
    const fire = () => { pending.current = false; queue.enqueue(buildBody(draftRef.current, isDefaultRef.current)); };
    if (immediate) fire();
    else { pending.current = true; debounce.current = window.setTimeout(fire, IDLE_MS); }
  }, [queue, buildBody]);

  const flushOnClose = useRef<() => void>(() => {});
  flushOnClose.current = () => {
    window.clearTimeout(debounce.current);
    if (pending.current) { pending.current = false; queue.enqueue(buildBody(draftRef.current, isDefaultRef.current)); }
  };
  useEffect(() => () => flushOnClose.current(), []);

  const applyPatch = useCallback((partial: Record<string, unknown>, options?: { immediate?: boolean }) => {
    setDraft({ ...draftRef.current, ...partial });
    scheduleSave(options?.immediate ?? false);
  }, [scheduleSave]);

  const flush = useCallback(() => scheduleSave(true), [scheduleSave]);

  const setDefault = (on: boolean) => { setIsDefault(on); scheduleSave(true); };

  const workspace = typeof draft.workspace === "string" ? draft.workspace : runtime.defaultWorkspaceKind;
  const workingDir = typeof draft.workingDir === "string" ? draft.workingDir : "";
  useEffect(() => { reportHeading({ isDefault }); }, [isDefault, reportHeading]);
  const sopOverride = typeof draft.sop === "string" ? draft.sop : "";
  const { inspection, refresh: refreshInspection } = useInspection(workspace, workingDir);
  const slots = webDomain().projectSettingsFields;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <Section>
        <SectionHeader><SectionHeading><SectionTitle>General</SectionTitle></SectionHeading></SectionHeader>
        <FormRows>
          <FormRow>
            <FormRowHeading><FormRowLabel htmlFor="project-working-dir">Working directory</FormRowLabel></FormRowHeading>
            <FormRowControl>
              <PathSelector
                id="project-working-dir"
                value={workingDir}
                onValueChange={(value, source) => applyPatch({ workingDir: value }, { immediate: source === "picker" })}
                onBlur={flush}
              />
            </FormRowControl>
          </FormRow>
          <FormRow>
            <FormRowHeading><FormRowLabel>Workspace kind</FormRowLabel></FormRowHeading>
            <FormRowControl>
              <Select value={workspace} onValueChange={(value) => applyPatch({ workspace: value }, { immediate: true })}>
                <SelectTrigger className="w-40 sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {runtime.workspaceKinds.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormRowControl>
          </FormRow>
          <FormRow>
            <FormRowHeading><FormRowLabel htmlFor="project-default">Default project</FormRowLabel></FormRowHeading>
            <FormRowControl>
              <Switch id="project-default" checked={isDefault} onCheckedChange={setDefault} />
            </FormRowControl>
          </FormRow>
        </FormRows>
      </Section>

      {slots.map((Slot, index) => (
        <Slot
          key={index}
          projectId={projectId}
          project={draft as Record<string, unknown>}
          config={configRef.current}
          patch={applyPatch}
          inspection={inspection}
          refreshInspection={refreshInspection}
          disabled={false}
        />
      ))}

      <Section>
        <SectionHeader><SectionHeading><SectionTitle>Operating procedure</SectionTitle></SectionHeading></SectionHeader>
        <div className="flex flex-col gap-1.5">
          <Textarea
            aria-label="Project operating procedure override"
            className="min-h-32 w-full resize-y font-mono text-xs leading-[1.65]"
            value={sopOverride}
            onChange={(event) => applyPatch({ sop: event.target.value })}
            onBlur={flush}
          />
          <p className="text-aux text-muted-foreground">Leave empty to use the global SOP.</p>
        </div>
      </Section>

      <DangerZone projectId={projectId} onRemoved={onBack} />
    </div>
  );
}

function DangerZone({ projectId, onRemoved }: { projectId: string; onRemoved: () => void }) {
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async (force = false) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchAppApi(`config${force ? "?force=1" : ""}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ projects: { [projectId]: null } }),
      });
      if (response.status === 409 && !force) {
        const body = await response.json().catch(() => ({})) as { error?: string; count?: number };
        if (typeof body.count === "number") { setConfirmCount(body.count); return; }
        setError(body.error ?? "The project could not be removed.");
        return;
      }
      if (!response.ok) { setError(await responseError(response)); return; }
      setConfirmCount(null);
      onRemoved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-12 border border-destructive/40 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-section text-foreground">Remove project</h2>
        <p className="text-aux text-muted-foreground">Open tasks keep their binding; the project stops taking new work.</p>
      </div>
      <div>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>Remove project</Button>
      </div>
      {error && <FieldError errors={[safeText(error)]} />}
      <Dialog open={confirmCount !== null} onClose={() => setConfirmCount(null)} modal size="sm">
        <DialogHeader onClose={() => setConfirmCount(null)}><DialogTitle>Remove project?</DialogTitle></DialogHeader>
        <DialogBody>
          <DialogDescription>
            {confirmCount} open task{confirmCount === 1 ? " is" : "s are"} still bound to this project. Those tasks keep their pinned project details, but removing the project can make future intake unavailable.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmCount(null)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void remove(true)}>Remove anyway</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Loading() {
  return <p className="my-6 font-mono text-[13px] tracking-[0.06em] text-muted-foreground">reading settings<span className="loading-dot">.</span><span className="loading-dot loading-dot-2">.</span><span className="loading-dot loading-dot-3">.</span></p>;
}

function NotFound({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  return (
    <Alert className="max-w-[70ch]">
      <AlertTitle>No project named {safeText(projectId)}.</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        It may have been removed.
        <Button variant="outline" size="sm" onClick={onBack}>Back to settings</Button>
      </AlertDescription>
    </Alert>
  );
}

function NotConfigured({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <Alert variant="destructive" className="max-w-[70ch]">
      <AlertTitle>The settings could not be read.</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {safeText(message)}
        <Button variant="outline" size="sm" onClick={onBack}>Back to settings</Button>
      </AlertDescription>
    </Alert>
  );
}
