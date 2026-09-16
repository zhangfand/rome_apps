import { useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Spinner } from "@rome-os/ui/spinner";
import { Switch } from "@rome-os/ui/switch";
import type { ProjectSettingsFieldProps } from "../core/domain";
import { safeText } from "../core/lib/facts";

export function GitHubProjectSettings({ projectId, project, onChange, inspection, refreshInspection, disabled }: ProjectSettingsFieldProps) {
  const github = objectValue(project.github);
  const repo = stringValue(github.repo);
  const workingDir = stringValue(project.workingDir);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const normalizedRepo = normalizeRepo(repo);
  const mismatch = normalizedRepo && inspection?.originRepo && normalizedRepo.toLowerCase() !== inspection.originRepo.toLowerCase();
  const canClone = Boolean(normalizedRepo && workingDir && inspection && (
    !inspection.exists || (!inspection.isRepository && inspection.problem === "Directory is empty.")
  ));

  const changeGithub = (changes: Record<string, unknown>) => {
    onChange({ ...project, github: { ...github, ...changes } });
    setCloneError(null);
  };

  const clone = async () => {
    setCloning(true);
    setCloneError(null);
    try {
      const response = await fetchAppApi("config/clone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, workingDir }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setCloneError(body.error ?? `Clone failed (HTTP ${response.status}).`);
        return;
      }
      refreshInspection();
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold">GitHub</span>
        <div className="flex items-center gap-2">
          <Switch id={`github-enabled-${projectId || "new"}`} checked={github.enabled !== false} disabled={disabled} onCheckedChange={(enabled) => changeGithub({ enabled })} />
          <FieldLabel htmlFor={`github-enabled-${projectId || "new"}`}>Issue intake enabled</FieldLabel>
        </div>
      </div>
      <FieldGroup className="grid gap-3 sm:grid-cols-3">
        <Field className="sm:col-span-3">
          <FieldLabel>Repository</FieldLabel>
          <Input value={repo} disabled={disabled} onChange={(event) => changeGithub({ repo: event.target.value })} placeholder="owner/name or https://github.com/owner/name" />
          <FieldDescription>Saved in normalized owner/name form.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Intake label</FieldLabel>
          <Input value={stringValue(github.intakeLabel)} disabled={disabled} onChange={(event) => changeGithub({ intakeLabel: event.target.value })} placeholder="conductor" />
        </Field>
        <Field>
          <FieldLabel>Project label</FieldLabel>
          <Input value={stringValue(github.projectLabel)} disabled={disabled} onChange={(event) => changeGithub({ projectLabel: event.target.value })} placeholder="optional" />
        </Field>
      </FieldGroup>
      {inspection?.isRepository && (
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {["✓ repository", inspection.originRepo ? `origin ${inspection.originRepo}` : undefined, inspection.defaultBranch, inspection.dirty === true ? "local changes" : inspection.dirty === false ? "clean" : undefined].filter(Boolean).join(" · ")}
        </p>
      )}
      {mismatch && (
        <Alert variant="warning"><AlertDescription>⚠ origin is {safeText(inspection.originRepo!)} but the project says {safeText(normalizedRepo)}</AlertDescription></Alert>
      )}
      {canClone && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled || cloning} onClick={() => void clone()}>
            {cloning && <Spinner />}{cloning ? "Cloning…" : "Clone here"}
          </Button>
          <span className="text-xs text-muted-foreground">Creates the configured repository at this working directory.</span>
        </div>
      )}
      {cloneError && <FieldError errors={[safeText(cloneError)]} />}
    </div>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeRepo(value: string): string | undefined {
  const normalized = value.trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^ssh:\/\/git@github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  return /^(?!\.{1,2}\/)(?!.*\/\.{1,2}$)[\w.-]+\/[\w.-]+$/.test(normalized) ? normalized : undefined;
}
