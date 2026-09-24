import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { endIntervention, publicIntervention } from "../../lib/service.js";

const schema = z.object({
  intervention_id: z.string().optional(),
  member: z.string().optional().describe("成员姓名、id 或称呼"),
  title: z.string().optional().describe("干预名称关键词"),
  end_date: z.string().optional().describe("YYYY-MM-DD，省略为今天"),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) =>
      run(deps, () => ({
        intervention: publicIntervention(
          endIntervention(storeFrom(deps), { interventionId: input.intervention_id, member: input.member, title: input.title, endDate: input.end_date }),
        ),
      })),
  });
}
