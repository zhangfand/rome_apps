import { useEffect, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import type { ConfigJson } from "../lib/types";

export function Configuration() {
  const [config, setConfig] = useState<ConfigJson | null>(null);
  const [sop, setSop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void (async () => {
      const res = await fetchAppApi("config");
      if (!res.ok) { setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`); return; }
      const { config: c } = (await res.json()) as { config: ConfigJson };
      setConfig(c); setSop(c.sop);
    })();
  }, []);
  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetchAppApi("config", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sop }) });
      if (!res.ok) { setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`); return; }
      const { config: c } = (await res.json()) as { config: ConfigJson };
      setConfig(c); setSop(c.sop); setSaved(true);
    } finally { setSaving(false); }
  };
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!config) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">SOP — the workflow, as a prompt</h2>
        <p className="text-sm text-muted-foreground">The orchestrator reads this with a task's ledger on every wake. Edit it to change how tasks are run; it applies to the next wake of every open task.</p>
        <textarea className="min-h-[28rem] rounded-md border border-border bg-background p-3 font-mono text-xs" value={sop} onChange={(e) => { setSop(e.target.value); setSaved(false); }} />
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={saving || sop === config.sop}>{saving ? "Saving…" : "Save SOP"}</Button>
          {saved && <span className="text-xs text-muted-foreground">Saved.</span>}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Projects</h2>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {Object.entries(config.projects).map(([id, p]) => (
            <li key={id} className="flex flex-col gap-0.5 px-4 py-2">
              <span className="font-medium">{id}{p.sop ? <span className="ml-2 rounded bg-muted px-1.5 text-xs">own SOP</span> : null}</span>
              <span className="font-mono text-xs text-muted-foreground">{p.workingDir}</span>
              {p.repo && <span className="text-xs text-muted-foreground">repo {p.repo}{p.intakeEnabled === false ? " (intake off)" : ` · intake label "${p.intakeLabel ?? config.intakeLabel}"${p.projectLabel ? ` + "${p.projectLabel}"` : ""}`}</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Runtime</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Orchestrator</dt><dd className="font-mono text-xs">{config.orchestratorAgent}</dd>
          <dt className="text-muted-foreground">Worker agents</dt><dd>{Object.entries(config.workerAgents).map(([a, d]) => <div key={a}><span className="font-mono text-xs">{a}</span> <span className="text-muted-foreground">— {d}</span></div>)}</dd>
          <dt className="text-muted-foreground">Max workers</dt><dd>{config.maxWorkers}</dd>
          <dt className="text-muted-foreground">Tick every</dt><dd>{config.intervalMinutes} min</dd>
          <dt className="text-muted-foreground">Reuse sessions</dt><dd>{String(config.reuseSessions)}</dd>
          <dt className="text-muted-foreground">Decisions per turn (safety valve)</dt><dd>{config.maxDecisionsPerTurn}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">Change these with <code>conductor:setup</code>.</p>
      </section>
    </div>
  );
}
