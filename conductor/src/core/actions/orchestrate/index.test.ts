import { describe, expect, it } from "@rstest/core";
import { coordinatorWakeMissedFact } from "./index.js";

describe("coordinator wake observations", () => {
  it("records a summon failure as unseen runtime evidence, not an orchestrator decision", () => {
    const fact = coordinatorWakeMissedFact("t-1", { error: "summon unavailable" });

    expect(fact).toMatchObject({
      taskId: "t-1",
      kind: "Event",
      by: "runtime",
      payload: {
        source: "runtime",
        type: "coordinator_wake_failed",
        data: { error: "summon unavailable" },
      },
    });
  });

  it("keeps a coordinator reply observable without claiming the coordinator decided", () => {
    const fact = coordinatorWakeMissedFact("t-1", { reply: "I would ask the person." });

    expect(fact).toMatchObject({
      kind: "Event",
      by: "runtime",
      payload: {
        type: "coordinator_no_decision",
        data: { reply: "I would ask the person." },
      },
    });
  });
});
