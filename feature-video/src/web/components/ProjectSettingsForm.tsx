import { useEffect, useState } from "react";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FormError } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Spinner } from "@rome-os/ui/spinner";
import { Textarea } from "@rome-os/ui/textarea";
import type { ProjectSettings } from "../../lib/types.js";
import type { ProjectDto } from "../lib/api";

/** The form's own draft. `readyTarget` is edited as JSON, so it is text until it parses. */
interface Draft {
  name: string;
  baseUrl: string;
  readyTarget: string;
  stageSelector: string;
  layout: string;
  video: string;
  fps: string;
  timezone: string;
  locale: string;
}

function draftOf(project: ProjectDto): Draft {
  return {
    name: project.name,
    baseUrl: project.baseUrl,
    readyTarget: JSON.stringify(project.readyTarget, null, 2),
    stageSelector: project.stageSelector ?? "",
    layout: project.layout,
    video: project.video,
    fps: String(project.fps),
    timezone: project.timezone ?? "",
    locale: project.locale ?? "",
  };
}

export function ProjectSettingsForm({
  project,
  onSave,
}: {
  project: ProjectDto;
  onSave: (patch: Partial<ProjectSettings> & { name?: string }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switching projects in the list replaces what the form is editing.
  useEffect(() => setDraft(draftOf(project)), [project]);

  const set = (field: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    let readyTarget: ProjectSettings["readyTarget"];
    try {
      readyTarget = JSON.parse(draft.readyTarget);
    } catch {
      setError("The ready target is not valid JSON.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: draft.name,
        baseUrl: draft.baseUrl,
        readyTarget,
        stageSelector: draft.stageSelector.trim(),
        layout: draft.layout.trim(),
        video: draft.video.trim(),
        fps: Number(draft.fps),
        timezone: draft.timezone.trim(),
        locale: draft.locale.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="fv-project-name">Name</FieldLabel>
            <Input
              id="fv-project-name"
              value={draft.name}
              onChange={(event) => set("name")(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fv-base-url">Base URL</FieldLabel>
            <Input
              id="fv-base-url"
              value={draft.baseUrl}
              inputMode="url"
              autoComplete="off"
              onChange={(event) => set("baseUrl")(event.target.value)}
            />
            <FieldDescription>Every start path and goto resolves against this.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="fv-ready-target">Ready target</FieldLabel>
            <Textarea
              id="fv-ready-target"
              className="font-mono"
              rows={4}
              spellCheck={false}
              value={draft.readyTarget}
              onChange={(event) => set("readyTarget")(event.target.value)}
            />
            <FieldDescription>
              The recorder waits for this before the first beat, which is how it knows the app has
              loaded.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="fv-stage-selector">Stage selector</FieldLabel>
            <Input
              id="fv-stage-selector"
              value={draft.stageSelector}
              autoComplete="off"
              placeholder="#root"
              onChange={(event) => set("stageSelector")(event.target.value)}
            />
            <FieldDescription>
              The element that fills the frame. Empty means the first element child of the body.
            </FieldDescription>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="fv-layout">Layout</FieldLabel>
              <Input
                id="fv-layout"
                value={draft.layout}
                autoComplete="off"
                onChange={(event) => set("layout")(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fv-video">Video</FieldLabel>
              <Input
                id="fv-video"
                value={draft.video}
                autoComplete="off"
                onChange={(event) => set("video")(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fv-fps">Frames per second</FieldLabel>
              <Input
                id="fv-fps"
                value={draft.fps}
                inputMode="numeric"
                onChange={(event) => set("fps")(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="fv-timezone">Timezone</FieldLabel>
              <Input
                id="fv-timezone"
                value={draft.timezone}
                autoComplete="off"
                placeholder="America/Los_Angeles"
                onChange={(event) => set("timezone")(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="fv-locale">Locale</FieldLabel>
              <Input
                id="fv-locale"
                value={draft.locale}
                autoComplete="off"
                placeholder="en-US"
                onChange={(event) => set("locale")(event.target.value)}
              />
            </Field>
          </div>
          {error ? <FormError>{error}</FormError> : null}
          <div className="flex">
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner size="sm" /> : null}
              {saving ? "Saving" : "Save stage"}
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
