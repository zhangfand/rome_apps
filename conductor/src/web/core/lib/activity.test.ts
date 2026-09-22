import { describe, expect, it } from "@rstest/core";
import { groupActivityRounds, orderActivity } from "./activity.js";
import type { FactJson } from "./types.js";

const fact = (seq: number, by = "runtime", createdAt = `2026-09-21T00:00:0${seq}.000Z`): FactJson => ({
  seq,
  id: `f-${seq}`,
  taskId: "t-1",
  kind: by === "orchestrator" ? "Reported" : "Event",
  by,
  payload: {},
  createdAt,
});

describe("Activity ordering", () => {
  it("sorts by time in both directions and uses sequence as a stable tie-breaker", () => {
    const entries = [
      fact(3, "runtime", "2026-09-21T00:00:02.000Z"),
      fact(1, "runtime", "2026-09-21T00:00:01.000Z"),
      fact(2, "runtime", "2026-09-21T00:00:02.000Z"),
    ];

    expect(orderActivity(entries, "oldest").map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(orderActivity(entries, "newest").map((item) => item.seq)).toEqual([3, 2, 1]);
    expect(entries.map((item) => item.seq)).toEqual([3, 1, 2]);
  });

  it("keeps Stream rounds intact while reversing their visible chronology", () => {
    const entries = [
      fact(1),
      fact(2, "orchestrator"),
      fact(3),
      fact(4, "orchestrator"),
    ];

    expect(groupActivityRounds(entries, "oldest").map((round) => round.entries.map((item) => item.seq))).toEqual([[1, 2], [3, 4]]);
    expect(groupActivityRounds(entries, "newest").map((round) => round.entries.map((item) => item.seq))).toEqual([[4, 3], [2, 1]]);
  });
});
