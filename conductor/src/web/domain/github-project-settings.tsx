import { useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { FieldError } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { FormRow, FormRowControl, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { Section, SectionActions, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import { Switch } from "@rome-os/ui/switch";
import type { ProjectSettingsSlotProps } from "../core/domain";
import { safeText } from "../core/lib/facts";
import { GitHubRepoSelector } from "./github-repo-selector";

export function GitHubProjectSettings({ projectId, project, patch, inspection, refreshInspection, disabled }: ProjectSettingsSlotProps) {
  const github = objectValue(project.github);
  const enabled = github.enabled !== false;
  const repo = stringValue(github.repo);
  const workingDir = stringValue(project.workingDir);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const normalizedRepo = normalizeRepo(repo);
  const canClone = Boolean(normalizedRepo && workingDir && inspection && (
    !inspection.exists || (!inspection.isRepository && inspection.problem === "Directory is empty.")
  ));

  const setField = (changes: Record<string, unknown>, options?: { immediate?: boolean }) => {
    patch({ github: { ...github, ...changes } }, options);
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
    <Section>
      <SectionHeader>
        <SectionHeading><SectionTitle>GitHub issue intake</SectionTitle></SectionHeading>
        <SectionActions className="min-w-0 max-w-full">
          {canClone && (
            <Button type="button" variant="outline" size="sm" disabled={disabled || cloning} onClick={() => void clone()}>
              {cloning && <Spinner />}{cloning ? "Cloning…" : "Clone here"}
            </Button>
          )}
        </SectionActions>
      </SectionHeader>
      <FormRows>
        <FormRow>
          <FormRowHeading><FormRowLabel htmlFor={`github-enabled-${projectId}`}>Take issues from GitHub</FormRowLabel></FormRowHeading>
          <FormRowControl>
            <Switch id={`github-enabled-${projectId}`} checked={enabled} disabled={disabled} onCheckedChange={(value) => setField({ enabled: value }, { immediate: true })} />
          </FormRowControl>
        </FormRow>
        {enabled && (
          <>
            <FormRow>
              <FormRowHeading><FormRowLabel htmlFor={`github-repo-${projectId}`}>Repository</FormRowLabel></FormRowHeading>
              <FormRowControl>
                <GitHubRepoSelector
                  id={`github-repo-${projectId}`}
                  value={repo}
                  disabled={disabled}
                  onValueChange={(value, source) => setField({ repo: value }, { immediate: source === "picker" })}
                />
              </FormRowControl>
            </FormRow>
            <FormRow>
              <FormRowHeading><FormRowLabel htmlFor={`github-intake-${projectId}`}>Intake label</FormRowLabel></FormRowHeading>
              <FormRowControl>
                <Input id={`github-intake-${projectId}`} className="w-36 min-w-0 sm:w-48" value={stringValue(github.intakeLabel)} disabled={disabled} onChange={(event) => setField({ intakeLabel: event.target.value })} placeholder="conductor" />
              </FormRowControl>
            </FormRow>
            <FormRow>
              <FormRowHeading><FormRowLabel htmlFor={`github-project-${projectId}`}>Project label</FormRowLabel></FormRowHeading>
              <FormRowControl>
                <Input id={`github-project-${projectId}`} className="w-36 min-w-0 sm:w-48" value={stringValue(github.projectLabel)} disabled={disabled} onChange={(event) => setField({ projectLabel: event.target.value })} placeholder="optional" />
              </FormRowControl>
            </FormRow>
          </>
        )}
      </FormRows>
      {cloneError && <FieldError errors={[safeText(cloneError)]} />}
    </Section>
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
