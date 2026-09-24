import type { PinnedArtifactRef, ReturnedFact } from "./facts.js";
import type { ParsedReply } from "./worker-reply.js";

type ReportFields = Pick<ReturnedFact["payload"], "status" | "summary" | "detail" | "report" | "reportRef" | "raw">;

/**
 * Handoffs carry references, not content. A worker's full report moves to
 * durable storage and the Returned fact keeps only the generic result, the
 * structured detail, and a pinned reference to the report, so later prompts
 * cite it instead of repeating it.
 *
 * The report stays inline when there is no store, the store declines, or it
 * fails — losing the report is worse than carrying it — and when the reply was
 * unparseable, because then the text itself is what the reader must interpret.
 */
export async function externalizeReport(
  parsed: ParsedReply,
  archive: ((report: string) => Promise<PinnedArtifactRef | undefined>) | undefined,
): Promise<{ fields: ReportFields; archiveError?: string }> {
  const { report, ...rest } = parsed;
  if (!report || !archive || parsed.status === "unparsed") return { fields: parsed };
  try {
    const reportRef = await archive(report);
    return { fields: reportRef ? { ...rest, reportRef } : parsed };
  } catch (error) {
    return { fields: parsed, archiveError: error instanceof Error ? error.message : String(error) };
  }
}
