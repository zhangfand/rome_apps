import {
  createAppLogger,
  type Action,
  type ActionConfig,
  type ActionResult,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";

const log = createAppLogger("mailbox_read_copy");

/** 30 days — the default read window. The Rome mailbox is low-volume, and
 *  `fetch_channel_history` caps how much it hydrates, so a generous default is
 *  safe and spares the user from paging for recent mail. */
const DEFAULT_WINDOW_HOURS = 24 * 30;

/** The subset of a `fetch_channel_history` structured message this app consumes.
 *  Kept local so the app owns exactly the shape it renders, tolerant of extra
 *  fields the system action may add. */
interface HistoryAttachment {
  type: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}

interface HistoryMessage {
  id: string;
  displayName: string;
  timestamp: string;
  threadId: string;
  threadName?: string;
  text: string;
  attachments: HistoryAttachment[];
}

export interface MailMessage {
  id: string;
  from: string;
  receivedAt: string;
  body: string;
  attachments: HistoryAttachment[];
}

export interface MailThread {
  threadId: string;
  subject: string;
  /** Sender of the most recent message in the thread. */
  from: string;
  lastReceivedAt: string;
  messageCount: number;
  hasAttachments: boolean;
  /** First line of the latest message, truncated for the list view. */
  preview: string;
  messages: MailMessage[];
}

export interface MailboxReadData {
  /** False when no Rome mailbox is provisioned / the email channel is not
   *  running — the UI shows an onboarding state instead of an error. */
  available: boolean;
  windowHours: number;
  /** Number of likely outbound/sent Rome messages hidden from this inbox view. */
  hiddenOutboundCount: number;
  threads: MailThread[];
}

/** The `fetch_channel_history` error text emitted when the email channel is
 *  absent. Treated as "no mailbox yet", not a failure. */
function isChannelUnavailable(error: string): boolean {
  const e = error.toLowerCase();
  return (
    e.includes("not configured") || e.includes("not running") || e.includes("does not support")
  );
}

const ROME_SENDER_ADDRESSES = new Set(["staging@romeos.cc"]);

/** `fetch_channel_history` returns the email conversation history, including
 *  outbound messages Rome sent. The mailbox viewer is an inbox, so drop the
 *  rows that are almost certainly Rome's own sends. This is a copy-app shim
 *  until the lower-level email history API exposes direction/labels directly. */
function isLikelyOutboundRomeMail(message: HistoryMessage): boolean {
  const sender = message.displayName.trim().toLowerCase();
  if (ROME_SENDER_ADDRESSES.has(sender)) return true;
  // Most Rome-generated emails carry this footer. Keep this as a fallback so
  // older/dev instances with a different from address still avoid showing sent
  // system mail in the inbox view.
  return /(?:^|\n)Sent by Rome · Settings\s*$/u.test(message.text.trim());
}

function firstLine(text: string, max = 140): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Group a flat, oldest-first message list into threads, newest thread first.
 *  Pure — unit-tested directly. */
export function groupIntoThreads(messages: HistoryMessage[]): MailThread[] {
  const byThread = new Map<string, MailMessage[]>();
  const subjectByThread = new Map<string, string>();

  for (const m of messages) {
    let bucket = byThread.get(m.threadId);
    if (!bucket) {
      bucket = [];
      byThread.set(m.threadId, bucket);
    }
    bucket.push({
      id: m.id,
      from: m.displayName,
      receivedAt: m.timestamp,
      body: m.text,
      attachments: m.attachments ?? [],
    });
    // The first non-empty threadName we see for a thread is its subject.
    if (!subjectByThread.get(m.threadId) && m.threadName?.trim()) {
      subjectByThread.set(m.threadId, m.threadName.trim());
    }
  }

  const threads: MailThread[] = [];
  for (const [threadId, msgs] of byThread) {
    msgs.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const latest = msgs[msgs.length - 1];
    threads.push({
      threadId,
      subject: subjectByThread.get(threadId) ?? "(no subject)",
      from: latest.from,
      lastReceivedAt: latest.receivedAt,
      messageCount: msgs.length,
      hasAttachments: msgs.some((m) => m.attachments.length > 0),
      preview: firstLine(latest.body),
      messages: msgs,
    });
  }

  // Newest conversation first.
  threads.sort((a, b) => b.lastReceivedAt.localeCompare(a.lastReceivedAt));
  return threads;
}

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        windowHours: {
          type: "number",
          description: "How many hours back to read (default: 720 = 30 days).",
        },
        threadId: {
          type: "string",
          description: "Optional: restrict to a single conversation thread id.",
        },
      },
      required: [],
    },

    async execute(args): Promise<ActionResult> {
      const windowHours = (args.windowHours as number | undefined) ?? DEFAULT_WINDOW_HOURS;
      const threadId = args.threadId as string | undefined;

      const result = await appContext.runAction("fetch_channel_history", {
        channel: "email",
        windowHours,
        threadId,
        includeMessages: true,
      });

      if (result.status !== "ok") {
        const error = result.status === "error" ? result.error : `returned ${result.status}`;
        if (isChannelUnavailable(error)) {
          log.info("email channel unavailable; returning empty mailbox", { error });
          const empty: MailboxReadData = { available: false, windowHours, hiddenOutboundCount: 0, threads: [] };
          return { status: "ok", data: empty };
        }
        return { status: "error", error: `Could not read mailbox: ${error}` };
      }

      const rawMessages = ((result.data as { messages?: HistoryMessage[] })?.messages ?? []).filter(
        (m): m is HistoryMessage => Boolean(m && m.threadId && m.id),
      );
      const messages = rawMessages.filter((m) => !isLikelyOutboundRomeMail(m));
      const hiddenOutboundCount = rawMessages.length - messages.length;

      const data: MailboxReadData = {
        available: true,
        windowHours,
        hiddenOutboundCount,
        threads: groupIntoThreads(messages),
      };
      log.info("mailbox read", {
        threads: data.threads.length,
        windowHours,
        hiddenOutboundCount,
      });
      return { status: "ok", data };
    },
  };
}
