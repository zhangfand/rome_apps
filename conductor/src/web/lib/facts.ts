import type { FactJson } from "./types";

export const KIND_TONE: Record<string, string> = {
  Created: "bg-primary/15 text-primary",
  Reply: "bg-primary/15 text-primary",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Cancelled: "bg-muted text-muted-foreground",
  Dispatched: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Asked: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Reported: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  Waited: "bg-muted text-muted-foreground",
  Noted: "bg-muted text-muted-foreground",
  Opened: "bg-muted text-muted-foreground",
  Returned: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Failed: "bg-destructive/15 text-destructive",
  Lost: "bg-destructive/15 text-destructive",
  Event: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

export function authorLabel(by: string): string {
  if (by === "orchestrator") return "orchestrator";
  if (by === "runtime") return "runtime";
  if (by.startsWith("github:")) return by;
  if (/^w-[0-9a-f]{8}$/.test(by)) return `worker ${by}`;
  return by;
}

/** The body of a fact, as markdown-ish text for display. */
export function factBody(fact: FactJson): { title: string; body?: string; extra?: string } {
  const p = fact.payload as Record<string, unknown>;
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  switch (fact.kind) {
    case "Created": return { title: "Request", body: s("brief") };
    case "Reply": return { title: "Reply", body: s("text") };
    case "Completed": return { title: "Completed", body: [s("reason"), s("evidence") ? `Evidence: ${s("evidence")}` : undefined].filter(Boolean).join("\n\n") };
    case "Cancelled": return { title: "Cancelled", body: s("reason") };
    case "Dispatched": return {
      title: `Dispatched ${s("workerId")} as ${s("agent")}${s("resumeWorkerId") ? ` (continuing ${s("resumeWorkerId")})` : ""}`,
      body: s("note"), extra: s("instructions"),
    };
    case "Asked": return { title: "Question for you", body: s("question") };
    case "Reported": return { title: "Report", body: s("report") };
    case "Waited": return { title: `Waiting until ${s("resumeAfter") ? new Date(s("resumeAfter")!).toLocaleString() : "?"}`, body: s("reason") };
    case "Noted": return { title: "Note", body: s("note") };
    case "Opened": return { title: `Worker ${s("workerId")} session ${s("romeSessionId")}` };
    case "Returned": return { title: `Worker ${s("workerId")} returned: ${s("status")}`, body: s("summary"), extra: s("detail") };
    case "Failed": return { title: `Worker ${s("workerId")} failed`, body: s("error") };
    case "Lost": return { title: `Worker ${s("workerId")} lost`, body: s("why") };
    case "Event": return { title: `Event ${s("source")}/${s("type")}`, body: s("summary") };
    default: return { title: fact.kind, body: JSON.stringify(p) };
  }
}
