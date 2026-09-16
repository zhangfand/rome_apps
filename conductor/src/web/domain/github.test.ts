import { describe, expect, it } from "@rstest/core";
import { githubWebDomain } from "./github";
import { normalizeRepo } from "./github-project-settings";

const event = (type: string, source = "github") => ({
  seq: 1, id: "f-1", taskId: "t-1", kind: "Event", by: "runtime",
  payload: { type, source }, createdAt: "2026-09-16T00:00:00.000Z",
});

describe("GitHub project settings", () => {
  it("only normalizes valid owner/name repository values", () => {
    expect(normalizeRepo("https://github.com/openai/codex.git")).toBe("openai/codex");
    expect(normalizeRepo("not-a-repository")).toBeUndefined();
    expect(normalizeRepo("../repository")).toBeUndefined();
    expect(normalizeRepo("owner/..")).toBeUndefined();
  });
});

describe("GitHub web vocabulary", () => {
  it("preserves the existing source and event labels", () => {
    expect(githubWebDomain.externalFactLabel).toBe("github");
    expect(githubWebDomain.authorLabel("github:octo")).toBe("github");
    expect(githubWebDomain.authorLabel("runtime", "Event")).toBe("github");
    expect(githubWebDomain.eventTitle(event("pr_review"))).toBe("A review was added");
    expect(githubWebDomain.eventTitle(event("unknown"))).toBe("Something changed on GitHub");
  });
});
