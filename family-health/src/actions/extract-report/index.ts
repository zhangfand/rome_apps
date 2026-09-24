import { createAppLogger, defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { storeFrom } from "../../lib/action-helpers.js";
import { createAgentCaller } from "../../lib/agent.js";
import { runExtraction } from "../../lib/extraction.js";

const log = createAppLogger("family-health:extract_report");

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: z.object({ report_id: z.string() }),
    execute: async ({ report_id }) => {
      const store = storeFrom(deps);
      try {
        const out = await runExtraction(report_id, { store, callAgent: createAgentCaller(deps.appContext), log });
        return out.status === "failed" ? { status: "error", error: out.error ?? "识别失败" } : { status: "ok", data: out };
      } catch (err) {
        // Never leave a report stuck in `extracting`.
        const message = `识别过程出错：${(err as Error).message}`;
        log.error("extraction crashed", { reportId: report_id, error: (err as Error).message });
        if (store.getReport(report_id)) store.updateReport(report_id, { status: "failed", error: message });
        return { status: "error", error: message };
      }
    },
  });
}
