import { fetchAppApi, startChat } from "@rome-os/app-web-sdk";

export type SendMode = "reply" | "chat";

export function composerShortcut(event: {
  key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean;
  repeat: boolean; isComposing: boolean; keyCode: number;
}): SendMode | undefined {
  // Enter used to confirm an IME candidate must never send the draft.
  if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.repeat
    || event.altKey || event.ctrlKey || event.metaKey) return undefined;
  return event.shiftKey ? "chat" : "reply";
}

export async function sendTaskMessage(taskId: string, text: string, mode: SendMode, transport = { fetchAppApi, startChat }) {
  if (!text.trim()) throw new Error("Enter a message first.");
  if (mode === "chat") {
    return transport.startChat({ agentName: "manager:manager", message: `About Manager task ${taskId}.\n\n${text}` });
  }
  const res = await transport.fetchAppApi(`tasks/${encodeURIComponent(taskId)}/reply`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Could not send reply (HTTP ${res.status}).`);
}
