import { describe, expect, it } from "@rstest/core";
import { libraryIsEmpty, taskLibrary } from "./library.js";
import type { FactJson } from "./types.js";

const fact = (seq: number, kind: string, payload: Record<string, unknown>, by = "runtime"): FactJson => ({
  seq,
  id: `f-${seq}`,
  taskId: "t-1",
  kind,
  by,
  payload,
  createdAt: `2026-09-30T00:00:${String(seq).padStart(2, "0")}.000Z`,
});

const pin = (path: string, commit = "a".repeat(40)) => ({
  repo: "acme/widgets-work",
  path,
  commit,
  sha256: "0".repeat(64),
  bytes: 10,
  url: `https://github.com/acme/widgets-work/blob/${commit}/${path}`,
});

describe("taskLibrary", () => {
  it("lists each pinned worker report newest first with its worker's agent", () => {
    const library = taskLibrary([
      fact(1, "Dispatched", { workerId: "w-1", agent: "conductor:pm" }),
      fact(2, "Returned", { workerId: "w-1", status: "blocked", summary: "Draft spec pushed.\nNeeds an answer.", reportRef: pin("_conductor/tasks/t-1/reports/w-1.md") }, "w-1"),
      fact(3, "Returned", { workerId: "w-2", status: "succeeded", summary: "Opened the PR.", reportRef: pin("_conductor/tasks/t-1/reports/w-2.md", "b".repeat(40)) }, "w-2"),
    ], new Map([["w-1", "conductor:pm"]]));

    expect(library.reports.map((item) => [item.seq, item.title, item.description])).toEqual([
      [3, "Opened the PR.", "worker · succeeded"],
      [2, "Draft spec pushed.", "conductor:pm · blocked"],
    ]);
    expect(library.reports[1]).toMatchObject({
      href: "https://github.com/acme/widgets-work/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/_conductor/tasks/t-1/reports/w-1.md",
      pinned: { repo: "acme/widgets-work", path: "_conductor/tasks/t-1/reports/w-1.md", commit: "a".repeat(40) },
    });
  });

  it("skips returns whose report is inline or whose reference is incomplete", () => {
    const library = taskLibrary([
      fact(1, "Returned", { workerId: "w-1", status: "succeeded", summary: "x", report: "inline text" }),
      fact(2, "Returned", { workerId: "w-2", status: "succeeded", summary: "x", reportRef: { repo: "acme/widgets-work", path: "r.md" } }),
      fact(3, "Returned", { workerId: "w-3", status: "succeeded", summary: "x", detail: "legacy report" }),
    ]);
    expect(library.reports).toEqual([]);
    expect(libraryIsEmpty(library)).toBe(true);
  });

  it("never infers files from prose", () => {
    const prose = "Spec at acme/widgets-work@" + "c".repeat(40) + ":feature/product-spec.md, see https://github.com/acme/widgets-work/blob/abc1234/feature/technical-spec.md and https://github.com/acme/widgets/pull/4";
    const library = taskLibrary([
      fact(1, "Created", { brief: prose }, "guardian"),
      fact(2, "JobCreated", { jobId: "j-1", agent: "conductor:coder", instructions: prose }, "orchestrator"),
      fact(3, "Returned", { workerId: "w-1", status: "succeeded", summary: prose, detail: { pr: "https://github.com/acme/widgets/pull/4" } }, "w-1"),
      fact(4, "Reported", { report: prose }, "orchestrator"),
      fact(5, "Asked", { question: prose }, "orchestrator"),
      fact(6, "Event", { source: "github", type: "pr_comment", summary: prose }),
    ]);
    expect(libraryIsEmpty(library)).toBe(true);
  });

  it("reads the source from the current origin and from the legacy issue shape", () => {
    const current = taskLibrary([fact(1, "Created", {
      brief: "Fix it",
      origin: { source: "github", key: "k", url: "https://github.com/acme/widgets/issues/7", title: "Crash on save", data: { number: 7 } },
    }, "github:alice")]);
    expect(current.sources).toEqual([expect.objectContaining({
      title: "Crash on save",
      description: "github #7",
      href: "https://github.com/acme/widgets/issues/7",
    })]);

    const legacy = taskLibrary([fact(1, "Created", {
      brief: "Fix it",
      issue: { url: "https://github.com/acme/widgets/issues/8", repo: "acme/widgets", number: 8, title: "Old crash", author: "bob", label: "conductor" },
    }, "github:bob")]);
    expect(legacy.sources[0]).toMatchObject({ title: "Old crash", description: "external source #8", href: "https://github.com/acme/widgets/issues/8" });
  });

  it("lists a child Task's parent spec and plan as recorded, linking only real URLs", () => {
    const library = taskLibrary([fact(1, "Created", {
      brief: "Do the first part",
      parent: {
        taskId: "t-parent",
        planItemId: "T1",
        specRef: "https://github.com/acme/widgets-work/blob/abc/feature/product-spec.md",
        planRef: "feature/technical-spec.md",
      },
    }, "orchestrator")]);

    expect(library.sources).toEqual([
      expect.objectContaining({ title: "Parent's product spec", description: "From parent task t-parent, plan item T1", href: "https://github.com/acme/widgets-work/blob/abc/feature/product-spec.md" }),
      expect.objectContaining({ title: "Parent's engineering plan", reference: "feature/technical-spec.md" }),
    ]);
    expect(library.sources[1].href).toBeUndefined();
  });

  it("never turns a non-http reference into a link", () => {
    const library = taskLibrary([fact(1, "Created", {
      brief: "x",
      origin: { source: "mail", key: "m-1", url: "javascript:alert(1)", title: "Mail" },
      parent: { taskId: "t-p", planItemId: "P", specRef: "javascript:alert(1)" },
    })]);
    expect(library.sources.map((item) => item.href)).toEqual([undefined, undefined]);
    expect(library.sources[1].reference).toBe("javascript:alert(1)");
  });

  it("collects snapshots and archived source payloads as records, newest first", () => {
    const library = taskLibrary([
      fact(1, "Snapshot", { coversThroughSeq: 80, schemaVersion: 2, inputFactCount: 80, estimatedInputTokens: 1, workRepo: pin("_conductor/tasks/t-1/snapshot.md") }, "conductor:ledger-compactor"),
      fact(2, "Snapshot", { coversThroughSeq: 90, schemaVersion: 1, inputFactCount: 1, estimatedInputTokens: 1, summary: "inline only" }, "conductor:ledger-compactor"),
      fact(3, "Event", { source: "github", type: "pr_review", summary: "alice requested changes on #4", data: { artifact: pin("_evidence/github/acme/widgets/pulls/4/reviews/1.json") } }),
      fact(4, "Event", { source: "github", type: "checks_completed", summary: "Checks passed", data: { conclusion: "success" } }),
    ]);

    expect(library.records.map((item) => [item.seq, item.title, item.description])).toEqual([
      [3, "Something changed", "alice requested changes on #4"],
      [1, "History snapshot through #80", "Summary of earlier history"],
    ]);
    expect(library.records[0].pinned?.path).toBe("_evidence/github/acme/widgets/pulls/4/reviews/1.json");
  });

  it("keeps history vocabulary out of copied text", () => {
    const library = taskLibrary([
      fact(1, "Returned", { workerId: "w-1", status: "succeeded", summary: "Updated the ledger facts.", reportRef: pin("r.md") }, "w-1"),
    ]);
    expect(library.reports[0].title).toBe("Updated the history events.");
  });
});
