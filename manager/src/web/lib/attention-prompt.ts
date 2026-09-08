import { plain } from "./domain";

const QUESTION_LIMIT = 280;
const QUESTION_FALLBACK = "The worker needs your decision before continuing. Open Details to read the full question.";

/** Decision-first copy, not a clipped worker report or a claim that its work is verified.
 * Keep short questions intact (including choices). Never guess a question from a long
 * narrative: use an explicitly labeled question, or direct the guardian to the original.
 */
export function attentionPrompt(kind: "Question" | "Report", text: string): string {
  if (kind === "Report") {
    return "The worker has returned a report. Is this task done, or does it need more work?";
  }

  const normalize = (value: string) => plain(value).replace(/\s+/g, " ").trim();
  const whole = normalize(text);
  // Code may be essential to a choice; plain() strips fenced code, so do not silently
  // lose it when deciding whether the question is short enough to show in full.
  if (whole && whole.length <= QUESTION_LIMIT && !text.includes("```")) return whole;

  const labeled = text.match(
    /^(?:#{1,6}\s+|\*\*)?(?:question|decision needed|your decision)(?:\*\*)?\s*:?\s*\n([\s\S]*?)(?=\n#{1,6}\s|(?![\s\S]))/im,
  )?.[1];
  if (labeled && !labeled.includes("```")) {
    const question = normalize(labeled);
    if (question && question.length <= QUESTION_LIMIT) return question;
  }
  return QUESTION_FALLBACK;
}
