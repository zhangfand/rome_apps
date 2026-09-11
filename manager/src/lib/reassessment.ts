import type { ManagerConfig } from "./config.js";
import type { NewFact } from "./facts.js";
import type { TaskView } from "./fold.js";
import { bindProject } from "./projects.js";
import { authorizedHistoricalAssessment, startFor } from "./lifecycle.js";

/** A deliberate, auditable opt-in, not a rewrite of intake or an automatic migration. */
export function reassessmentFact(task: TaskView, reportSeq: number, config: ManagerConfig, by: string, source: string): NewFact {
  if (task.state !== "taken" || task.liveWorker || task.latest.kind !== "Report" || task.latest.seq !== reportSeq) {
    throw new Error("Task is no longer idle at the selected report; refresh before reassessing.");
  }
  if (!task.projectId || !task.project) throw new Error("Task has no durable project binding.");
  const hooks = bindProject(config, task.projectId).project.hooks;
  if (!hooks?.evaluate) throw new Error("Configure an Evaluate hook for this project first.");
  const submission = task.facts.filter((f) => f.kind === "Returned" &&
    (startFor(task, f.payload.workerId)?.payload.phase ?? "work") === "work" &&
    (!f.payload.result || f.payload.result.outcome === "ready")).at(-1);
  if (!submission || (submission.seq < task.lastPersonFactSeq && !authorizedHistoricalAssessment(task, { submissionSeq: submission.seq }))) throw new Error("Report has no current implementation submission to reassess.");
  return { taskId: task.id, kind: "Reply", by, source, payload: {
    text: `Adopt the currently configured Prepare/Evaluate instructions and reassess existing report #${reportSeq}. Preserve prior work and history. Check for later changes that already satisfy or supersede the request before proposing rework; do not undo newer work.`,
    reassessment: { hooks: structuredClone(hooks), reportSeq, submissionSeq: submission.seq },
  } };
}
