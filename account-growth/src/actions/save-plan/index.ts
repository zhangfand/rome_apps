import {
  defineAction,
  z,
  type Action,
  type ActionConfig,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createPlansRepository } from "../../db/repositories/plans.js";

const savePlanSchema = z.object({
  title: z.string().trim().min(1).max(160),
  markdown: z.string().trim().min(200).describe("Complete weekly plan in Markdown"),
  performanceSummary: z.string().trim().max(2_000).optional(),
  focus: z.string().trim().max(500).optional(),
});

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema: savePlanSchema,
    execute: async (input) => {
      const repository = createPlansRepository(deps.appContext.db);
      const saved = await repository.save(input);
      return { status: "ok", data: saved };
    },
  });
}
