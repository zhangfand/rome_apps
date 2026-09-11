import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { getCurrentActionContext } from "@rome-os/app-runtime";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { describeFact } from "../../lib/facts.js";
import { fold } from "../../lib/fold.js";

const HISTORY_LINES = 6;

/** The ledger as the person-facing agent sees it: enough to tell which task a person's words are about. */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: { includeClosed: { type: "boolean", description: "Include completed and cancelled tasks. Defaults to false." } },
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const includeClosed = args.includeClosed === true;
      const ledger = createLedgerRepository(appContext.db);
      if (!ledger.reachable()) return { status: "error", error: "the ledger is unreachable" };
      const snapshot = fold(new Date(), ledger.all());
      const settings = createSettingsRepository(appContext.db).get();
      const tasks = snapshot.tasks
        .filter((task) => includeClosed || task.state === "open")
        .map((task) => ({
          id: task.id,
          brief: task.brief,
          projectId: task.projectId,
          createdBy: task.createdBy,
          state: task.state,
          liveWorker: task.liveWorker?.workerId,
          latestDecision: task.lastDecision ? describeFact(task.lastDecision) : undefined,
          waiting: task.waiting,
          history: task.facts.slice(-HISTORY_LINES).map((f) => describeFact(f)),
        }));
      const context = getCurrentActionContext()?.channelContext;
      return { status: "ok", data: { tasks, projects: settings?.projects ?? {}, selectedProject: { name: context?.projectName, path: context?.projectPath } } };
    },
  };
}
