import { localStamp } from "./time.js";

export interface RawMessage {
  role: string;
  content: string;
  createdAt: Date | string;
  turnId?: string | null;
}

interface Block {
  type?: string;
  content?: unknown;
  output?: unknown;
  render?: { props?: { questions?: Array<{ id?: string; question?: string }> } };
  name?: string;
  fileName?: string;
  path?: string;
}

function parseBlocks(content: string): Block[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Block[];
  } catch {
    // plain text message
  }
  return [{ type: "text", content }];
}

function renderBlock(block: Block): string | null {
  switch (block.type) {
    case "text":
      return typeof block.content === "string" ? block.content.trim() : null;
    case "pending_interaction": {
      const qs = block.render?.props?.questions ?? [];
      if (!qs.length) return null;
      return ["_（向你提问）_", ...qs.map((q) => `- ${q.question ?? q.id ?? ""}`)].join("\n");
    }
    case "interaction_result": {
      const answers = (block.output as { answers?: Array<{ questionId?: string; value?: unknown }> })?.answers;
      if (!Array.isArray(answers)) return null;
      return [
        "_（回答）_",
        ...answers.map((a) => `- ${a.questionId ?? "?"}: ${typeof a.value === "string" ? a.value : JSON.stringify(a.value)}`),
      ].join("\n");
    }
    case "turn_recap":
    case "error":
      return null;
    default: {
      const name = block.fileName ?? block.name ?? block.path;
      return name ? `_（附件：${name}）_` : null;
    }
  }
}

/** Renders stored webchat messages as a readable Markdown transcript. */
export function renderTranscript(title: string, messages: RawMessage[]): { markdown: string; turns: number } {
  const lines: string[] = [`# ${title}`, ""];
  let turns = 0;
  let lastRole = "";
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = parseBlocks(m.content)
      .map(renderBlock)
      .filter((t): t is string => Boolean(t))
      .join("\n\n")
      .trim();
    if (!text) continue;
    if (m.role === "user") turns++;
    if (m.role !== lastRole) {
      const when = localStamp(new Date(m.createdAt));
      lines.push(`## ${m.role === "user" ? "我" : "Agent"} · ${when}`, "");
      lastRole = m.role;
    }
    lines.push(text, "");
  }
  return { markdown: lines.join("\n"), turns };
}
