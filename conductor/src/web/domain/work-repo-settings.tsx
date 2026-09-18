import { useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { FieldError } from "@rome-os/ui/field";
import { FormRow, FormRowControl, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { Section, SectionActions, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import type { ProjectSettingsSlotProps } from "../core/domain";
import { PathSelector } from "../core/components/path-selector";
import { ProjectStatusDot } from "../core/components/project-status";
import { deriveProjectStatus } from "../core/lib/configuration";
import { responseError } from "../core/lib/config-api";
import { safeText } from "../core/lib/facts";
import { useInspection } from "../core/lib/use-inspection";
import { GitHubRepoSelector } from "./github-repo-selector";

export function WorkRepoSettings({ project, patch, disabled }: ProjectSettingsSlotProps) {
  const workRepo = objectValue(project.workRepo);
  const repo = stringValue(workRepo.repo);
  const workingDir = stringValue(workRepo.workingDir);
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
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

  return (
    <Section>
      <SectionHeader>
        <SectionHeading>
          <SectionTitle>Agent work repository</SectionTitle>
          <SectionDescription>Shared specs, designs, and handoff records. Workers commit directly to its main branch.</SectionDescription>
        </SectionHeading>
        <SectionActions>
          <span className="flex items-center gap-1.5">
            <ProjectStatusDot status={status} />
            <span className="text-aux text-muted-foreground">{settingUp ? "Setting up…" : status.label}</span>
          </span>
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
    </Section>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
