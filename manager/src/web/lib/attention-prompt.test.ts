import { describe, expect, it } from "@rstest/core";
import { attentionPrompt } from "./attention-prompt";

describe("attentionPrompt", () => {
  it("asks for a decision about a report instead of quoting its opening", () => {
    const prompt = attentionPrompt("Report", "Done.\n\nI stashed unrelated changes.\n".repeat(100));
    expect(prompt).toBe("The worker has returned a report. Is this task done, or does it need more work?");
    expect(prompt).not.toContain("stashed");
  });
  it("does not certify completion, CI, or a PR it cannot verify", () => {
    expect(attentionPrompt("Report", "All checks passed, merged!")).not.toMatch(/passed|merged|verified|opened/);
  });
  it("keeps a short question and its alternatives intact", () => {
    expect(attentionPrompt("Question", "Which approach?\n- Preserve compatibility\n- Update callers"))
      .toBe("Which approach? Preserve compatibility Update callers");
  });
  it("keeps important caveats when the whole question is short", () => {
    expect(attentionPrompt("Question", "Deploy now? Do not deploy until the migration is backed up."))
      .toBe("Deploy now? Do not deploy until the migration is backed up.");
  });
  it("removes markdown decoration, not the words", () => {
    expect(attentionPrompt("Question", "Should I use **SQLite** or `Postgres`?"))
      .toBe("Should I use SQLite or Postgres?");
  });
  it("uses an explicitly labeled question after lengthy background", () => {
    expect(attentionPrompt("Question", "Background. ".repeat(50) + "\n\n## Question\nPreserve compatibility or update callers?\n\n## Evidence\nLogs"))
      .toBe("Preserve compatibility or update callers?");
  });
  it("retains choices in a separate paragraph of a labeled question", () => {
    expect(attentionPrompt("Question", "Background. ".repeat(50) + "\n\n## Question\nWhich approach?\n\n- Preserve compatibility\n- Update callers"))
      .toBe("Which approach? Preserve compatibility Update callers");
  });
  it("recognizes a bold decision heading", () => {
    expect(attentionPrompt("Question", "Background. ".repeat(50) + "\n\n**Decision needed**\nWhich database?"))
      .toBe("Which database?");
  });
  it("does not guess which question matters in a long narrative", () => {
    expect(attentionPrompt("Question", "Is this a problem? ".repeat(100))).toContain("Open Details");
  });
  it("does not clip a long question or silently omit code", () => {
    expect(attentionPrompt("Question", "## Question\n" + "Long alternative ".repeat(40))).toContain("Open Details");
    expect(attentionPrompt("Question", "Which query?\n```sql\nSELECT * FROM a;\n```" )).toContain("Open Details");
  });
  it("handles an empty question safely", () => {
    expect(attentionPrompt("Question", "  \n")).toContain("Open Details");
  });
});
