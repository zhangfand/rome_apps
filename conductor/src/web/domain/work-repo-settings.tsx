import { useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@rome-os/ui/dialog";
import { Field, FieldError, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { FormRow, FormRowControl, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { Section, SectionActions, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import type { ProjectSettingsSlotProps } from "../core/domain";
import { PathSelector } from "../core/components/path-selector";
import { deriveProjectStatus } from "../core/lib/configuration";
import { responseError } from "../core/lib/config-api";
import { safeText } from "../core/lib/facts";
import { useInspection } from "../core/lib/use-inspection";
import { GitHubRepoSelector } from "./github-repo-selector";

export function WorkRepoSettings({ projectId, project, patch, disabled }: ProjectSettingsSlotProps) {
  const workRepo = objectValue(project.workRepo);
  const repo = stringValue(workRepo.repo);
  const workingDir = stringValue(workRepo.workingDir);
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createRepo, setCreateRepo] = useState("");
  const [createWorkingDir, setCreateWorkingDir] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { inspection, inspectionError, refresh } = useInspection("git-worktree", workingDir);
  const status = deriveProjectStatus(inspection, inspectionError, settingUp, false);
  const ready = status.tone === "ready";

  const setField = (changes: Record<string, unknown>, options?: { immediate?: boolean }) => {
    patch({ workRepo: { ...workRepo, ...changes } }, options);
    setSetupError(null);
  };

  const setup = async () => {
    setSettingUp(true);
    setSetupError(null);
    try {
      const response = await fetchAppApi("config/work-repo/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, workingDir }),
      });
      if (!response.ok) { setSetupError(await responseError(response)); return; }
      await refresh();
    } finally {
      setSettingUp(false);
    }
  };

  const openCreate = () => {
    // Reuse an unfinished configuration as a convenient draft. Once the
    // configured repository is ready, though, carrying its values into the
    // "new" flow would make the first submission fail on both the existing
    // remote and the occupied checkout.
    setCreateRepo(ready ? "" : repo);
    setCreateWorkingDir(ready ? "" : workingDir);
    setCreateError(null);
    setCreateOpen(true);
  };

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetchAppApi("config/work-repo/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: createRepo, workingDir: createWorkingDir }),
      });
      if (!response.ok) { setCreateError(await responseError(response)); return; }
      const result = await response.json() as { repo: string; workingDir: string };
      setField({ repo: result.repo, workingDir: result.workingDir }, { immediate: true });
      setCreateOpen(false);
      if (result.workingDir === workingDir) await refresh();
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "The repository could not be created.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>Agent work repository</SectionTitle>
          <SectionDescription>Shared specs, designs, and handoff records. Workers commit directly to its main branch.</SectionDescription>
        </SectionHeading>
        <SectionActions>
          <Button size="sm" variant="outline" disabled={disabled || settingUp || creating} onClick={openCreate}>
            New repository
          </Button>
          {!ready && (
            <Button size="sm" variant="outline" disabled={disabled || settingUp || !repo || !workingDir} onClick={() => void setup()}>
              {settingUp && <Spinner />}{settingUp ? "Setting up…" : "Set up"}
            </Button>
          )}
        </SectionActions>
      </SectionHeader>
      <FormRows>
        <FormRow>
          <FormRowHeading><FormRowLabel htmlFor="work-repo-name">Repository</FormRowLabel></FormRowHeading>
          <FormRowControl>
            <GitHubRepoSelector
              id="work-repo-name"
              value={repo}
              disabled={disabled}
              placeholder="owner/project-work"
              onValueChange={(value, source) => setField({ repo: value }, { immediate: source === "picker" })}
            />
          </FormRowControl>
        </FormRow>
        <FormRow>
          <FormRowHeading><FormRowLabel htmlFor="work-repo-dir">Local checkout</FormRowLabel></FormRowHeading>
          <FormRowControl>
            <PathSelector id="work-repo-dir" value={workingDir} disabled={disabled} onValueChange={(value, source) => patch({ workRepo: { ...workRepo, workingDir: value } }, { immediate: source === "picker" })} />
          </FormRowControl>
        </FormRow>
      </FormRows>
      {setupError && <FieldError errors={[safeText(setupError)]} />}

      <Dialog open={createOpen} onClose={() => { if (!creating) setCreateOpen(false); }} modal size="sm">
        <DialogHeader onClose={() => { if (!creating) setCreateOpen(false); }}>
          <DialogTitle>Create work repository</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <DialogDescription>
            Conductor will create a private GitHub repository, clone it locally, and use it for this project's coordination artifacts.
          </DialogDescription>
          <Field>
            <FieldLabel htmlFor={`create-work-repo-${projectId}`}>Repository</FieldLabel>
            <Input
              id={`create-work-repo-${projectId}`}
              className="font-mono"
              value={createRepo}
              onChange={(event) => { setCreateRepo(event.target.value); setCreateError(null); }}
              placeholder="owner/project-work"
              disabled={creating}
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`create-work-dir-${projectId}`}>Local checkout</FieldLabel>
            <PathSelector
              id={`create-work-dir-${projectId}`}
              value={createWorkingDir}
              disabled={creating}
              onValueChange={(value) => { setCreateWorkingDir(value); setCreateError(null); }}
            />
          </Field>
          {createError && <FieldError errors={[safeText(createError)]} />}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button disabled={creating || !createRepo.trim() || !createWorkingDir.trim()} onClick={() => void create()}>
            {creating && <Spinner />}{creating ? "Creating…" : "Create and clone"}
          </Button>
        </DialogFooter>
      </Dialog>
    </Section>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
