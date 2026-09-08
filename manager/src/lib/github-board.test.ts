import { describe, expect, it } from "@rstest/core";
import { extractIssueSection, parseBlockedByReferences, parseClosingReferences } from "./github-board.js";

describe("GitHub board references", () => {
  it("reads only the Blocked by section and de-duplicates references", () => {
    const body = "## Work\nShip it\n\n## Blocked by\n- #12\n- acme/api#8\n- #12\n\n## Notes\n#99";
    expect(extractIssueSection(body, "Blocked by")).toBe("- #12\n- acme/api#8\n- #12");
    expect(parseBlockedByReferences(body, "acme/web")).toEqual([
      { repo: "acme/api", number: 8 },
      { repo: "acme/web", number: 12 },
    ]);
  });

  it("finds closing PR references but not unrelated mentions", () => {
    expect(parseClosingReferences("Fixes #42 and resolves acme/api#9. Related #77.", "acme/web")).toEqual([
      { repo: "acme/api", number: 9 },
      { repo: "acme/web", number: 42 },
    ]);
  });
});
