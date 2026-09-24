import { createAppLogger, defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { storeFrom } from "../../lib/action-helpers.js";
import { createAgentCaller } from "../../lib/agent.js";
import { generateReportInsight, generateTrendInsight } from "../../lib/insights.js";

const log = createAppLogger("family-health:generate_insight");

const schema = z.object({
  scope: z.enum(["report", "indicator"]),
  report_id: z.string().optional(),
  member_id: z.string().optional(),
  indicator: z.string().optional(),
  force: z.boolean().optional(),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) => {
      const store = storeFrom(deps);
      const callAgent = createAgentCaller(deps.appContext);
      try {
        const row =
          input.scope === "report"
            ? await generateReportInsight(store, input.report_id ?? "", callAgent, { force: input.force })
            : await generateTrendInsight(store, input.member_id ?? "", input.indicator ?? "", callAgent, { force: input.force });
        return row.status === "ready" ? { status: "ok", data: { id: row.id, status: row.status } } : { status: "error", error: row.error ?? "生成失败" };
      } catch (err) {
        log.error("insight generation failed", { ...input, error: (err as Error).message });
        return { status: "error", error: (err as Error).message };
      }
    },
  });
}
