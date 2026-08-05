import { createAppLogger } from "@rome-os/app-runtime";
const log = createAppLogger("mailbox_read_copy");
const DEFAULT_WINDOW_HOURS = 720;
function isChannelUnavailable(error) {
    const e = error.toLowerCase();
    return e.includes("not configured") || e.includes("not running") || e.includes("does not support");
}
const ROME_SENDER_ADDRESSES = new Set([
    "staging@romeos.cc"
]);
function isLikelyOutboundRomeMail(message) {
    const sender = message.displayName.trim().toLowerCase();
    if (ROME_SENDER_ADDRESSES.has(sender)) return true;
    return /(?:^|\n)Sent by Rome · Settings\s*$/u.test(message.text.trim());
}
function firstLine(text, max = 140) {
    const line = text.replace(/\s+/g, " ").trim();
    return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
function groupIntoThreads(messages) {
    const byThread = new Map();
    const subjectByThread = new Map();
    for (const m of messages){
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
            attachments: m.attachments ?? []
        });
        if (!subjectByThread.get(m.threadId) && m.threadName?.trim()) subjectByThread.set(m.threadId, m.threadName.trim());
    }
    const threads = [];
    for (const [threadId, msgs] of byThread){
        msgs.sort((a, b)=>a.receivedAt.localeCompare(b.receivedAt));
        const latest = msgs[msgs.length - 1];
        threads.push({
            threadId,
            subject: subjectByThread.get(threadId) ?? "(no subject)",
            from: latest.from,
            lastReceivedAt: latest.receivedAt,
            messageCount: msgs.length,
            hasAttachments: msgs.some((m)=>m.attachments.length > 0),
            preview: firstLine(latest.body),
            messages: msgs
        });
    }
    threads.sort((a, b)=>b.lastReceivedAt.localeCompare(a.lastReceivedAt));
    return threads;
}
function createAction(config, deps) {
    const { appContext } = deps;
    return {
        config,
        inputSchema: {
            type: "object",
            properties: {
                windowHours: {
                    type: "number",
                    description: "How many hours back to read (default: 720 = 30 days)."
                },
                threadId: {
                    type: "string",
                    description: "Optional: restrict to a single conversation thread id."
                }
            },
            required: []
        },
        async execute (args) {
            const windowHours = args.windowHours ?? DEFAULT_WINDOW_HOURS;
            const threadId = args.threadId;
            const result = await appContext.runAction("fetch_channel_history", {
                channel: "email",
                windowHours,
                threadId,
                includeMessages: true
            });
            if ("ok" !== result.status) {
                const error = "error" === result.status ? result.error : `returned ${result.status}`;
                if (isChannelUnavailable(error)) {
                    log.info("email channel unavailable; returning empty mailbox", {
                        error
                    });
                    const empty = {
                        available: false,
                        windowHours,
                        hiddenOutboundCount: 0,
                        threads: []
                    };
                    return {
                        status: "ok",
                        data: empty
                    };
                }
                return {
                    status: "error",
                    error: `Could not read mailbox: ${error}`
                };
            }
            const rawMessages = (result.data?.messages ?? []).filter((m)=>Boolean(m && m.threadId && m.id));
            const messages = rawMessages.filter((m)=>!isLikelyOutboundRomeMail(m));
            const hiddenOutboundCount = rawMessages.length - messages.length;
            const data = {
                available: true,
                windowHours,
                hiddenOutboundCount,
                threads: groupIntoThreads(messages)
            };
            log.info("mailbox read", {
                threads: data.threads.length,
                windowHours,
                hiddenOutboundCount
            });
            return {
                status: "ok",
                data
            };
        }
    };
}
export { createAction, groupIntoThreads };

//# sourceMappingURL=index.js.map