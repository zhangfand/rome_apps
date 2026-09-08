import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createRunsRepository } from "../../db/repositories/runs.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Id of the run to read." },
      },
      required: ["runId"],
      additionalProperties: false,
    },
    async execute(input: Record<string, unknown>): Promise<ActionResult> {
      const runId = input.runId;
      if (typeof runId !== "string" || !runId) {
        return { status: "error", error: "A run id is required." };
      }
      const run = await createRunsRepository(appContext.db).byId(runId);
      if (!run) return { status: "error", error: `No run with id "${runId}".` };
      return {
        status: "ok",
        data: {
          id: run.id,
          playscriptId: run.playscriptId,
          status: run.status,
          dir: run.dir,
          report: run.report,
          files: run.files,
          error: run.error,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        },
      };
    },
  };
}
