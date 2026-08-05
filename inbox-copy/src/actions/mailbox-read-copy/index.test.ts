import { describe, expect, it, vi } from "vitest";
import type { ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createAction, groupIntoThreads, type MailboxReadData } from "./index.js";

const config = { name: "mailbox_read_copy", type: "custom" } as unknown as ActionConfig;

function makeDeps(
  runAction: (name: string, args: Record<string, unknown>) => Promise<ActionResult>,
) {
  return { appContext: { runAction: vi.fn(runAction) } } as unknown as AppActionRuntimeDeps;
}

function historyMessage(over: Partial<Record<string, unknown>>) {
  return {
    id: "m1",
    displayName: "Ray",
    timestamp: "2026-01-01T00:00:00.000Z",
    threadId: "t1",
    threadName: "Hello",
    text: "Body text",
    attachments: [],
    ...over,
  };
}

describe("groupIntoThreads", () => {
  it("groups messages by thread, oldest-first within a thread, newest thread first", () => {
    const threads = groupIntoThreads([
      historyMessage({ id: "a", threadId: "t1", timestamp: "2026-01-01T10:00:00.000Z" }),
      historyMessage({ id: "b", threadId: "t1", timestamp: "2026-01-01T09:00:00.000Z" }),
      historyMessage({
        id: "c",
        threadId: "t2",
        threadName: "Later thread",
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    expect(threads.map((t) => t.threadId)).toEqual(["t2", "t1"]);
    const t1 = threads.find((t) => t.threadId === "t1")!;
    expect(t1.subject).toBe("Hello");
    expect(t1.messageCount).toBe(2);
    expect(t1.messages.map((m) => m.id)).toEqual(["b", "a"]);
    expect(t1.from).toBe("Ray");
  });

  it("flags attachments and falls back to a placeholder subject", () => {
    const threads = groupIntoThreads([
      historyMessage({
        threadId: "t9",
        threadName: undefined,
        attachments: [{ type: "file", url: "https://x/y.pdf", fileName: "y.pdf" }],
      }),
    ]);
    expect(threads[0].subject).toBe("(no subject)");
    expect(threads[0].hasAttachments).toBe(true);
  });
});

describe("mailbox_read_copy action", () => {
  it("reshapes fetch_channel_history output into threads", async () => {
    const runAction = vi.fn(async () => ({
      status: "ok" as const,
      data: { messages: [historyMessage({})] },
    }));
    const action = createAction(config, makeDeps(runAction));

    const result = await action.execute!({ windowHours: 48 });
    expect(runAction).toHaveBeenCalledWith("fetch_channel_history", {
      channel: "email",
      windowHours: 48,
      threadId: undefined,
      includeMessages: true,
    });
    expect(result.status).toBe("ok");
    const data = (result as { data: MailboxReadData }).data;
    expect(data.available).toBe(true);
    expect(data.threads).toHaveLength(1);
    expect(data.threads[0].subject).toBe("Hello");
  });

  it("returns available:false when the email channel is not configured", async () => {
    const action = createAction(
      config,
      makeDeps(async () => ({
        status: "error" as const,
        error: 'Channel "email" is not configured or not running.',
      })),
    );
    const result = await action.execute!({});
    expect(result.status).toBe("ok");
    const data = (result as { data: MailboxReadData }).data;
    expect(data.available).toBe(false);
    expect(data.threads).toEqual([]);
  });

  it("propagates a genuine read error", async () => {
    const action = createAction(
      config,
      makeDeps(async () => ({ status: "error" as const, error: "provider status 500" })),
    );
    const result = await action.execute!({});
    expect(result.status).toBe("error");
  });
});
