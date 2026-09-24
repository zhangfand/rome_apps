import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { logIntervention, publicIntervention } from "../../lib/service.js";

const schema = z.object({
  member: z.string().describe("成员姓名、id 或称呼（我/老婆/爸爸…）"),
  title: z.string().describe("干预名称，如 每周3次快走"),
  category: z.string().optional().describe("饮食/运动/药物/睡眠/体重管理/其他"),
  description: z.string().optional(),
  start_date: z.string().optional().describe("YYYY-MM-DD，省略为今天"),
  end_date: z.string().optional().describe("YYYY-MM-DD，进行中则省略"),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) =>
      run(deps, () => {
        const { member, intervention } = logIntervention(storeFrom(deps), {
          member: input.member,
          title: input.title,
          category: input.category,
          description: input.description,
          startDate: input.start_date,
          endDate: input.end_date ?? null,
          createdVia: "chat",
        });
        return { member: { id: member.id, name: member.name, relation: member.relation }, intervention: publicIntervention(intervention) };
      }),
  });
}
