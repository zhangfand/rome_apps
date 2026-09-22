import { describeFact, type Fact, type SnapshotFact } from "./facts.js";
import type { TaskView } from "./fold.js";

/**
 * Keep each uncompacted ledger segment comfortably inside the medium model's
 * context. The byte-based estimate is intentionally conservative for CJK.
 */
export const SNAPSHOT_TOKEN_THRESHOLD = 24_000;
export const SNAPSHOT_FACT_THRESHOLD = 80;
export const SNAPSHOT_MAX_CHARS = 16_000;
export const SNAPSHOT_AGENT = "conductor:ledger-compactor";

export interface SnapshotInput {
  previous?: SnapshotFact;
  facts: Fact[];
  factCount: number;
  estimatedTokens: number;
}

export function latestLedgerSnapshot(facts: readonly Fact[]): SnapshotFact | undefined {
  return [...facts].reverse().find((fact): fact is SnapshotFact => fact.kind === "Snapshot");
}

/** Facts not yet compressed by the newest Snapshot. Snapshot facts themselves are metadata. */
export function snapshotInput(
  task: Pick<TaskView, "facts">,
  externalizedPreviousSummary?: string,
): SnapshotInput {
  const previous = latestLedgerSnapshot(task.facts);
  const after = previous?.payload.coversThroughSeq ?? 0;
  const facts = task.facts.filter((fact) => fact.seq > after && fact.kind !== "Snapshot");
  const rendered = renderSnapshotSource(previous, facts, externalizedPreviousSummary);
  return {
    previous,
    facts,
    factCount: facts.length,
    estimatedTokens: estimateTokens(rendered),
  };
}

export function shouldSnapshotTask(task: Pick<TaskView, "facts">): boolean {
  const previous = latestLedgerSnapshot(task.facts);
  const after = previous?.payload.coversThroughSeq ?? 0;
  const facts = task.facts.filter((fact) => fact.seq > after && fact.kind !== "Snapshot");
  const factTokens = estimateTokens(facts.map((fact) => describeFact(fact, { full: true })).join("\n"));
  const previousTokens = previous?.payload.summary
    ? estimateTokens(previous.payload.summary)
    : previous?.payload.workRepo
      ? Math.ceil(previous.payload.workRepo.bytes / 3)
      : 0;
  return facts.length >= SNAPSHOT_FACT_THRESHOLD || factTokens + previousTokens >= SNAPSHOT_TOKEN_THRESHOLD;
}

/**
 * Select the bounded ledger context for a coordinator prompt. Created remains
 * visible as the canonical request; the latest Snapshot replaces its covered
 * prefix and later raw facts remain verbatim.
 */
export function coordinatorFacts(
  task: Pick<TaskView, "facts">,
  deliveredThroughSeq?: number,
): { facts: Fact[]; compacted: boolean; snapshot?: SnapshotFact } {
  const snapshot = latestLedgerSnapshot(task.facts);
  if (!snapshot) {
    return {
      facts: deliveredThroughSeq === undefined
        ? [...task.facts]
        : task.facts.filter((fact) => fact.seq > deliveredThroughSeq),
      compacted: false,
    };
  }

  // A Session that has already received this Snapshot only needs its ordinary
  // delta. If the Snapshot is newer than its cursor, it replaces every raw fact
  // in the covered gap rather than sending both forms.
  if (deliveredThroughSeq !== undefined && snapshot.seq <= deliveredThroughSeq) {
    return {
      facts: task.facts.filter((fact) => fact.seq > deliveredThroughSeq),
      compacted: false,
      snapshot,
    };
  }

  const created = task.facts.find((fact) => fact.kind === "Created");
  const tail = task.facts.filter((fact) => fact.seq > snapshot.payload.coversThroughSeq && fact.kind !== "Snapshot");
  return {
    facts: [created, snapshot, ...tail].filter((fact): fact is Fact => Boolean(fact)),
    compacted: true,
    snapshot,
  };
}

export function buildLedgerSnapshotPrompt(
  task: TaskView,
  externalizedPreviousSummary?: string,
): { prompt: string; input: SnapshotInput } {
  const input = snapshotInput(task, externalizedPreviousSummary);
  const newest = task.latest.seq;
  return {
    input,
    prompt: [
      `# Compact Task ledger ${task.id}`,
      "",
      `Summarize the durable current state represented through fact #${newest}.`,
      "Do not decide what should happen next, invent facts, or omit a still-active constraint, commitment, blocker, open question, Job, or artifact reference.",
      "Preserve exact Task, Job, worker, session, issue, PR, commit, path, URL, and fact-sequence identifiers when they remain relevant.",
      "Historical attempts may be collapsed to their outcome. Conflicting or uncertain evidence must stay explicitly conflicting or uncertain.",
      "The result must be sufficient for the task coordinator to continue without reading the covered raw facts.",
      "",
      "Use these headings when applicable: Objective; Person decisions and constraints; Current state; Jobs and outcomes; Durable artifacts and evidence; Open questions and blockers; Rejected or superseded paths; Expected next step.",
      `Keep the snapshot under ${SNAPSHOT_MAX_CHARS} characters. Return only the Markdown snapshot inside one fenced block named \`ledger-snapshot\`.`,
      "",
      "## Source",
      renderSnapshotSource(input.previous, input.facts, externalizedPreviousSummary),
    ].join("\n"),
  };
}

export function parseLedgerSnapshotReply(reply: string): string | undefined {
  const text = reply.trim();
  const fenced = text.match(/```ledger-snapshot\s*\n([\s\S]*?)\n```/i)?.[1]?.trim();
  const summary = fenced ?? text;
  if (!summary || summary.length > SNAPSHOT_MAX_CHARS) return undefined;
  return summary;
}

function renderSnapshotSource(
  previous: SnapshotFact | undefined,
  facts: readonly Fact[],
  externalizedPreviousSummary?: string,
): string {
  const lines: string[] = [];
  if (previous) {
    const previousSummary = previous.payload.summary ?? externalizedPreviousSummary;
    if (!previousSummary) {
      throw new Error(`Snapshot #${previous.seq} has no inline body and its external artifact was not loaded`);
    }
    lines.push(
      `### Previous Snapshot #${previous.seq} (covers through #${previous.payload.coversThroughSeq})`,
      previousSummary,
      "",
      "### Facts after the previous covered prefix",
    );
  } else {
    lines.push("### Raw facts");
  }
  // Compaction is the one place where the model must see the complete covered
  // evidence. Ordinary coordinator history may clip old detail for display,
  // but a Snapshot must not be derived from an already-truncated rendition.
  lines.push(...facts.map((fact) => describeFact(fact, { full: true })));
  return lines.join("\n");
}

/** A provider-independent estimate; deliberately errs high for ASCII and CJK. */
export function estimateTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, "utf8") / 3);
}
