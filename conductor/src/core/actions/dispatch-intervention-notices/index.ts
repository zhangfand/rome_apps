import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps, TalkRouter } from "@rome-os/app-runtime";
import { dispatchInterventionNotices } from "../../lib/intervention-notices.js";

/** Internal dispatcher. It is intentionally absent from every agent allow-list. */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps<{ talkRouter: TalkRouter }>): Action {
  return {
    config,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async execute(): Promise<ActionResult> {
      return { status: "ok", data: await dispatchInterventionNotices(deps.appContext, deps.talkRouter) };
    },
  };
}
