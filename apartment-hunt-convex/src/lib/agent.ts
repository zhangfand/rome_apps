import type { RomeAppContext } from "@rome-os/app-runtime";

export type StructuredResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Best-effort extraction of a JSON object/array from a free-form agent reply. */
export function extractJson(text: string): unknown {
  if (!text) throw new Error("empty text");
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("no JSON found in agent reply");
  }
}

interface SummonData {
  result?: unknown;
  sessionId?: unknown;
}

/**
 * Run an app-owned agent via the platform `summon` action and parse its final
 * reply as JSON. Agents are instructed to answer with a single JSON object.
 */
export async function runAgentJson<T>(
  appContext: RomeAppContext,
  agentName: string,
  prompt: string,
): Promise<StructuredResult<T>> {
  const res = await appContext.runAction("summon", { agentName, prompt });
  if (res.status !== "ok") {
    const error = res.status === "error" ? res.error : `summon returned ${res.status}`;
    return { ok: false, error };
  }
  const data = res.data as SummonData;
  const text = typeof data?.result === "string" ? data.result : "";
  if (!text) return { ok: false, error: "summon returned no result text" };
  try {
    return { ok: true, data: extractJson(text) as T };
  } catch (err) {
    return { ok: false, error: `could not parse agent output: ${(err as Error).message}` };
  }
}
