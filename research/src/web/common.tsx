import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getCurrentAppPath, navigateToApp, subscribeToAppPath } from "@rome-os/app-web-sdk";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Spinner } from "@rome-os/ui/spinner";
import { Markdown } from "@rome-os/ui/markdown";

export function useAppPath(): string[] {
  const [path, setPath] = useState(() => getCurrentAppPath());
  useEffect(() => subscribeToAppPath(setPath), []);
  return path
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg));
}

export function go(...segments: string[]): void {
  navigateToApp(segments.map((s) => encodeURIComponent(s)).join("/"));
}

/** Anchor that soft-navigates inside the app but still works with modifier-click. */
export function AppLink({
  to,
  children,
  className,
}: {
  to: string[];
  children: ReactNode;
  className?: string;
}) {
  const href = to.map((s) => encodeURIComponent(s)).join("/");
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(...to);
      }}
    >
      {children}
    </a>
  );
}

export interface Loadable<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

export function Loading({ label = "加载中" }: { label?: string }) {
  return (
    <EmptyState>
      <EmptyStateIcon>
        <Spinner />
      </EmptyStateIcon>
      <EmptyStateDescription>{label}</EmptyStateDescription>
    </EmptyState>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Empty({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <EmptyState>
      {icon ? <EmptyStateIcon>{icon}</EmptyStateIcon> : null}
      <EmptyStateTitle>{title}</EmptyStateTitle>
      {description ? <EmptyStateDescription>{description}</EmptyStateDescription> : null}
    </EmptyState>
  );
}

export function Prose({ children }: { children: string }) {
  return <Markdown compact>{children}</Markdown>;
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
