import { describe, expect, it } from "@rstest/core";
import { RUNTIME } from "./facts.js";
import { LedgerBuilder } from "./test-facts.js";
import { buildView, workersOf } from "./view.js";

const ANN = "ann";

function ledger() {
  return (
    new LedgerBuilder()
      // t1: taken, worker w1 returned, worker w2 running
      .add({ taskId: "t1", kind: "Created", by: ANN, source: "do a", payload: { brief: "do a" } })
      .add({ taskId: "t1", kind: "Taken", by: RUNTIME, payload: {} })
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w1", prompt: "p" } })
      .add({ taskId: "t1", kind: "Returned", by: "w1", payload: { workerId: "w1", reply: "BLOCKED: no" } }, 10)
      .add({ taskId: "t1", kind: "Started", by: RUNTIME, payload: { workerId: "w2", prompt: "p" } })
      // t2: stuck on a question
      .add({ taskId: "t2", kind: "Created", by: ANN, source: "do b", payload: { brief: "do b" } })
      .add({ taskId: "t2", kind: "Taken", by: RUNTIME, payload: {} })
      .add({ taskId: "t2", kind: "Started", by: RUNTIME, payload: { workerId: "w3", prompt: "p" } })
      .add({ taskId: "t2", kind: "Failed", by: "w3", payload: { workerId: "w3", error: "boom" } })
      .add({ taskId: "t2", kind: "Question", by: RUNTIME, payload: { why: "which db?" } })
      // t3: completed
      .add({ taskId: "t3", kind: "Created", by: ANN, source: "do c", payload: { brief: "do c" } })
      .add({ taskId: "t3", kind: "Completed", by: ANN, source: "done", payload: {} })
  );
}

describe("workersOf", () => {
  it("names every Started and closes only the one its terminal fact names", () => {
    const b = ledger();
    const workers = workersOf("t1", "do a", b.facts.filter((f) => f.taskId === "t1"), b.now());
    expect(workers.map((w) => [w.workerId, w.status])).toEqual([
      ["w1", "returned"],
      ["w2", "running"],
    ]);
    expect(workers[0].outcome).toBe("BLOCKED: no");
    expect(workers[0].ageMs).toBe(10 * 60_000);
    expect(workers[1].endedAt).toBeUndefined();
    expect(workers[1].ageMs).toBeGreaterThan(0);
  });
});

describe("buildView", () => {
  it("folds counts, positions, attention, and the lock from the ledger", () => {
    const b = ledger();
    const now = b.now();
    const view = buildView({
      now,
      facts: b.facts,
      config: undefined,
      lock: { name: "reconcile", heldUntil: now.getTime() + 1000 },
    });

    expect(view.configured).toBe(false);
    expect(view.lock.held).toBe(true);
    expect(view.counts.tasks).toEqual({ created: 0, taken: 2, completed: 1, cancelled: 0 });
    expect(view.counts.positions).toEqual({ working: 1, stuck: 1, reported: 0 });
    expect(view.counts.workers).toEqual({ running: 1, returned: 1, failed: 1, lost: 0 });
    expect(view.counts.facts).toBe(b.facts.length);

    const t2 = view.tasks.find((t) => t.id === "t2");
    expect(t2?.attention).toEqual({ kind: "Question", text: "which db?" });
    const t1 = view.tasks.find((t) => t.id === "t1");
    expect(t1?.attention).toBeUndefined();
    expect(t1?.liveWorkerId).toBe("w2");

    // Newest first, JSON-ready dates.
    expect(view.ledger[0].seq).toBe(b.facts.length);
    expect(typeof view.ledger[0].createdAt).toBe("string");
    expect(view.workers.map((w) => w.workerId)).toEqual(["w3", "w2", "w1"]);
  });

  it("reports an expired lock as free", () => {
    const b = ledger();
    const now = b.now();
    const view = buildView({
      now,
      facts: b.facts,
      config: undefined,
      lock: { name: "reconcile", heldUntil: now.getTime() - 1 },
    });
    expect(view.lock.held).toBe(false);
    expect(view.lock.heldUntil).toBeUndefined();
  });
});
