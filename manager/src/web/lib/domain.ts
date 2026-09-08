/**
 * Names in the guardian's own vocabulary. The ledger keys everything by
 * opaque ids (`t-68b28f8c`, `w-84c83133`); a person thinks in issues, pull
 * requests, and "the third worker". Everything here is a pure function over
 * the view the API already returns, so the server stays untouched and the
 * raw id is always one hover away.
 */
import type { FactSummary, TaskDetail, TaskSummary, WorkerSummary } from "./types";

export type RefKind = "issue" | "pr";

export interface Ref {
  kind: RefKind;
  /** `owner/repo` */
  repo: string;
  number: number;
  url: string;
  /** `rome#180` or `PR #259` */
  label: string;
}

const URL_RE = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(issues|pull)\/(\d+)/g;
const SHORT_RE = /(?<![\w/])([\w.-]+)\/([\w.-]+)#(\d+)/g;

function repoShort(repo: string): string {
  return repo.split("/")[1] ?? repo;
}

function makeRef(kind: RefKind, owner: string, name: string, n: string): Ref {
  const repo = `${owner}/${name}`;
  const number = Number(n);
  const path = kind === "pr" ? "pull" : "issues";
  return {
    kind,
    repo,
    number,
    url: `https://github.com/${repo}/${path}/${number}`,
    label: kind === "pr" ? `PR #${number}` : `${repoShort(repo)}#${number}`,
  };
}

/** Every GitHub issue / PR reference in a piece of text, de-duplicated, in order of appearance. */
export function refsIn(text: string | undefined | null): Ref[] {
  if (!text) return [];
  const out: Ref[] = [];
  const seen = new Set<string>();
  const push = (ref: Ref) => {
    if (seen.has(ref.url)) return;
    seen.add(ref.url);
    out.push(ref);
  };
  for (const m of text.matchAll(URL_RE)) push(makeRef(m[3] === "pull" ? "pr" : "issue", m[1], m[2], m[4]));
  for (const m of text.matchAll(SHORT_RE)) push(makeRef("issue", m[1], m[2], m[3]));
  return out;
}

function stringsOf(payload: Record<string, unknown>): string[] {
  return Object.values(payload).filter((v): v is string => typeof v === "string");
}

/** A short human title for a task with no issue to name it by. */
export function titleOf(brief: string, max = 72): string {
  const sentence = openingOf(brief);
  const clean = sentence
    .replace(URL_RE, "")
    .replace(/\s+/g, " ")
    .replace(/[\s:;,\-–—]+$/g, "")
    .trim();
  const base = clean.length > 0 ? clean : sentence;
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base;
}

export interface TaskHandle {
  /** What to call the task: `rome#180`, or a short title from the brief. */
  name: string;
  /** True when `name` is an issue reference rather than prose. */
  isRef: boolean;
  /** The issue the task is about, if the brief names one. */
  issue?: Ref;
  /** Pull requests the work produced, newest mention last. */
  prs: Ref[];
}

function collectTexts(task: TaskSummary | TaskDetail): string[] {
  const texts: string[] = [];
  if ("facts" in task) {
    for (const f of task.facts) texts.push(...stringsOf(f.payload));
  } else {
    if (task.attention) texts.push(task.attention.text, task.attention.evidence ?? "");
    texts.push(task.latest.line, ...stringsOf(task.latest.payload));
    for (const w of task.workers) if (w.outcome) texts.push(w.outcome);
  }
  return texts;
}

/** The opening of a brief: its first line, cut at the first sentence end. */
function openingOf(brief: string): string {
  const firstLine = brief.split(/\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? brief;
  return firstLine.match(/^(.{12,}?[.!?])(\s|$)/)?.[1] ?? firstLine;
}

export function handleOf(task: TaskSummary | TaskDetail): TaskHandle {
  // An issue names the task only when the brief opens with it. A brief that
  // merely mentions an issue further down ("…like #180, for example") is
  // about something else.
  const issue = refsIn(openingOf(task.brief)).find((r) => r.kind === "issue");
  const prs: Ref[] = [];
  const seen = new Set<string>();
  for (const text of [task.brief, ...collectTexts(task)]) {
    for (const ref of refsIn(text)) {
      if (ref.kind !== "pr" || seen.has(ref.url)) continue;
      seen.add(ref.url);
      prs.push(ref);
    }
  }
  return issue
    ? { name: issue.label, isRef: true, issue, prs }
    : { name: titleOf(task.brief), isRef: false, prs };
}

/** `worker 3` — the ordinal of a worker among the workers on its task. */
export interface WorkerName {
  ordinal: number;
  label: string;
  taskId: string;
  /** Where the worker runs (or ran), when the ledger has recorded it. */
  session?: { id: string; type: string };
}

export type WorkerNames = ReadonlyMap<string, WorkerName>;

export function nameWorkers(tasks: readonly { id: string; workers: WorkerSummary[] }[]): WorkerNames {
  const map = new Map<string, WorkerName>();
  for (const task of tasks) {
    const ordered = [...task.workers].sort((a, b) => a.startedSeq - b.startedSeq);
    ordered.forEach((w, i) => {
      map.set(w.workerId, { ordinal: i + 1, label: `worker ${i + 1}`, taskId: task.id, session: w.romeSession });
    });
  }
  return map;
}

export function workerLabel(names: WorkerNames, workerId: string): string {
  return names.get(workerId)?.label ?? workerId;
}

export type Author = { kind: "person" | "runtime" | "worker"; label: string; raw: string };

/** Who wrote a fact, in words: a person by name, the runtime, or "worker 3". */
export function authorOf(fact: FactSummary, names: WorkerNames): Author {
  if (fact.by === "runtime") return { kind: "runtime", label: "runtime", raw: fact.by };
  const named = names.get(fact.by);
  if (named) return { kind: "worker", label: named.label, raw: fact.by };
  if (/^w-[0-9a-f]+$/i.test(fact.by)) return { kind: "worker", label: "a worker", raw: fact.by };
  return { kind: "person", label: fact.by, raw: fact.by };
}

/** `/home/rome/.rome/default/projects/rome` → `projects/rome`. */
export function shortPath(path: string): string {
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  return parts.length <= 2 ? path : parts.slice(-2).join("/");
}

/** Replace raw worker ids in free text with the names the page uses. */
export function humanize(text: string, names: WorkerNames): string {
  return text
    .replace(/\bworker\s+(w-[0-9a-f]{6,})\b/gi, (m, id: string) => names.get(id)?.label ?? m)
    .replace(/\bw-[0-9a-f]{6,}\b/gi, (id) => names.get(id)?.label ?? id);
}

/**
 * A brief with the URL of the issue that already names it removed, so the
 * heading and the first line do not say the same thing twice.
 */
export function briefText(brief: string, handle: TaskHandle): string {
  if (!handle.issue) return brief;
  return brief
    .split(handle.issue.url)
    .join("")
    .replace(/:\s*(\n|$)/, ".$1")
    .replace(/[ \t]{2,}/g, " ");
}

/** Markdown reduced to plain words for one-line previews. */
export function plain(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "");
}

/**
 * The substance of a worker's report, for the card that asks for sign-off.
 * Workers write whatever they like; the useful part is usually under a
 * "Summary"-like heading, and the opening is often housekeeping ("I restored
 * your stash…"). So: prefer a section whose heading says it is the summary,
 * then the first section under any heading, then the first paragraph that
 * is not a parenthetical aside. `partial` says whether there is more.
 */
export function gist(markdown: string): { text: string; partial: boolean } {
  const src = markdown.trim();
  if (!src) return { text: "", partial: false };

  const lines = src.split("\n");
  type Section = { heading: string | null; body: string };
  const sections: Section[] = [];
  let current: Section = { heading: null, body: "" };
  for (const line of lines) {
    const h = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const bold = line.match(/^\s*\*\*([^*]{2,60})\*\*\s*:?\s*$/);
    if (h || bold) {
      sections.push(current);
      current = { heading: (h?.[1] ?? bold?.[1] ?? "").trim(), body: "" };
    } else {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  sections.push(current);
  const named = sections.filter((s) => s.heading !== null && s.body.trim());
  const preferred = named.find((s) => /\b(summary|outcome|result|tl;?dr|what (i|we) did|done)\b/i.test(s.heading ?? ""));
  const pick = preferred ?? named[0];
  if (pick) {
    const body = pick.body.trim();
    return { text: body, partial: body.length < src.length - 40 };
  }

  const paragraphs = src.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const first = paragraphs.find((p) => !/^\(/.test(p)) ?? paragraphs[0] ?? src;
  return { text: first, partial: paragraphs.length > 1 };
}
