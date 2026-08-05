import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  fetchAppApi,
  getCurrentAppPath,
  navigateToApp,
  subscribeToAppPath,
  type RomeAppBootstrap,
} from "@rome-os/app-web-sdk";
import { ArrowLeft, Inbox, Mail, Paperclip, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailBodyRenderer } from "@/components/EmailBodyRenderer";
import { cn } from "@/lib/utils";
import "./styles.css";

interface MailAttachment {
  type: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}
interface MailMessage {
  id: string;
  from: string;
  receivedAt: string;
  body: string;
  attachments: MailAttachment[];
}
interface MailThread {
  threadId: string;
  subject: string;
  from: string;
  lastReceivedAt: string;
  messageCount: number;
  hasAttachments: boolean;
  preview: string;
  messages: MailMessage[];
}
interface MailboxData {
  available: boolean;
  windowHours: number;
  hiddenOutboundCount?: number;
  threads: MailThread[];
}

const WINDOW_OPTIONS: { label: string; hours: number }[] = [
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
  { label: "90 days", hours: 24 * 90 },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function InboxApp(_props: { bootstrap: RomeAppBootstrap }) {
  const [data, setData] = useState<MailboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowHours, setWindowHours] = useState(WINDOW_OPTIONS[1].hours);
  const [selectedId, setSelectedId] = useState<string | null>(() => getCurrentAppPath() || null);

  useEffect(() => subscribeToAppPath((path) => setSelectedId(path || null)), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAppApi(`inbox?windowHours=${windowHours}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Inbox request failed with ${res.status}`);
      setData((await res.json()) as MailboxData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [windowHours]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = (id: string) => {
    setSelectedId(id);
    navigateToApp(id);
  };
  const back = () => {
    setSelectedId(null);
    navigateToApp("");
  };

  const selected = data?.threads.find((t) => t.threadId === selectedId) ?? null;

  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Mail className="size-5 text-primary" />
        <h1 className="text-lg font-semibold md:text-xl">Inbox</h1>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Time window"
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.hours} value={o.hours}>
                Last {o.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Thread list — full width on mobile, fixed rail on md+. Hidden on
            mobile while a thread is open. */}
        <section
          className={cn(
            "min-h-0 w-full overflow-y-auto border-border md:w-80 md:border-r lg:w-96",
            selected ? "hidden md:block" : "block",
          )}
        >
          <ThreadList
            data={data}
            loading={loading}
            error={error}
            selectedId={selectedId}
            onOpen={openThread}
            onRetry={() => void load()}
          />
        </section>

        {/* Reading pane — full screen on mobile when a thread is open. */}
        <section
          className={cn("min-h-0 flex-1 overflow-y-auto", selected ? "block" : "hidden md:block")}
        >
          {selected ? (
            <ThreadView thread={selected} onBack={back} />
          ) : (
            <Placeholder
              icon={<Inbox className="size-8" />}
              text="Select a conversation to read."
            />
          )}
        </section>
      </div>
    </main>
  );
}

function ThreadList(props: {
  data: MailboxData | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onRetry: () => void;
}) {
  const { data, loading, error, selectedId, onOpen, onRetry } = props;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (loading && !data) {
    return (
      <Placeholder icon={<RefreshCw className="size-6 animate-spin" />} text="Loading mail…" />
    );
  }
  if (data && !data.available) {
    return (
      <Placeholder
        icon={<Mail className="size-8" />}
        text="No Rome mailbox is set up yet. Once your mailbox is provisioned, your email will appear here."
      />
    );
  }
  if (!data || data.threads.length === 0) {
    const hidden = data?.hiddenOutboundCount ?? 0;
    return (
      <Placeholder
        icon={<Inbox className="size-8" />}
        text={
          hidden > 0
            ? `No inbox email in this time window. Hidden ${hidden} sent Rome message${hidden === 1 ? "" : "s"}.`
            : "No inbox email in this time window."
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {data.threads.map((t) => (
        <li key={t.threadId}>
          <button
            type="button"
            onClick={() => onOpen(t.threadId)}
            className={cn(
              "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-primary/5",
              selectedId === t.threadId && "bg-primary/10",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="truncate text-sm font-medium">{t.from}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatWhen(t.lastReceivedAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm">{t.subject}</span>
              {t.messageCount > 1 && (
                <span className="shrink-0 text-xs text-muted-foreground">({t.messageCount})</span>
              )}
              {t.hasAttachments && (
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{t.preview}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ThreadView({ thread, onBack }: { thread: MailThread; onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft />
        </Button>
        <h2 className="truncate text-base font-semibold md:text-lg">{thread.subject}</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {thread.messages.map((m) => (
          <article key={m.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-sm font-medium">{m.from}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(m.receivedAt).toLocaleString()}
              </span>
            </div>
            <EmailBodyRenderer
              body={m.body}
              subject={thread.subject}
              attachments={m.attachments}
            />
            {m.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                {m.attachments.map((a, i) => {
                  const label = a.fileName ?? a.caption ?? a.type;
                  return a.url ? (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5"
                    >
                      <Paperclip className="size-3.5" />
                      {label}
                    </a>
                  ) : (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
                    >
                      <Paperclip className="size-3.5" />
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
      {icon}
      <p className="max-w-xs text-sm">{text}</p>
    </div>
  );
}
