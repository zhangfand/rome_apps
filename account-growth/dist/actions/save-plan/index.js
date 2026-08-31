import { defineAction, z } from "@rome-os/app-runtime";
import { createPlansRepository } from "../../db/repositories/plans.js";
const savePlanSchema = z.object({
    title: z.string().trim().min(1).max(160),
    markdown: z.string().trim().min(200).describe("Complete weekly plan in Markdown"),
    performanceSummary: z.string().trim().max(2000).optional(),
    focus: z.string().trim().max(500).optional()
});
function createAction(config, deps) {
    return defineAction({
        config,
        schema: savePlanSchema,
        execute: async (input)=>{
            const repository = createPlansRepository(deps.appContext.db);
            const saved = await repository.save(input);
            return {
                status: "ok",
                data: saved
            };
        }
    });
}
export { createAction };

//# sourceMappingURL=index.js.map