import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createFrontdeskShadowRepository } from "../../db/repositories/frontdesk-shadow.js";
import {
  DEFAULT_FRONTDESK_SHADOW_LIMIT,
  frontdeskShadowLimit,
  frontdeskShadowReport,
  MAX_FRONTDESK_SHADOW_LIMIT,
} from "../../frontdesk/report.js";

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: `Newest shadow runs to return (1-${MAX_FRONTDESK_SHADOW_LIMIT}).` },
      },
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const limit = frontdeskShadowLimit(args.limit ?? DEFAULT_FRONTDESK_SHADOW_LIMIT);
      const rows = createFrontdeskShadowRepository(appContext.db).recent(limit);
      return {
        status: "ok",
        data: frontdeskShadowReport(rows),
      };
    },
  };
}
