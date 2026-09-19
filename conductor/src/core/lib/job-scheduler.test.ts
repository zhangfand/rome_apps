import { describe, expect, it } from "@rstest/core";
import type { Fact, NewFact } from "./facts.js";
import { foldTask } from "./fold.js";
import { reusableWorkerForAgent } from "./job-scheduler.js";

let seq = 0;
function fact(value: NewFact): Fact {
  return { ...value, seq: ++seq, id: `f-${seq}`, createdAt: new Date(seq * 1000) } as Fact;
}

describe("Job scheduler session selection", () => {
  it("reuses the newest cleanly returned session for the same logical agent", () => {
    const taskId = "t-1";
    const task = foldTask([
      fact({ taskId, kind: "Created", by: "person", payload: { brief: "ship it" } }),
      fact({ taskId, kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "one", prompt: "one" } }),
      fact({ taskId, kind: "Returned", by: "w-1", payload: { jobId: "j-1", workerId: "w-1", status: "succeeded", summary: "one", sessionId: "s-1" } }),
      fact({ taskId, kind: "Dispatched", by: "runtime", payload: { jobId: "j-2", workerId: "w-2", agent: "assistant:assistant", instructions: "two", prompt: "two" } }),
      fact({ taskId, kind: "Returned", by: "w-2", payload: { jobId: "j-2", workerId: "w-2", status: "succeeded", summary: "two", sessionId: "s-2" } }),
    ]);

    expect(reusableWorkerForAgent(task, "coding:coding")).toBe("w-1");
    expect(reusableWorkerForAgent(task, "assistant:assistant")).toBe("w-2");
    expect(reusableWorkerForAgent(task, "conductor:pm")).toBeUndefined();
  });

  it("does not reuse a failed or lost run", () => {
    const taskId = "t-2";
    const task = foldTask([
      fact({ taskId, kind: "Created", by: "person", payload: { brief: "ship it" } }),
      fact({ taskId, kind: "Dispatched", by: "runtime", payload: { jobId: "j-1", workerId: "w-1", agent: "coding:coding", instructions: "one", prompt: "one" } }),
      fact({ taskId, kind: "Failed", by: "w-1", payload: { jobId: "j-1", workerId: "w-1", error: "boom", sessionId: "s-1" } }),
    ]);

    expect(reusableWorkerForAgent(task, "coding:coding")).toBeUndefined();
  });
});
