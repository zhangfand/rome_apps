import { describe, expect, it } from "@rstest/core";
import { workerReportMarkdown, workerReportPath } from "./worker-report-artifact.js";

describe("worker report artifact", () => {
  it("stores one run's report under the task, keyed by worker", () => {
    expect(workerReportPath("t-1", "w-2")).toBe("_conductor/tasks/t-1/reports/w-2.md");
    const markdown = workerReportMarkdown("t-1", {
      jobId: "j-1", workerId: "w-2", agent: "conductor:coder", status: "blocked",
      summary: "Two readings.", detail: { needs: "pm" }, report: "Read settings.ts.\n",
      returnedAt: new Date("2026-09-24T03:00:00Z"),
    });
    expect(markdown).toContain("jobId: j-1\nworkerId: w-2\nagent: conductor:coder\nstatus: blocked");
    expect(markdown).toContain("## Detail\n\n- needs: pm");
    expect(markdown).toContain("## Report\n\nRead settings.ts.\n");
  });
});
