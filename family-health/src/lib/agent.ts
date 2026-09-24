/**
 * Calling this app's own agents through the platform `system:summon` action.
 * Agents declare an `outputSchema`, so summon normally returns the validated
 * structured value in `data.output`; when a provider falls back to free text
 * we recover the JSON object from the reply.
 */
import type { RomeAppContext } from "@rome-os/app-runtime";

export type AgentResult<T> = { ok: true; data: T; raw: string } | { ok: false; error: string };

/** A function that runs an agent with a prompt; injectable for tests. */
export type AgentCaller = <T = unknown>(agentName: string, prompt: string) => Promise<AgentResult<T>>;

/** Best-effort extraction of a JSON object/array from a free-form reply. */
export function extractJson(text: string): unknown {
  if (!text || !text.trim()) throw new Error("empty reply");
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("no JSON found in reply");
  }
}

interface SummonData {
  result?: unknown;
  output?: unknown;
}

export function createAgentCaller(appContext: Pick<RomeAppContext, "runAction">): AgentCaller {
  return async <T>(agentName: string, prompt: string): Promise<AgentResult<T>> => {
    let res;
    try {
      res = await appContext.runAction("system:summon", { agentName, prompt });
    } catch (err) {
      return { ok: false, error: `调用 ${agentName} 失败：${(err as Error).message}` };
    }
    if (res.status !== "ok") {
      return { ok: false, error: res.status === "error" ? res.error : `summon returned ${res.status}` };
    }
    const data = (res.data ?? {}) as SummonData;
    const text = typeof data.result === "string" ? data.result : "";
    if (data.output !== undefined && data.output !== null) return { ok: true, data: data.output as T, raw: text };
    try {
      return { ok: true, data: extractJson(text) as T, raw: text };
    } catch (err) {
      return { ok: false, error: `无法解析模型输出：${(err as Error).message}` };
    }
  };
}
