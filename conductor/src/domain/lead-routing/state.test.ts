import { describe, expect, it } from "@rstest/core";
import type { Fact } from "../../core/lib/facts.js";
import { foldTask } from "../../core/lib/fold.js";
import { shouldEvaluateLeadRouting } from "./index.js";
import { buildLeadRoutingState } from "./state.js";

const at = new Date("2026-09-21T00:00:00.000Z");
function fact(seq: number, kind: Fact["kind"], payload: Record<string, unknown>, by = "person"): Fact {
  return { seq, id: `f-${seq}`, taskId: "t-1", kind, by, createdAt: at, payload } as Fact;
}

describe("lead-routing state", () => {
  it("keeps only compact intake context and recent person updates", () => {
    const task = foldTask([
      fact(1, "Created", { brief: "Build a settings search", projectId: "conductor", project: { workspace: "git-worktree" }, origin: { source: "github", key: "1" } }),
      fact(2, "Reply", { text: "Keyboard navigation matters." }),
    ]);
    expect(buildLeadRoutingState(task, "none")).toEqual({
      request: "Build a settings search",
      personUpdates: ["Keyboard navigation matters."],
      project: { id: "conductor", workspace: "git-worktree", source: "github" },
    });
    expect(shouldEvaluateLeadRouting(task)).toBe(true);
  });

  it("does not reclassify evidence after the lead has made a decision", () => {
    const task = foldTask([
      fact(1, "Created", { brief: "Build it" }),
      fact(2, "JobCreated", { jobId: "j-1", agent: "coding:coding", instructions: "Implement it" }, "orchestrator"),
    ]);
    expect(shouldEvaluateLeadRouting(task)).toBe(false);
  });
});

