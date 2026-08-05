import "./styles.css";
import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAppApi,
  getCurrentAppPath,
  navigateToApp,
  subscribeToAppPath,
  type RomeAppBootstrap,
} from "@rome-os/app-web-sdk";
import {
  ArrowLeft,
  ExternalLink,
  KeyRound,
  MapPin,
  Plus,
  RefreshCw,
  RotateCw,
  Star,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Spinner } from "@astryxdesign/core/Spinner";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Slider } from "@astryxdesign/core/Slider";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import {
  Table,
  pixel,
  proportional,
  useTableSortable,
  useTableSortableState,
  type TableColumn,
} from "@astryxdesign/core/Table";
import { MapView, STATUS_COLORS, type MapPin as MapPinData } from "@/components/MapView";

interface Apartment extends Record<string, unknown> {
  id: string;
  name: string;
  address: string | null;
  locationHint: string | null;
  area: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  googleRating: number | null;
  apartmentRatingsUrl: string | null;
  apartmentRatingsScore: number | null;
  apartmentRatingsReviewCount: number | null;
  rentSummary: string | null;
  promoSummary: string | null;
  yearBuilt: number | null;
  yearRenovated: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  researchNotes: string | null;
  status: string;
  notes: string | null;
  researchStatus: string;
  researchError: string | null;
  researchAttempts: number;
  researchStartedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface ImportJob {
  id: string;
  url: string;
  status: string;
  error: string | null;
  apartmentsFound: number | null;
  createdAt: number;
}

interface AppState {
  apartments: Apartment[];
  imports: ImportJob[];
  settings: { mapsApiKey: string | null };
}

const STATUS_OPTIONS = [
  { value: "to_visit", label: "To visit" },
  { value: "visited", label: "Visited" },
  { value: "rejected", label: "Rejected" },
  { value: "applied", label: "Applied" },
] as const;

const STATUS_BADGE_VARIANT: Record<string, "yellow" | "blue" | "green" | "red"> = {
  to_visit: "yellow",
  visited: "blue",
  applied: "green",
  rejected: "red",
};

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Area/neighborhood label; falls back to the city parsed from the address. */
function areaOf(apt: Apartment): string {
  if (apt.area) return apt.area;
  const source = apt.address ?? apt.locationHint;
  if (!source) return "";
  const parts = source.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2] ?? "";
}

/** Lowest advertised dollar amount in the rent summary, for sorting. */
function minRent(apt: Apartment): number {
  if (!apt.rentSummary) return Number.POSITIVE_INFINITY;
  const matches = apt.rentSummary.match(/\$\s?[\d,]+/g);
  if (!matches) return Number.POSITIVE_INFINITY;
  const values = matches
    .map((s) => Number(s.replace(/[^\d]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY;
}

/**
 * Live data layer: the browser subscribes to Convex queries directly over
 * WebSocket using an ephemeral read-only token minted by the (guardian-only)
 * Rome API. Writes still go through the Rome API — they also dispatch Rome
 * actions, which a direct Convex mutation could not. If the session cannot be
 * established the UI falls back to the original REST polling.
 */
interface LiveSession {
  url: string;
  token: string;
  expiresAt: number;
}

const liveQueries = {
  apartments: makeFunctionReference<"query">("apartments:list"),
  imports: makeFunctionReference<"query">("imports:list"),
  setting: makeFunctionReference<"query">("settings:get"),
};

type ConvexDoc = Record<string, unknown> & { _id: string };

function docToRow<T>(doc: ConvexDoc): T {
  const { _id, ...rest } = doc;
  delete (rest as Record<string, unknown>)._creationTime;
  return { id: _id, ...rest } as unknown as T;
}

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchAppApi(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? `request failed (${res.status})`);
  }
  return data;
}

/** Follow the Rome host's light/dark mode (the host toggles `.dark` on an
 * ancestor of the shadow mount). Astryx needs the mode for its internal
 * light-dark() colors; our token mapping already flips via Rome's vars. */
function useHostDarkMode(): boolean {
  const [dark, setDark] = useState(() => document.querySelector(".dark") != null);
  useEffect(() => {
    const compute = () => setDark(document.querySelector(".dark") != null);
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function ResearchBadge({ apt, onRetry }: { apt: Apartment; onRetry: () => void }) {
  if (apt.researchStatus === "researching" || apt.researchStatus === "pending") {
    const base = apt.researchStatus === "researching" ? "researching" : "queued";
    const retry =
      apt.researchAttempts > 1 || (apt.researchStatus === "pending" && apt.researchAttempts > 0);
    const attempt = Math.min(
      apt.researchAttempts + (apt.researchStatus === "pending" ? 1 : 0),
      3,
    );
    return (
      <span title={apt.researchError ?? undefined} className="inline-flex">
        <Badge
          variant="neutral"
          icon={<Spinner size="sm" shade="inherit" />}
          label={retry ? `${base} · attempt ${attempt}/3` : base}
        />
      </span>
    );
  }
  if (apt.researchStatus === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={apt.researchError ?? "research failed — click to retry"}
        className="inline-flex cursor-pointer border-0 bg-transparent p-0"
      >
        <Badge variant="error" icon={<RotateCw className="size-3" />} label="failed · retry" />
      </button>
    );
  }
  return null;
}

function RatingCell({ apt }: { apt: Apartment }) {
  if (apt.apartmentRatingsScore == null && !apt.apartmentRatingsUrl) {
    return <span className="text-muted-foreground">—</span>;
  }
  const inner = (
    <span className="inline-flex items-center gap-1">
      <Star className="size-3.5 text-amber-500" />
      {apt.apartmentRatingsScore != null ? apt.apartmentRatingsScore.toFixed(1) : "page"}
      {apt.apartmentRatingsReviewCount != null && (
        <span className="text-muted-foreground">({apt.apartmentRatingsReviewCount})</span>
      )}
    </span>
  );
  if (apt.apartmentRatingsUrl) {
    return (
      <a
        href={apt.apartmentRatingsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
        title="Open on ApartmentRatings"
      >
        {inner}
        <ExternalLink className="size-3 text-muted-foreground" />
      </a>
    );
  }
  return inner;
}

/**
 * Astryx's <Theme> "root sync" stamps `data-theme` + `data-astryx-theme` onto
 * document.documentElement — but this app is shadow-DOM-mounted inside the
 * Rome dashboard, which owns `data-theme` itself (e.g. "ember"). Overwriting
 * it breaks the dashboard's CSS. This hook restores the host's value and
 * strips Astryx's stamps, while adopting genuine host theme changes.
 * Losing root sync costs nothing here: the app has no portals outside the
 * shadow root, and color-scheme is set on the Theme wrapper itself.
 */
function useHostThemeAttributeGuard() {
  const hostTheme = useRef<string | null | undefined>(undefined);
  if (hostTheme.current === undefined) {
    hostTheme.current = document.documentElement.getAttribute("data-theme");
  }
  useEffect(() => {
    const el = document.documentElement;
    const astryxValues = new Set(["light", "dark"]);
    const reconcile = () => {
      el.removeAttribute("data-astryx-theme");
      const current = el.getAttribute("data-theme");
      const saved = hostTheme.current ?? null;
      if (current === saved) return;
      if (current === null || astryxValues.has(current)) {
        // Astryx stamped (or removed) it — restore the host's own theme.
        if (saved === null) el.removeAttribute("data-theme");
        else el.setAttribute("data-theme", saved);
      } else {
        // The host legitimately changed its theme — adopt the new baseline.
        hostTheme.current = current;
      }
    };
    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["data-theme", "data-astryx-theme"],
    });
    return () => {
      observer.disconnect();
      reconcile();
    };
  }, []);
}

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const dark = useHostDarkMode();
  useHostThemeAttributeGuard();
  return (
    <Theme theme={neutralTheme} mode={dark ? "dark" : "light"}>
      <AppInner />
    </Theme>
  );
}

function AppInner() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string>(getCurrentAppPath());
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const data = (await api("state")) as unknown as AppState;
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeToAppPath(setPath);
  }, [load]);

  // Live Convex subscriptions (reads). Falls back to REST polling when the
  // session can't be established; renews the token before it expires.
  const [live, setLive] = useState(false);
  const [liveNonce, setLiveNonce] = useState(0);
  useEffect(() => {
    let disposed = false;
    let client: ConvexClient | null = null;
    let renewTimer: ReturnType<typeof setTimeout> | null = null;
    const parts: {
      apartments?: Apartment[];
      imports?: ImportJob[];
      mapsApiKey?: string | null;
    } = {};
    const apply = () => {
      if (disposed) return;
      if (
        parts.apartments === undefined ||
        parts.imports === undefined ||
        parts.mapsApiKey === undefined
      ) {
        return; // wait for the first result of all three subscriptions
      }
      setState({
        apartments: parts.apartments,
        imports: parts.imports,
        settings: { mapsApiKey: parts.mapsApiKey },
      });
      setError(null);
    };
    const onError = () => {
      // Expired/revoked token or transport failure: drop to REST polling and
      // try to re-establish a fresh session in 30s.
      if (disposed) return;
      setLive(false);
      if (renewTimer) clearTimeout(renewTimer);
      renewTimer = setTimeout(() => setLiveNonce((n) => n + 1), 30_000);
    };
    (async () => {
      try {
        const sess = (await api("session")) as unknown as LiveSession;
        if (disposed || !sess?.url || !sess?.token) return;
        client = new ConvexClient(sess.url);
        const token = sess.token;
        client.onUpdate(
          liveQueries.apartments,
          { token },
          (docs) => {
            parts.apartments = (docs as ConvexDoc[]).map((d) => docToRow<Apartment>(d));
            apply();
          },
          onError,
        );
        client.onUpdate(
          liveQueries.imports,
          { token, limit: 20 },
          (docs) => {
            parts.imports = (docs as ConvexDoc[]).map((d) => docToRow<ImportJob>(d));
            apply();
          },
          onError,
        );
        client.onUpdate(
          liveQueries.setting,
          { token, key: "mapsApiKey" },
          (value) => {
            parts.mapsApiKey = (value as string | null) ?? null;
            apply();
          },
          onError,
        );
        setLive(true);
        // Renew ~5 minutes before expiry by tearing down and resubscribing.
        const renewIn = Math.max(sess.expiresAt - Date.now() - 5 * 60_000, 60_000);
        renewTimer = setTimeout(() => setLiveNonce((n) => n + 1), renewIn);
      } catch {
        onError();
      }
    })();
    return () => {
      disposed = true;
      if (renewTimer) clearTimeout(renewTimer);
      setLive(false);
      void client?.close();
    };
  }, [liveNonce]);

  const busy = useMemo(() => {
    if (!state) return false;
    return (
      state.imports.some((i) => i.status === "pending" || i.status === "running") ||
      state.apartments.some(
        (a) => a.researchStatus === "pending" || a.researchStatus === "researching",
      )
    );
  }, [state]);

  useEffect(() => {
    // Polling is only the fallback path — live subscriptions push updates.
    if (!busy || live) return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [busy, live, load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function startImport() {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    try {
      await api("imports", { method: "POST", body: JSON.stringify({ url }) });
      setImportUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  async function addApartment() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await api("apartments", {
        method: "POST",
        body: JSON.stringify({ name, address: newAddress.trim() }),
      });
      setNewName("");
      setNewAddress("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  async function patchApartment(id: string, patch: Record<string, unknown>) {
    try {
      await api(`apartments/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function rerunResearch(id: string) {
    try {
      await api(`apartments/${id}/research`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeApartment(id: string) {
    try {
      await api(`apartments/${id}`, { method: "DELETE" });
      if (path === id) navigateToApp("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const detail = path ? state?.apartments.find((a) => a.id === path) : undefined;

  // Row whose note is being edited in the note dialog (null = closed).
  const [noteAptId, setNoteAptId] = useState<string | null>(null);
  const noteApt = noteAptId ? state?.apartments.find((a) => a.id === noteAptId) : undefined;

  // Year-built range filter. null = inactive (full range).
  const [yearRange, setYearRange] = useState<[number, number] | null>(null);
  const yearBounds = useMemo<[number, number] | null>(() => {
    const years = (state?.apartments ?? [])
      .map((a) => a.yearBuilt)
      .filter((y): y is number => y != null);
    if (!years.length) return null;
    return [Math.min(...years), Math.max(...years)];
  }, [state]);
  const filterActive =
    yearRange != null &&
    yearBounds != null &&
    (yearRange[0] > yearBounds[0] || yearRange[1] < yearBounds[1]);
  const filteredApartments = useMemo(() => {
    const apts = state?.apartments ?? [];
    if (!filterActive || !yearRange) return apts;
    return apts.filter(
      (a) => a.yearBuilt != null && a.yearBuilt >= yearRange[0] && a.yearBuilt <= yearRange[1],
    );
  }, [state, filterActive, yearRange]);

  const { sortedData, sortConfig } = useTableSortableState<Apartment>({
    data: filteredApartments,
    comparators: {
      built: (a, b) =>
        (a.yearBuilt ?? Number.POSITIVE_INFINITY) - (b.yearBuilt ?? Number.POSITIVE_INFINITY),
      rent: (a, b) => minRent(a) - minRent(b),
      area: (a, b) => (areaOf(a) || "\uffff").localeCompare(areaOf(b) || "\uffff"),
    },
  });
  const sortPlugin = useTableSortable<Apartment>(sortConfig);

  const columns: TableColumn<Apartment>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Apartment",
        width: proportional(2),
        renderCell: (apt: Apartment) => (
          <div>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-foreground underline-offset-2 hover:underline"
              onClick={() => navigateToApp(apt.id)}
            >
              {apt.name}
            </button>
            {apt.address && (
              <div className="mt-0.5 text-xs text-muted-foreground">{apt.address}</div>
            )}
            <div className="mt-1">
              <ResearchBadge apt={apt} onRetry={() => void rerunResearch(apt.id)} />
            </div>
          </div>
        ),
      },
      {
        key: "area",
        header: "Area",
        sortable: true,
        width: pixel(130),
        renderCell: (apt: Apartment) =>
          areaOf(apt) ? (
            <span>{areaOf(apt)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "status",
        header: "Status",
        width: pixel(140),
        renderCell: (apt: Apartment) => (
          <Selector
            label="Status"
            isLabelHidden
            size="sm"
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={apt.status}
            onChange={(v) => void patchApartment(apt.id, { status: v })}
          />
        ),
      },
      {
        key: "ratings",
        header: "Ratings",
        width: pixel(130),
        renderCell: (apt: Apartment) => (
          <div>
            <RatingCell apt={apt} />
            {apt.googleRating != null && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                Google {apt.googleRating.toFixed(1)}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "rent",
        header: "Rent",
        sortable: true,
        width: proportional(2),
        renderCell: (apt: Apartment) => (
          <div>
            {apt.rentSummary ? (
              <span>{apt.rentSummary}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {apt.promoSummary && (
              <div className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                {apt.promoSummary}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "built",
        header: "Built",
        sortable: true,
        width: pixel(90),
        renderCell: (apt: Apartment) => (
          <div>
            {apt.yearBuilt != null ? (
              <span>{apt.yearBuilt}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            {apt.yearRenovated != null && (
              <div className="mt-0.5 text-xs text-muted-foreground">reno {apt.yearRenovated}</div>
            )}
          </div>
        ),
      },
      {
        key: "links",
        header: "Links",
        width: pixel(90),
        renderCell: (apt: Apartment) => (
          <div className="flex items-center gap-2">
            {apt.mapsUrl && (
              <a
                href={apt.mapsUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in Google Maps"
                className="text-muted-foreground hover:text-foreground"
              >
                <MapPin className="size-4" />
              </a>
            )}
            {apt.apartmentRatingsUrl && (
              <a
                href={apt.apartmentRatingsUrl}
                target="_blank"
                rel="noreferrer"
                title="Open on ApartmentRatings"
                className="text-muted-foreground hover:text-foreground"
              >
                <Star className="size-4" />
              </a>
            )}
          </div>
        ),
      },
      {
        key: "actions",
        header: "",
        width: pixel(132),
        renderCell: (apt: Apartment) => {
          const inFlight =
            apt.researchStatus === "pending" || apt.researchStatus === "researching";
          const notePreview = apt.notes
            ? apt.notes.length > 120
              ? `${apt.notes.slice(0, 120)}…`
              : apt.notes
            : null;
          return (
            <div className="flex items-center gap-1">
              <IconButton
                variant="ghost"
                size="sm"
                label={apt.notes ? "Edit note" : "Add note"}
                tooltip={notePreview ?? "Add a note"}
                icon={
                  <StickyNote
                    className={apt.notes ? "size-4 text-amber-600 dark:text-amber-400" : "size-4"}
                  />
                }
                onClick={() => setNoteAptId(apt.id)}
              />
              <IconButton
                variant="ghost"
                size="sm"
                label="Refresh research"
                tooltip={inFlight ? "Research in progress" : "Re-run research for this apartment"}
                icon={<RotateCw className="size-4" />}
                isDisabled={inFlight}
                onClick={() => void rerunResearch(apt.id)}
              />
              <IconButton
                variant="ghost"
                size="sm"
                label="Delete"
                tooltip="Delete apartment"
                icon={<Trash2 className="size-4" />}
                onClick={() => void removeApartment(apt.id)}
              />
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.apartments],
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Apartment Hunt (Convex)
          </h1>
          {state && (
            <p className="mt-1 text-sm text-muted-foreground">
              {state.apartments.length} apartments
              {busy && " · research in progress"}
              {live && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                  live
                </span>
              )}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          label="Refresh"
          icon={<RefreshCw className="size-4" />}
          isLoading={refreshing}
          onClick={() => void refresh()}
        />
      </header>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
          <button
            type="button"
            className="ml-3 cursor-pointer border-0 bg-transparent p-0 underline"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {!state && !error && (
        <div className="mt-12 flex justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {state && detail && (
        <DetailView
          apt={detail}
          onBack={() => navigateToApp("")}
          onPatch={(patch) => void patchApartment(detail.id, patch)}
          onResearch={() => void rerunResearch(detail.id)}
          onDelete={() => void removeApartment(detail.id)}
        />
      )}

      {state && !detail && (
        <>
          <MapCard
            apartments={filteredApartments}
            apiKey={state.settings?.mapsApiKey ?? null}
            onOpen={(id) => navigateToApp(id)}
            onError={setError}
            onSaveKey={async (key) => {
              await api("settings", { method: "POST", body: JSON.stringify({ mapsApiKey: key }) });
              await load();
            }}
          />

          <div className="mt-6">
            <Card padding={4}>
              <h2 className="text-base font-semibold">Import from a Google Maps list</h2>
              <div className="mt-3 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <TextInput
                      label="Google Maps list link"
                      isLabelHidden
                      value={importUrl}
                      onChange={(v) => setImportUrl(v)}
                      placeholder="https://maps.app.goo.gl/…  (shared list link)"
                    />
                  </div>
                  <Button
                    variant="primary"
                    label="Import"
                    icon={<Plus className="size-4" />}
                    isLoading={importing}
                    isDisabled={!importUrl.trim()}
                    onClick={() => void startImport()}
                  />
                </div>
                {state.imports.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {state.imports.slice(0, 3).map((job) => (
                      <li key={job.id} className="flex items-center gap-2 text-muted-foreground">
                        {(job.status === "pending" || job.status === "running") && (
                          <Spinner size="sm" />
                        )}
                        <span className="truncate">{job.url}</span>
                        <span>·</span>
                        {job.status === "failed" ? (
                          <span className="text-destructive">
                            failed{job.error ? `: ${job.error}` : ""}
                          </span>
                        ) : (
                          <span>
                            {job.status}
                            {job.apartmentsFound != null ? ` · ${job.apartmentsFound} found` : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <TextInput
                      label="Apartment name"
                      isLabelHidden
                      value={newName}
                      onChange={(v) => setNewName(v)}
                      placeholder="Or add one apartment by name"
                    />
                  </div>
                  <div className="flex-1">
                    <TextInput
                      label="Address"
                      isLabelHidden
                      value={newAddress}
                      onChange={(v) => setNewAddress(v)}
                      placeholder="Address (optional)"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    label="Add"
                    icon={<Plus className="size-4" />}
                    isLoading={adding}
                    isDisabled={!newName.trim()}
                    onClick={() => void addApartment()}
                  />
                </div>
              </div>
            </Card>
          </div>

          {state.apartments.length === 0 ? (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Paste a shared Google Maps list link above — every saved place is imported and
              auto-researched.
            </p>
          ) : (
            <>
              {yearBounds && yearBounds[0] < yearBounds[1] && (
                <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm text-muted-foreground">Built between</span>
                  <div className="w-72 max-w-full pt-1">
                    <Slider
                      label="Year built range"
                      isLabelHidden
                      min={yearBounds[0]}
                      max={yearBounds[1]}
                      step={1}
                      value={yearRange ?? yearBounds}
                      valueDisplay="text"
                      minStepsBetweenThumbs={1}
                      onChange={(v: number | [number, number]) => {
                        if (Array.isArray(v)) setYearRange(v);
                      }}
                    />
                  </div>
                  {filterActive && (
                    <>
                      <span className="text-sm text-muted-foreground">
                        showing {filteredApartments.length} of {state.apartments.length}
                        {state.apartments.some((a) => a.yearBuilt == null) &&
                          " (unknown year hidden)"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        label="Reset"
                        onClick={() => setYearRange(null)}
                      />
                    </>
                  )}
                </div>
              )}
              <div className="mt-4 overflow-x-auto">
              <Card padding={0}>
                <Table<Apartment>
                  data={sortedData}
                  columns={columns}
                  idKey="id"
                  density="balanced"
                  dividers="rows"
                  hasHover
                  verticalAlign="top"
                  plugins={{ sort: sortPlugin }}
                />
              </Card>
              </div>
            </>
          )}
        </>
      )}

      {noteApt && (
        <NoteDialog
          apt={noteApt}
          onSave={async (notes) => {
            await patchApartment(noteApt.id, { notes });
          }}
          onClose={() => setNoteAptId(null)}
        />
      )}

      {state && path && !detail && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Apartment not found.{" "}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 underline"
            onClick={() => navigateToApp("")}
          >
            Back to list
          </button>
        </p>
      )}
    </main>
  );
}

const STATUS_LEGEND = [
  { value: "to_visit", label: "To visit" },
  { value: "visited", label: "Visited" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
];

function NoteDialog({
  apt,
  onSave,
  onClose,
}: {
  apt: Apartment;
  onSave: (notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(apt.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(value.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} width={460} purpose="form">
      <DialogHeader
        title={apt.notes ? "Edit note" : "Add note"}
        subtitle={apt.name}
        onOpenChange={(open) => !open && onClose()}
      />
      <div className="space-y-4 p-4">
        <TextArea
          label="Note"
          isLabelHidden
          value={value}
          onChange={(v) => setValue(v)}
          rows={5}
          hasAutoFocus
          placeholder="Impressions after a visit, questions to ask, pros/cons…"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Saving an empty note removes it.
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" label="Cancel" isDisabled={saving} onClick={onClose} />
            <Button
              variant="primary"
              label="Save note"
              isLoading={saving}
              onClick={() => void save()}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function ApiKeyDialog({
  isOpen,
  hasKey,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  hasKey: boolean;
  onSave: (key: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const key = value.trim();
    if (!key) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(key);
      setValue("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()} width={430} purpose="form">
      <DialogHeader
        title={hasKey ? "Replace Google Maps API key" : "Add Google Maps API key"}
        subtitle="Stored in this app only and used to render the map."
        onOpenChange={(open) => !open && onClose()}
      />
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Enable <span className="font-medium text-foreground">Maps JavaScript API</span> for the
          key in Google Cloud Console.
        </p>
        <TextInput
          type="password"
          label="API key"
          isLabelHidden
          value={value}
          onChange={(v) => setValue(v)}
          placeholder="AIza…"
          hasAutoFocus
          status={error ? { type: "error", message: error } : undefined}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" label="Cancel" isDisabled={saving} onClick={onClose} />
          <Button
            variant="primary"
            label="Save key"
            icon={<KeyRound className="size-4" />}
            isLoading={saving}
            isDisabled={!value.trim()}
            onClick={() => void save()}
          />
        </div>
      </div>
    </Dialog>
  );
}

function MapCard({
  apartments,
  apiKey,
  onOpen,
  onError,
  onSaveKey,
}: {
  apartments: Apartment[];
  apiKey: string | null;
  onOpen: (id: string) => void;
  onError: (message: string) => void;
  onSaveKey: (key: string) => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const pins: MapPinData[] = apartments
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      lat: a.latitude as number,
      lng: a.longitude as number,
      rentSummary: a.rentSummary,
      apartmentRatingsScore: a.apartmentRatingsScore,
      mapsUrl: a.mapsUrl,
    }));

  if (apartments.length === 0) return null;

  return (
    <div className="mt-6">
      <Card padding={0}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-3">
          <h2 className="text-base font-semibold">Map</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {STATUS_LEGEND.map((s) => (
              <span key={s.value} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[s.value] }}
                />
                {s.label}
              </span>
            ))}
            {pins.length < apartments.length && (
              <span>· {apartments.length - pins.length} without coordinates yet</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              label={apiKey ? "Change key" : "Add key"}
              icon={<KeyRound className="size-3.5" />}
              tooltip={apiKey ? "Replace the Google Maps API key" : "Add a Google Maps API key"}
              onClick={() => setDialogOpen(true)}
            />
          </div>
        </div>
        {apiKey ? (
          pins.length > 0 ? (
            <MapView apiKey={apiKey} pins={pins} onOpen={onOpen} onError={onError} />
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              No coordinates yet — the map fills in as research completes.
            </p>
          )
        ) : (
          <div className="flex flex-col items-start gap-3 px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Add your Google Maps API key to see all apartments on an interactive map.
            </p>
            <Button
              variant="primary"
              size="sm"
              label="Add API key"
              icon={<KeyRound className="size-4" />}
              onClick={() => setDialogOpen(true)}
            />
          </div>
        )}
      </Card>
      <ApiKeyDialog
        isOpen={dialogOpen}
        hasKey={apiKey != null}
        onSave={onSaveKey}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

function DetailView({
  apt,
  onBack,
  onPatch,
  onResearch,
  onDelete,
}: {
  apt: Apartment;
  onBack: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onResearch: () => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(apt.notes ?? "");
  useEffect(() => setNotes(apt.notes ?? ""), [apt.id, apt.notes]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          label="All apartments"
          icon={<ArrowLeft className="size-4" />}
          onClick={onBack}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            label="Re-run research"
            icon={<RotateCw className="size-4" />}
            onClick={onResearch}
          />
          <IconButton
            variant="ghost"
            size="sm"
            label="Delete apartment"
            icon={<Trash2 className="size-4 text-destructive" />}
            onClick={onDelete}
          />
        </div>
      </div>

      <Card padding={4}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{apt.name}</h2>
          <Badge
            variant={STATUS_BADGE_VARIANT[apt.status] ?? "yellow"}
            label={statusLabel(apt.status)}
          />
          <ResearchBadge apt={apt} onRetry={onResearch} />
        </div>
        {apt.address && <p className="mt-1 text-sm text-muted-foreground">{apt.address}</p>}

        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="max-w-48">
              <Selector
                label="Status"
                options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={apt.status}
                onChange={(v) => onPatch({ status: v })}
              />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Links</div>
              <div className="mt-1 flex flex-col gap-1">
                {apt.mapsUrl ? (
                  <a
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    href={apt.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="size-3.5" /> Google Maps
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">No Maps link yet</span>
                )}
                {apt.apartmentRatingsUrl ? (
                  <a
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    href={apt.apartmentRatingsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Star className="size-3.5" /> ApartmentRatings
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">No ApartmentRatings page found</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Ratings</div>
              <div className="mt-1 space-y-0.5">
                <div>
                  ApartmentRatings:{" "}
                  {apt.apartmentRatingsScore != null ? (
                    <>
                      {apt.apartmentRatingsScore.toFixed(1)} / 5
                      {apt.apartmentRatingsReviewCount != null &&
                        ` (${apt.apartmentRatingsReviewCount} reviews)`}
                    </>
                  ) : (
                    <span className="text-muted-foreground">unknown</span>
                  )}
                </div>
                <div>
                  Google:{" "}
                  {apt.googleRating != null ? (
                    `${apt.googleRating.toFixed(1)} / 5`
                  ) : (
                    <span className="text-muted-foreground">unknown</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Rent</div>
              <div className="mt-1 space-y-0.5">
                <div>
                  {apt.rentSummary ?? <span className="text-muted-foreground">unknown</span>}
                </div>
                {apt.promoSummary && (
                  <div className="text-emerald-700 dark:text-emerald-400">{apt.promoSummary}</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Contact</div>
              <div className="mt-1 flex flex-col gap-1">
                {apt.phone ? (
                  <a
                    className="underline-offset-2 hover:underline"
                    href={`tel:${apt.phone.replace(/[^+\d]/g, "")}`}
                  >
                    {apt.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No phone found</span>
                )}
                {apt.email ? (
                  <a
                    className="underline-offset-2 hover:underline"
                    href={`mailto:${apt.email}`}
                  >
                    {apt.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No published email</span>
                )}
                {apt.website && (
                  <a
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                    href={apt.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official website
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Built</div>
              <div className="mt-1">
                {apt.yearBuilt != null ? (
                  <>
                    {apt.yearBuilt}
                    {apt.yearRenovated != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        · renovated {apt.yearRenovated}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">unknown</span>
                )}
              </div>
            </div>
          </div>

          {apt.researchNotes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Research notes</div>
              <p className="mt-1">{apt.researchNotes}</p>
            </div>
          )}
          {apt.researchError && (
            <div className="text-destructive">Research error: {apt.researchError}</div>
          )}

          <div>
            <TextArea
              label="My notes"
              value={notes}
              onChange={(v) => setNotes(v)}
              rows={4}
              placeholder="Impressions after a visit, questions to ask, pros/cons…"
            />
            {(notes.trim() || "") !== (apt.notes ?? "") && (
              <div className="mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  label="Save notes"
                  onClick={() => onPatch({ notes })}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
