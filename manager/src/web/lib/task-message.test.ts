import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composerShortcut, sendTaskMessage } from "./task-message";
import { TaskComposer } from "../components/task-composer";
const fetchAppApi = rs.fn<(path?: string, init?: RequestInit) => Promise<Response>>();
const startChat = rs.fn<() => Promise<{ sessionId: string }>>();
const transport = { fetchAppApi, startChat };
afterEach(() => rs.resetAllMocks());
const enter = { key: "Enter", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, repeat: false, isComposing: false, keyCode: 13 };
describe("task composer", () => {
  it("maps Enter to one-shot and Shift+Enter to a chat", () => {
    expect(composerShortcut(enter)).toBe("reply");
    expect(composerShortcut({ ...enter, shiftKey: true })).toBe("chat");
  });
  it("never sends IME confirmation, key repeats or other modifier shortcuts", () => {
    for (const patch of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }, { key: "a" }]) {
      expect(composerShortcut({ ...enter, ...patch })).toBeUndefined();
      expect(composerShortcut({ ...enter, shiftKey: true, ...patch })).toBeUndefined();
    }
  });
  it("sends one shot only to the task reply endpoint", async () => {
    rs.mocked(fetchAppApi).mockResolvedValue(Response.json({ wrote: "Reply" }));
    await sendTaskMessage("task/1", "  My feedback\nline two  ", "reply", transport);
    expect(fetchAppApi).toHaveBeenCalledWith("tasks/task%2F1/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "  My feedback\nline two  " }) });
    expect(startChat).not.toHaveBeenCalled();
  });
  it("starts a Manager chat with task context and the user's message", async () => {
    await sendTaskMessage("t1", "What should we do next?", "chat", transport);
    expect(startChat).toHaveBeenCalledWith({ agentName: "manager:manager", message: "About Manager task t1.\n\nWhat should we do next?" });
    expect(fetchAppApi).not.toHaveBeenCalled();
  });
  it("rejects empty messages and propagates errors for the composer to retain drafts", async () => {
    await expect(sendTaskMessage("t1", " \n", "reply", transport)).rejects.toThrow("Enter a message");
    expect(fetchAppApi).not.toHaveBeenCalled();
    rs.mocked(fetchAppApi).mockResolvedValue(Response.json({ error: "This task is closed" }, { status: 409 }));
    await expect(sendTaskMessage("t1", "hello", "reply", transport)).rejects.toThrow("This task is closed");
    rs.mocked(startChat).mockRejectedValue(new Error("Chat unavailable"));
    await expect(sendTaskMessage("t1", "hello", "chat", transport)).rejects.toThrow("Chat unavailable");
  });
  it("starts at one line with six-line growth and hides send controls while empty", () => {
    const render = (closed: boolean) => renderToStaticMarkup(createElement(TaskComposer, { taskId: "t1", closed, onSent() {} }));
    const html = render(false);
    for (const text of ["Message Manager", "textarea", 'rows="1"', "calc(6lh + 1rem + 2px)", "Shift+Enter", "Alt+Enter"]) expect(html).toContain(text);
    expect(html).not.toContain('aria-label="Choose send mode"');
    expect(html).not.toContain('aria-label="Send reply"');
    expect(html).not.toContain("Reply sent to Manager.");
    expect(html).not.toContain("Reply sends directly");
    expect(html).not.toContain("Start chat uses your message");
    expect(html).not.toContain("for a new line.");
    expect(render(true)).not.toContain('aria-label="Start chat"');
    expect(render(true)).not.toContain('aria-label="Send reply"');
  });
});
