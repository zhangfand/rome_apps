import { defineAction, z, type Action, type ActionConfig, type AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { run, storeFrom } from "../../lib/action-helpers.js";
import { clearDemoData, seedDemoData } from "../../lib/seed.js";

const schema = z.object({
  clear_only: z.boolean().optional().describe("true 时只清空演示数据"),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async (input) =>
      run(deps, () => {
        const store = storeFrom(deps);
        if (input.clear_only) return { cleared: clearDemoData(store) };
        return { seeded: seedDemoData(store), link: "/apps/family-health" };
      }),
  });
}
