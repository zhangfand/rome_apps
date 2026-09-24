import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { queryMember } from "../../lib/service.js";

const schema = z.object({
  member: z.string().describe("成员姓名、id 或称呼"),
  indicator: z.string().optional().describe("指标名称或别名"),
  from: z.string().optional().describe("起始日期 YYYY-MM-DD"),
  to: z.string().optional().describe("结束日期 YYYY-MM-DD"),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) => run(deps, () => queryMember(storeFrom(deps), input)),
  });
}
