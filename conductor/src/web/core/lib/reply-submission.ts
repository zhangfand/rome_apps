/** The explicit guardian intent attached to one Board composer submission. */
export type ReplySubmissionIntent =
  | { kind: "reply" }
  | { kind: "answer"; askedSeq: number };

/**
 * Generic replies never resolve a question. Only the separately selected
 * answer intent carries the exact Asked fact association to the API.
 */
export function replySubmissionBody(
  text: string,
  intent: ReplySubmissionIntent,
): { text: string; resolvesAskedSeq?: number } {
  return intent.kind === "answer"
    ? { text, resolvesAskedSeq: intent.askedSeq }
    : { text };
}
