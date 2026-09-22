import type { TaskView } from "../../../core/lib/fold.js";
import type { PushEventRequest } from "../../../core/lib/ingest.js";
import { persistJsonArtifacts, type PersistJsonArtifacts } from "../../work-repo-artifacts.js";
import { workRepoFor } from "../../work-repo.js";
import type { PullEventPlan } from "./pulls.js";

type Log = { warn(message: string, meta?: Record<string, unknown>): void };

/**
 * Persist review evidence before exposing its compact event to the ingest
 * seam. On failure, non-review observations continue but the review is left
 * unseen so the next poll retries it rather than writing a dangling reference.
 */
export async function externalizeReviewArtifacts(
  task: TaskView,
  plans: readonly PullEventPlan[],
  log: Log,
  persist: PersistJsonArtifacts = persistJsonArtifacts,
): Promise<PushEventRequest[]> {
  const drafts = plans.flatMap((plan) => plan.artifact ? [plan.artifact] : []);
  if (!drafts.length) return plans.map((plan) => plan.request);

  const workRepo = workRepoFor(task.project);
  if (!workRepo) {
    log.warn("GitHub review payload was not recorded because the task has no agent work repository", { taskId: task.id });
    return plans.filter((plan) => !plan.artifact).map((plan) => plan.request);
  }

  let refs;
  try {
    refs = await persist(workRepo, drafts, `conductor: archive GitHub review evidence for ${task.id}`);
  } catch (error) {
    log.warn("GitHub review payload could not be committed to the agent work repository", {
      taskId: task.id,
      workRepo: workRepo.repo,
      error: shortError(error),
    });
    return plans.filter((plan) => !plan.artifact).map((plan) => plan.request);
  }

  return plans.flatMap((plan) => {
    if (!plan.artifact) return [plan.request];
    const artifact = refs.get(plan.artifact.path);
    if (!artifact) return [];
    return [{ ...plan.request, data: { ...(plan.request.data ?? {}), artifact } }];
  });
}

function shortError(error: unknown): string {
  const raw = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
    ? error.stderr
    : error instanceof Error ? error.message : String(error);
  return raw.trim().split("\n").slice(-6).join("\n").slice(-2_000);
}
