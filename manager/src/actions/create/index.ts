import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { writePersonFact } from "../../lib/person-fact.js";
import { getCurrentActionContext } from "@rome-os/app-runtime";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { createLockRepository, RECONCILE_LOCK } from "../../db/repositories/lock.js";
import { resolveHumanProject } from "../../lib/projects.js";

/** Opens a task with a Created fact. The only way a task comes into being. */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;

  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Target configured project. Explicit choice wins over selected chat project. Required if the target is ambiguous; ask rather than guess." },
        brief: {
          type: "string",
          description: "What the task is, in a sentence or two. This becomes the worker's brief.",
        },
        source: {
          type: "string",
          description: "The person's message, verbatim. Recorded as the fact's citation.",
        },
      },
      required: ["brief", "source"],
      additionalProperties: false,
    },

    async execute(args): Promise<ActionResult> {
      const brief = String(args.brief ?? "").trim();
      const source = String(args.source ?? "").trim();
      if (!brief) return { status: "error", error: "brief is required" };
      if (!source) {
        return {
          status: "error",
          error: "source is required: pass the person's message verbatim",
        };
      }

      const taskId = `t-${crypto.randomUUID().slice(0, 8)}`;
      const locks = createLockRepository(appContext.db);
      if (!locks.tryAcquire(RECONCILE_LOCK, 5 * 60_000)) return { status: "error", error: "Manager is reconciling or being configured; retry shortly. No task was created." };
      let result: ActionResult;
      try {
        const settings = createSettingsRepository(appContext.db).get();
        if (!settings) return { status: "error", error: "Run manager:setup before creating a task." };
        const context = getCurrentActionContext()?.channelContext;
        const binding = resolveHumanProject(settings, {
          projectId: typeof args.projectId === "string" ? args.projectId.trim() : undefined,
          projectPath: context?.projectPath, projectName: context?.projectName,
        });
        result = await writePersonFact(appContext, { taskId, kind: "Created", source, payload: { brief, ...binding } }, false);
      } catch (error) {
        return { status: "error", error: error instanceof Error ? error.message : String(error) };
      } finally { locks.release(RECONCILE_LOCK); }
      if (result.status === "ok") await appContext.runAction("manager:reconcile", {});
      return result;
    },
  };
}
