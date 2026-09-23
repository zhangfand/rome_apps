import { useCallback, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { Input } from "@rome-os/ui/input";
import { FormRow, FormRowControl, FormRowDescription, FormRowHeading, FormRowLabel, FormRows } from "@rome-os/ui/layout-form";
import { List, ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "@rome-os/ui/list-row";
import { Section, SectionDescription, SectionHeader, SectionHeading, SectionTitle } from "@rome-os/ui/page";
import { Spinner } from "@rome-os/ui/spinner";
import { Switch } from "@rome-os/ui/switch";
import { responseError, type ConfigResponse } from "../lib/config-api.js";
import { safeText } from "../lib/facts.js";
import type { ConfigJson } from "../lib/types.js";

export function RuntimeSettings({ config, onSaved }: { config: ConfigJson; onSaved: (body: ConfigResponse) => void }) {
  const [draft, setDraft] = useState(() => limitsDraft(config));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = !sameLimits(draft, limitsDraft(config));

  const save = useCallback(async () => {
    const parsed = parseLimitsDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const response = await fetchAppApi("config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.patch),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = await response.json() as ConfigResponse;
      setDraft(limitsDraft(body.config));
      onSaved(body);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The runtime settings could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved]);

  return (
    <>
      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Runtime</SectionTitle>
            <SectionDescription>Persistent coordination, capacity, cadence, and worker-liveness settings.</SectionDescription>
          </SectionHeading>
          <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving && <Spinner />}{saving ? "Saving…" : "Save changes"}
          </Button>
        </SectionHeader>
        <FormRows>
          <SettingRow label="Coordinator" description="The agent that reads each task's history and records the next step.">
            <Input aria-label="Coordinator" className="w-full font-mono sm:w-64" value={draft.orchestratorAgent} disabled={saving}
              onChange={(event) => setDraft({ ...draft, orchestratorAgent: event.target.value })} />
          </SettingRow>
          <SettingRow label="Max workers" description="Across all tasks at once.">
            <NumberSetting value={draft.maxWorkers} label="Max workers" max={50} disabled={saving}
              onChange={(value) => setDraft({ ...draft, maxWorkers: value })} />
          </SettingRow>
          <SettingRow label="Tick every" description="How often sources are polled and open tasks are looked at.">
            <NumberSetting value={draft.intervalMinutes} label="Tick interval" max={1440} suffix="min" disabled={saving}
              onChange={(value) => setDraft({ ...draft, intervalMinutes: value })} />
          </SettingRow>
          <SettingRow label="Reuse sessions" description="A follow-up worker continues the previous worker's session.">
            <Switch aria-label="Reuse sessions" checked={draft.reuseSessions} disabled={saving}
              onCheckedChange={(value) => setDraft({ ...draft, reuseSessions: value })} />
          </SettingRow>
          <SettingRow label="Decisions per turn" description="Steps taken on a task before it waits for a person.">
            <NumberSetting value={draft.maxDecisionsPerTurn} label="Decisions per turn" max={1000} disabled={saving}
              onChange={(value) => setDraft({ ...draft, maxDecisionsPerTurn: value })} />
          </SettingRow>
          <SettingRow label="Heartbeat lease" description="A worker silent this long is treated as gone.">
            <NumberSetting value={draft.heartbeatLeaseMinutes} label="Heartbeat lease" max={1440} suffix="min" disabled={saving}
              onChange={(value) => setDraft({ ...draft, heartbeatLeaseMinutes: value })} />
          </SettingRow>
        </FormRows>
        {error && <p className="mt-3 text-ui text-destructive">{safeText(error)}</p>}
      </Section>

      <Section>
        <SectionHeader>
          <SectionHeading>
            <SectionTitle>Worker agents</SectionTitle>
            <SectionDescription>What the coordinator may hand a task to.</SectionDescription>
          </SectionHeading>
        </SectionHeader>
        <List>
          {Object.entries(config.workerAgents).map(([id, description]) => (
            <ListRow key={id}>
              <ListRowContent>
                <ListRowTitle className="font-mono text-aux">{safeText(id)}</ListRowTitle>
                <ListRowDescription>{safeText(description)}</ListRowDescription>
              </ListRowContent>
            </ListRow>
          ))}
        </List>
      </Section>
    </>
  );
}

export interface LimitsDraft {
  orchestratorAgent: string;
  maxWorkers: string;
  intervalMinutes: string;
  reuseSessions: boolean;
  maxDecisionsPerTurn: string;
  heartbeatLeaseMinutes: string;
}

export function limitsDraft(config: ConfigJson): LimitsDraft {
  return {
    orchestratorAgent: config.orchestratorAgent,
    maxWorkers: String(config.maxWorkers),
    intervalMinutes: String(config.intervalMinutes),
    reuseSessions: config.reuseSessions,
    maxDecisionsPerTurn: String(config.maxDecisionsPerTurn),
    heartbeatLeaseMinutes: String(config.heartbeatLeaseMinutes),
  };
}

function sameLimits(a: LimitsDraft, b: LimitsDraft): boolean {
  return Object.keys(a).every((key) => a[key as keyof LimitsDraft] === b[key as keyof LimitsDraft]);
}

export function parseLimitsDraft(draft: LimitsDraft):
  | { ok: true; patch: Pick<ConfigJson, "orchestratorAgent" | "maxWorkers" | "intervalMinutes" | "reuseSessions" | "maxDecisionsPerTurn" | "heartbeatLeaseMinutes"> }
  | { ok: false; error: string } {
  const orchestratorAgent = draft.orchestratorAgent.trim();
  if (!orchestratorAgent) return { ok: false, error: "Coordinator is required." };
  const fields = [
    ["Max workers", draft.maxWorkers, 50],
    ["Tick interval", draft.intervalMinutes, 1440],
    ["Decisions per turn", draft.maxDecisionsPerTurn, 1000],
    ["Heartbeat lease", draft.heartbeatLeaseMinutes, 1440],
  ] as const;
  const values: number[] = [];
  for (const [label, raw, max] of fields) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      return { ok: false, error: `${label} must be a whole number from 1 to ${max}.` };
    }
    values.push(value);
  }
  return {
    ok: true,
    patch: {
      orchestratorAgent,
      maxWorkers: values[0]!,
      intervalMinutes: values[1]!,
      reuseSessions: draft.reuseSessions,
      maxDecisionsPerTurn: values[2]!,
      heartbeatLeaseMinutes: values[3]!,
    },
  };
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <FormRow>
      <FormRowHeading>
        <FormRowLabel>{label}</FormRowLabel>
        <FormRowDescription>{description}</FormRowDescription>
      </FormRowHeading>
      <FormRowControl>{children}</FormRowControl>
    </FormRow>
  );
}

function NumberSetting({ value, onChange, label, max, suffix, disabled }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  max: number;
  suffix?: string;
  disabled: boolean;
}) {
  return (
    <span className="flex items-center justify-end gap-2">
      <Input type="number" min={1} max={max} step={1} aria-label={label} className="w-24 font-mono" value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value)} />
      {suffix && <span className="w-7 text-aux text-muted-foreground">{suffix}</span>}
    </span>
  );
}
