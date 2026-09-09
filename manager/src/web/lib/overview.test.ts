import { describe, expect, it } from "@rstest/core";
import { overviewGroups, resultPreview, taskStatus, taskTitle } from "./overview";
import { task, fixtureTasks } from "./test-overview";

describe("overview grouping", () => {
  it("places each open task in exactly one section and excludes closed tasks", () => {
    const groups = overviewGroups(fixtureTasks());
    expect(groups.decisions.map((t) => t.id)).toEqual(["question"]);
    expect(groups.prs.map((t) => t.id)).toEqual(["pr"]);
    expect(groups.results.map((t) => t.id)).toEqual(["result"]);
    expect(groups.progress.map((t) => t.id)).toEqual(["running", "waiting", "created"]);
    const ids = Object.values(groups).flat().map((t) => t.id);
    expect(ids.length).toBe(6); expect(new Set(ids).size).toBe(6);
  });
  it("does not promote a historical PR into the current report", () => {
    const t = task("result", { brief: "Old https://github.com/acme/repo/pull/3", attention: { kind: "Report", text: "No code change needed." } });
    expect(overviewGroups([t]).prs).toEqual([]); expect(overviewGroups([t]).results).toEqual([t]);
  });
  it("keeps current multi-PR reports in one task group", () => {
    const t = task("multi", { attention: { kind: "Report", text: "https://github.com/acme/repo/pull/1 and https://github.com/acme/repo/pull/2" } });
    expect(overviewGroups([t]).prs).toHaveLength(1);
  });
  it("uses actual outcome summaries and compact user-facing states", () => {
    expect(resultPreview("## Summary\nFound four Git LFS objects.\n\n## Evidence\nLong logs")).toBe("Found four Git LFS objects.");
    expect(resultPreview("x".repeat(400)).length).toBeLessThanOrEqual(180);
    expect(fixtureTasks().map(taskStatus)).toEqual(["Needs an answer", "Result available", "Result available", "Working", "Waiting", "Queued", "Completed", "Cancelled"]);
    expect(taskTitle(task("abc"))).toBe("Task abc does useful work");
  });
});
