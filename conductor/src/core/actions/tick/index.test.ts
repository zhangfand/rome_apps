import { describe, expect, it } from "@rstest/core";
import type { Fact, NewFact } from "../../lib/facts.js";
import { observeChildOutcomes } from "./index.js";

describe("observing materialized task outcomes", () => {
  it("wakes the parent once without interpreting what the child unlocks", () => {
    const at = new Date("2026-09-18T00:00:00Z");
    let seq = 0;
    const make = (fact: NewFact): Fact => ({ ...fact, seq: ++seq, id: `f-${seq}`, createdAt: at }) as Fact;
    const facts: Fact[] = [
      make({ taskId: "parent", kind: "Created", by: "person", payload: { brief: "deliver feature", projectId: "app", project: { workingDir: "/repo" } } }),
      make({ taskId: "parent", kind: "Noted", by: "orchestrator", payload: { note: "materialized ready work" } }),
      make({ taskId: "child", kind: "Created", by: "orchestrator", payload: {
        brief: "implement bounded slice",
        projectId: "app",
        project: { workingDir: "/repo" },
        parent: { taskId: "parent", planItemId: "slice-1", specRef: "feature/spec.md" },
      } }),
      make({ taskId: "child", kind: "Completed", by: "orchestrator", payload: { reason: "PR ready" } }),
    ];
    const ledger = {
      all: () => facts,
      append: (fact: NewFact) => {
        const written = make(fact);
        facts.push(written);
        return written;
      },
    };

    expect(observeChildOutcomes(ledger, at)).toEqual(["Event(parent): child child completed"]);
    const event = facts.at(-1)!;
    expect(event.kind).toBe("Event");
    if (event.kind === "Event") {
      expect(event.payload.type).toBe("child_finished");
      expect(event.payload.data).toMatchObject({ childTaskId: "child", planItemId: "slice-1", state: "completed" });
    }
    expect(observeChildOutcomes(ledger, at)).toEqual([]);
  });
});
