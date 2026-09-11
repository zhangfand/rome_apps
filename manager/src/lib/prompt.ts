import { latestAgreement, assessmentSubmission, type Phase, type LifecycleHook, type AssessmentContext } from "./lifecycle.js";
import type { ManagerConfig } from "./config.js";
import { describeFact } from "./facts.js";
import type { TaskView } from "./fold.js";
import { replyInstructions } from "./worker-reply.js";

/**
 * The brief a worker is launched with. A fresh worker gets the task's whole
 * history, because it reads nothing else: a retry learns what failed, and a
 * steered worker learns what the person said, from the same lines. A worker
 * that resumes an earlier worker's session already holds that history, so it
 * gets only the delta — the facts since the resumed worker started, and why —
 * because repeating the rest would undo the cache the resume is for. The brief
 * is stored on the Started fact, so the ledger records the exact words a
 * worker was given.
 */
export function buildWorkerPrompt(input: {
  task: TaskView;
  config: ManagerConfig;
  phase?: Phase;
  hook?: LifecycleHook;
  assessment?: AssessmentContext;
  /** What made the runtime start this worker, when it is not the first one. */
  reason?: string;
  /** The session this worker continues, when it does not start fresh. */
  resume?: { workerId: string; sessionId: string };
}): string {
  const { task, config, reason, resume, phase = "work", hook, assessment } = input;

  const lines = resume ? resumedHeader(task, resume) : freshHeader(task, config);

  if (reason) {
    lines.push("", `Why you were started: ${reason}`);
  }

  const agreement = latestAgreement(task);
  if (agreement) lines.push("", `Recorded agreement #${agreement.seq} (the original request and subsequent human constraints still apply):`, JSON.stringify(agreement.payload));
  if (phase !== "work") {
    lines.push("", `Your assigned role: ${phase}. This is not an implementation run.`, "User-defined instructions:", hook?.instructions ?? "");
    lines.push("Internal submission, report, and agreement numbers are Manager ledger sequence numbers, NOT external resource identifiers. Resolve external resources only from explicit addresses or verified bindings; never substitute a ledger number.");
    if (phase === "evaluate") lines.push("The pinned submission identifies the delivery being assessed; it does not exclude subsequent evidence or replacement deliveries when the recorded agreement explicitly requires considering them. Apply its supersession rules. Distinguish delivery acceptance from the separately recorded completion condition; do not silently turn final completion into a delivery prerequisite. If these requirements conflict, ask for clarification rather than inventing scope or repeating already satisfied work.");
    if (phase === "prepare" && assessment) {
      lines.push("", `This is explicitly requested backfill for existing submission #${assessment.submissionSeq}. Prepare criteria from the original request, not from what the worker happened to deliver. The next phase assesses the existing delivery, not a fresh implementation. Account for subsequent user instructions and avoid duplicating or undoing work already satisfied by later changes.`, JSON.stringify(assessmentSubmission(task, assessment)?.payload));
    }
    if (phase === "completion") {
      const report = task.facts.find((f) => f.kind === "Report" && f.seq === assessment?.reportSeq);
      lines.push("", `Check final completion for Manager report ledger sequence ${assessment?.reportSeq}, agreement ledger sequence ${assessment?.agreementSeq ?? "original request"}.`, JSON.stringify(report?.payload),
        "Do not accept resource links in a report as proof of task association or completion. Verify the actual deliverable, required approver and specific version. Treat a mere mention of another completed resource as context, not fulfillment. Report summaries are evidence pointers, not authority. Human replies in this task may supply approval or changed requirements; do not treat test requests or policy setup as sign-off.");
    }
    if (phase === "evaluate") {
      const submission = assessmentSubmission(task, assessment);
      lines.push("", `Evaluate ONLY submission #${assessment?.submissionSeq} against agreement #${assessment?.agreementSeq ?? "original request"}.`, JSON.stringify(submission?.payload));
    }
  }
  lines.push("", replyInstructions(phase));

  return lines.join("\n");
}

function freshHeader(task: TaskView, config: ManagerConfig): string[] {
  return [
    `You are working on task ${task.id}.`,
    "",
    ...(task.projectId ? [`Project: ${task.projectId}`, ...(task.project?.repo ? [`Repository: ${task.project.repo}`] : [])] : []),
    `Working directory: ${task.project?.workingDir ?? config.workingDir}`,
    "Start by moving there; every path below is relative to it.",
    "",
    "What was asked for:",
    task.brief,
    "",
    "The task's history, oldest first. This is everything anyone recorded about",
    "it, including earlier attempts and what the person said:",
    ...task.facts.map((fact) => `  ${describeFact(fact)}`),
  ];
}

function resumedHeader(task: TaskView, resume: { workerId: string; sessionId: string }): string[] {
  const startedSeq = task.facts.find(
    (fact) => fact.kind === "Started" && fact.payload.workerId === resume.workerId,
  )?.seq;
  const since = startedSeq === undefined ? [] : task.facts.filter((fact) => fact.seq > startedSeq);
  return [
    `You are continuing task ${task.id} in the session you already have — you were`,
    `worker ${resume.workerId} in it. Everything you learned and did there still holds.`,
    "",
    "What was recorded since you started that run, oldest first:",
    ...since.map((fact) => `  ${describeFact(fact)}`),
  ];
}
