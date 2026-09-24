import { describe, expect, it } from "@rstest/core";
import type { PinnedArtifactRef } from "./facts.js";
import { externalizeReport } from "./worker-report.js";

const ref: PinnedArtifactRef = {
  repo: "acme/widgets-work",
  path: "_conductor/tasks/t1/reports/w-1.md",
  commit: "abc123",
  sha256: "digest",
  bytes: 42,
  url: "https://github.com/acme/widgets-work/blob/abc123/_conductor/tasks/t1/reports/w-1.md",
};
const parsed = { status: "blocked" as const, summary: "Two readings.", detail: { needs: "pm" }, report: "Read settings.ts." };

describe("externalizeReport", () => {
  it("replaces the inline report with a pinned reference", async () => {
    let stored = "";
    const { fields, archiveError } = await externalizeReport(parsed, async (report) => { stored = report; return ref; });
    expect(stored).toBe("Read settings.ts.");
    expect(fields).toEqual({ status: "blocked", summary: "Two readings.", detail: { needs: "pm" }, reportRef: ref });
    expect(archiveError).toBeUndefined();
  });

  it("keeps the report inline when there is no store or the store declines", async () => {
    expect((await externalizeReport(parsed, undefined)).fields).toEqual(parsed);
    expect((await externalizeReport(parsed, async () => undefined)).fields).toEqual(parsed);
  });

  it("keeps the report inline and surfaces the error when storing fails", async () => {
    const result = await externalizeReport(parsed, async () => { throw new Error("push rejected"); });
    expect(result.fields).toEqual(parsed);
    expect(result.archiveError).toBe("push rejected");
  });

  it("never externalizes an unparsed reply", async () => {
    const unparsed = { status: "unparsed" as const, summary: "prose", report: "prose", raw: "prose" };
    let called = false;
    const { fields } = await externalizeReport(unparsed, async () => { called = true; return ref; });
    expect(called).toBe(false);
    expect(fields).toEqual(unparsed);
  });
});
