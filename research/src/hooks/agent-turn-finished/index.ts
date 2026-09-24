import { dirname } from "node:path";
import type {
  AgentLifecycleHookDeps,
  AgentRunnerInterface,
  AgentTurnFinishedEvent,
  AgentTurnFinishedHook,
  Logger,
  WebChatRecapRepository,
} from "@rome-os/app-runtime";
import { slugFromProjectPath } from "../../lib/paths.js";
import {
  readConversationSummaryBody,
  topicExists,
  writeConversation,
} from "../../lib/store.js";
import { renderTranscript } from "../../lib/transcript.js";

export const SUMMARY_PROMPT = `You are running in an isolated fork of this research conversation. Do NOT call any tools or actions — answer with text only.

Write the running archive summary of THIS WHOLE conversation (all turns so far, not just the last one) so that someone returning weeks later can pick up where it left off. Use the conversation's own language. Output Markdown only, no preamble, using exactly these sections and omitting any that would be empty:

## 讨论了什么
2–5 bullets.

## 结论与洞见
Bullets. Each is one self-contained claim; mark tentative ones with (待验证).

## 保存或提到的资料
Bullets with titles/links of material saved or referenced.

## 未解决的问题
Bullets.

Previous version of this summary (update it rather than starting over; may be empty):
---
{{PREVIOUS}}
---`;

export interface ArchiveHookDeps {
  agentRunner?: AgentRunnerInterface;
  repo: WebChatRecapRepository;
  logger: Logger;
}

function webchatSessionId(event: AgentTurnFinishedEvent): string | null {
  const threadId = event.turn.threadContext?.threadId?.trim();
  if (threadId) return threadId;
  const key = event.turn.channelThreadKey;
  if (key?.startsWith("webchat:")) return key.split(":")[1] || null;
  return null;
}

export class ArchiveTurnFinishedHook implements AgentTurnFinishedHook {
  private readonly chains = new Map<string, Promise<void>>();
  private readonly forkSessions = new Set<string>();

  constructor(private readonly deps: ArchiveHookDeps) {}

  onAgentTurnFinished(event: AgentTurnFinishedEvent): Promise<void> {
    if (event.turn.parent !== undefined) return Promise.resolve();
    if (this.forkSessions.has(event.turn.sessionId)) return Promise.resolve();
    if (!event.turn.channelThreadKey?.startsWith("webchat:")) return Promise.resolve();
    const slug = slugFromProjectPath(event.turn.threadContext?.projectPath);
    if (!slug) return Promise.resolve();
    const sessionId = webchatSessionId(event);
    if (!sessionId) return Promise.resolve();

    // Serialize per session so overlapping turns never interleave file writes.
    const prev = this.chains.get(sessionId) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.archive(event, slug, sessionId))
      .catch((err: unknown) => {
        this.deps.logger.warn("research: failed to archive turn", {
          sessionId,
          slug,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (this.chains.get(sessionId) === next) this.chains.delete(sessionId);
      });
    this.chains.set(sessionId, next);
    // Do not block the host's turn pipeline on summarization.
    return Promise.resolve();
  }

  private async archive(event: AgentTurnFinishedEvent, slug: string, sessionId: string): Promise<void> {
    if (!(await topicExists(slug))) return;
    const session = await this.deps.repo.getSession(sessionId);
    if (!session) return;
    const messages = await this.deps.repo.getMessages(sessionId);
    const title = session.name?.trim() || "未命名对话";
    const { markdown, turns } = renderTranscript(title, messages);
    const started = new Date(session.createdAt).toISOString();

    // 1) Raw transcript first — the part that must never be lost.
    const id = await writeConversation(slug, { sessionId, title, started, turns, transcript: markdown });

    // 2) Running summary, from a forked turn that sees the whole conversation.
    if (event.status !== "completed" || event.output.state !== "final") return;
    const summary = await this.summarize(event, await readConversationSummaryBody(slug, id));
    if (summary) {
      await writeConversation(slug, { sessionId, title, started, turns, transcript: markdown, summary });
    }
    this.deps.logger.info("research: archived conversation", { slug, conversation: id, turns });
  }

  private async summarize(event: AgentTurnFinishedEvent, previous: string): Promise<string | null> {
    const runner = this.deps.agentRunner;
    if (!runner?.runForked || !event.turn.channelThreadKey) return null;
    const prevText = previous.includes("摘要生成中") ? "" : previous.trim();
    const threadPath = event.turn.threadContext?.threadPath;
    let result = "";
    for await (const msg of runner.runForked({
      agentName: event.turn.agentName,
      sourceSessionId: event.turn.sessionId,
      prompt: SUMMARY_PROMPT.replace("{{PREVIOUS}}", prevText),
      tier: "small",
      channelThreadKey: event.turn.channelThreadKey,
      threadContext: event.turn.threadContext,
      workingDir: threadPath ? dirname(dirname(threadPath)) : undefined,
      parentTurnId: event.turn.turnId,
      label: "research-archive",
    })) {
      if (msg.type === "turn_start") this.forkSessions.add(msg.sessionId);
      else if (msg.type === "result") result = typeof msg.content === "string" ? msg.content : "";
      else if (msg.type === "error") throw new Error(msg.error);
    }
    const text = result.trim();
    return text ? text : null;
  }
}

export function createHook(deps: AgentLifecycleHookDeps): AgentTurnFinishedHook {
  const repo = deps.appContext?.repositories.webchatRecaps;
  if (!repo) throw new Error("Research archive hook requires appContext.repositories.webchatRecaps");
  return new ArchiveTurnFinishedHook({ agentRunner: deps.agentRunner, repo, logger: deps.logger });
}
