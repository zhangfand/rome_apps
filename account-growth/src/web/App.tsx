import "./styles.css";
import { useEffect, useState } from "react";
import {
  fetchAppApi,
  getCurrentAppPath,
  navigateToApp,
  startChat,
  subscribeToAppPath,
  type RomeAppBootstrap,
} from "@rome-os/app-web-sdk";
import { Activity, ArrowLeft, CalendarDays, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rome-os/ui/card";
import { Markdown } from "@rome-os/ui/markdown";

interface SavedPlan {
  id: string;
  title: string;
  markdown: string;
  performanceSummary: string | null;
  focus: string | null;
  createdAt: string;
}

interface AppState {
  appId: string;
  version: string;
  config: {
    niche: string;
    audience: string;
    voice: string;
    cadence: string;
    boundary: string;
    xAccount: string;
    linkedIn: string;
  };
  plans: SavedPlan[];
}

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [path, setPath] = useState(getCurrentAppPath());

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAppApi("state");
      if (!response.ok) throw new Error(`Could not load app state (${response.status})`);
      setState((await response.json()) as AppState);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return subscribeToAppPath(setPath);
  }, []);

  async function startWeeklyChat(): Promise<void> {
    setStarting(true);
    setError(null);
    try {
      await startChat({
        agentName: "account-growth:coach",
        message:
          "Run my weekly account-growth plan now. Refresh X and LinkedIn, analyze what performs, research specific larger accounts and current posts, draft five original X posts with visual briefs and reply-sparking questions, draft genuine replies, recommend what to double down on, and save the plan. Keep everything draft-only; publish nothing.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  }

  const planId = path.startsWith("plans/") ? path.slice("plans/".length) : null;
  const selectedPlan = state?.plans.find((plan) => plan.id === planId);

  if (planId) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <Button variant="ghost" onClick={() => navigateToApp("")} className="mb-4">
          <ArrowLeft /> Back to plans
        </Button>
        {loading ? (
          <p className="text-muted-foreground">Loading plan…</p>
        ) : selectedPlan ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedPlan.title}</CardTitle>
              <CardDescription>{new Date(selectedPlan.createdAt).toLocaleString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <Markdown>{selectedPlan.markdown}</Markdown>
            </CardContent>
          </Card>
        ) : (
          <p className="text-destructive">Plan not found.</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Activity className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold md:text-2xl">Account Growth</h1>
            <p className="text-muted-foreground">Weekly X planning from your live account signals.</p>
          </div>
        </div>
        <Badge variant="muted" className="w-fit sm:ml-auto">
          <ShieldCheck /> Draft only
        </Badge>
      </div>

      {error ? (
        <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Plan the week</CardTitle>
            <CardDescription>
              Opens a dedicated coach chat, refreshes X and LinkedIn, then saves five post drafts and genuine reply opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void startWeeklyChat()} disabled={starting} className="min-h-11">
              <MessageSquare /> {starting ? "Opening coach…" : "Start weekly planning chat"}
            </Button>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="min-h-11">
              <RefreshCw className={loading ? "animate-spin" : undefined} /> Refresh plans
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Standing strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-base">
            {state ? (
              <>
                <p><span className="font-medium">Niche:</span> {state.config.niche}</p>
                <p><span className="font-medium">Audience:</span> {state.config.audience}</p>
                <p><span className="font-medium">Voice:</span> {state.config.voice}</p>
                <p><span className="font-medium">Cadence:</span> {state.config.cadence}</p>
                <p className="text-muted-foreground">Connected: {state.config.xAccount} · {state.config.linkedIn}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Loading strategy…</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center gap-3">
          <CalendarDays className="text-muted-foreground" />
          <div>
            <CardTitle>Saved weekly plans</CardTitle>
            <CardDescription>Every plan remains available for review and revision.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading plans…</p>
          ) : state?.plans.length ? (
            <div className="divide-y divide-border">
              {state.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => navigateToApp(`plans/${plan.id}`)}
                  className="flex min-h-16 w-full items-start justify-between gap-4 py-4 text-left"
                >
                  <span>
                    <span className="block font-medium">{plan.title}</span>
                    <span className="mt-1 block text-muted-foreground">
                      {plan.performanceSummary ?? "Five posts, visuals, replies, and next-step recommendations"}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No plan yet. Start the planning chat to create the first week.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
