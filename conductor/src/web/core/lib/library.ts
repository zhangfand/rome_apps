import { eventTitle, safeText } from "./facts";
import { webDomain } from "../domain";
import type { FactJson } from "./types";

/**
 * A Task's Library: the files and sources its history points at, gathered in
 * one place instead of one Activity entry at a time.
 *
 * Only structured fields count. A pinned reference on a worker's return, a
 * history snapshot or a source event, the Task's origin, and a child Task's
 * parent spec and plan fields are read as recorded. Free text is never
 * searched for file names, commits or links: the work repository has no fixed
 * layout, so anything inferred from prose would be a guess.
 */
export interface LibraryItem {
  /** Stable React key. */
  key: string;
  /** The event the item was read from, so a reader can find it in Activity. */
  seq: number;
  at: string;
  title: string;
  description: string;
  /** An http(s) link recorded on the event. Absent when none was recorded. */
  href?: string;
  /** The exact file version, when the event pinned one. */
  pinned?: { repo: string; path: string; commit: string };
  /** A recorded reference that is not a link, shown as written. */
  reference?: string;
}

export interface TaskLibrary {
  /** Each worker run's full report, newest first. */
  reports: LibraryItem[];
  /** Where the Task came from: its source, and a child Task's parent spec and plan. */
  sources: LibraryItem[];
  /** History snapshots and archived source payloads, newest first. */
  records: LibraryItem[];
}

export function taskLibrary(
  facts: readonly FactJson[],
  workerAgents: ReadonlyMap<string, string> = new Map(),
): TaskLibrary {
  const reports: LibraryItem[] = [];
  const sources: LibraryItem[] = [];
  const records: LibraryItem[] = [];

  for (const fact of facts) {
    const p = fact.payload;
    switch (fact.kind) {
      case "Created":
        sources.push(...createdSources(fact));
        break;
      case "Returned": {
        const pin = pinnedRef(p.reportRef);
        if (!pin) break;
        const workerId = text(p.workerId);
        const agent = workerAgents.get(workerId) || "worker";
        reports.push({
          key: `report-${fact.seq}`,
          seq: fact.seq,
          at: fact.createdAt,
          title: firstLine(safeText(text(p.summary))) || "Worker report",
          description: [agent, text(p.status)].filter(Boolean).map(safeText).join(" · "),
          href: pin.href,
          pinned: pin.pinned,
        });
        break;
      }
      case "Snapshot": {
        const pin = pinnedRef(p.workRepo);
        if (!pin) break;
        const through = typeof p.coversThroughSeq === "number" ? p.coversThroughSeq : undefined;
        records.push({
          key: `snapshot-${fact.seq}`,
          seq: fact.seq,
          at: fact.createdAt,
          title: through !== undefined ? `History snapshot through #${through}` : "History snapshot",
          description: "Summary of earlier history",
          href: pin.href,
          pinned: pin.pinned,
        });
        break;
      }
      case "Event": {
        const data = record(p.data);
        const pin = pinnedRef(data?.artifact);
        if (!pin) break;
        records.push({
          key: `event-${fact.seq}`,
          seq: fact.seq,
          at: fact.createdAt,
          title: eventTitle(fact),
          description: firstLine(safeText(text(p.summary))),
          href: pin.href,
          pinned: pin.pinned,
        });
        break;
      }
    }
  }

  return { reports: reports.reverse(), sources, records: records.reverse() };
}

export function libraryIsEmpty(library: TaskLibrary): boolean {
  return !library.reports.length && !library.sources.length && !library.records.length;
}

function createdSources(fact: FactJson): LibraryItem[] {
  const items: LibraryItem[] = [];
  const base = { seq: fact.seq, at: fact.createdAt };

  // Facts written before the ingest seam carry the older `issue` shape.
  const origin = record(fact.payload.origin) ?? record(fact.payload.issue);
  if (origin) {
    const source = text(origin.source) || webDomain().legacyOriginSource;
    const data = record(origin.data);
    const number = typeof origin.number === "number" ? origin.number : typeof data?.number === "number" ? data.number : undefined;
    const href = httpUrl(origin.url);
    items.push({
      ...base,
      key: `origin-${fact.seq}`,
      title: safeText(text(origin.title)) || "Where this task came from",
      description: safeText(`${source}${number !== undefined ? ` #${number}` : ""}`),
      ...(href ? { href } : {}),
    });
  }

  const parent = record(fact.payload.parent);
  if (parent) {
    const from = [
      text(parent.taskId) ? `From parent task ${text(parent.taskId)}` : "From the parent task",
      text(parent.planItemId) ? `plan item ${text(parent.planItemId)}` : "",
    ].filter(Boolean).map(safeText).join(", ");
    for (const [field, title] of [["specRef", "Parent's product spec"], ["planRef", "Parent's engineering plan"]] as const) {
      const ref = text(parent[field]).trim();
      if (!ref) continue;
      const href = httpUrl(ref);
      items.push({
        ...base,
        key: `parent-${field}-${fact.seq}`,
        title,
        description: from,
        ...(href ? { href } : { reference: safeText(ref) }),
      });
    }
  }
  return items;
}

/** A work-repository file pinned by repository, path and commit. */
function pinnedRef(value: unknown): Pick<LibraryItem, "href" | "pinned"> | undefined {
  const ref = record(value);
  if (!ref) return undefined;
  const repo = text(ref.repo);
  const path = text(ref.path);
  const commit = text(ref.commit);
  if (!repo || !path || !commit) return undefined;
  const href = httpUrl(ref.url);
  return { ...(href ? { href } : {}), pinned: { repo, path, commit } };
}

/** Only http(s) links become anchors; anything else is not a safe target. */
function httpUrl(value: unknown): string | undefined {
  const url = text(value).trim();
  return /^https?:\/\/\S+$/i.test(url) ? url : undefined;
}

function firstLine(value: string): string {
  return value.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
