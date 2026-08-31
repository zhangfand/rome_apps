import { createAppLogger, defineAction, z } from "@rome-os/app-runtime";
const log = createAppLogger("account-growth:weekly_plan");
const schema = z.object({
    focus: z.string().trim().max(500).optional().describe("Optional theme or launch to emphasize this week"),
    sessionId: z.string().optional().describe("Optional coach session to resume")
});
function createAction(config, deps) {
    return defineAction({
        config,
        schema: schema,
        execute: async ({ focus, sessionId })=>{
            const prompt = [
                "Run the complete weekly account-growth planning workflow now.",
                "Refresh the guardian's X and LinkedIn snapshot, analyze performance, research relevant larger X accounts and specific current posts, draft exactly five original X posts with visual briefs and reply-sparking questions, draft genuine replies to specific posts, explain what to double down on, and save the completed plan with account-growth:save_plan.",
                "Do not publish, reply, like, follow, connect, or message anyone. Everything must remain a draft for guardian approval.",
                focus ? `This week's optional focus: ${focus}` : "No extra focus was supplied; choose from current evidence."
            ].join("\n\n");
            const result = await deps.appContext.runAction("system:summon", {
                agentName: "account-growth:coach",
                prompt,
                sessionId
            });
            if ("ok" !== result.status) return result;
            const data = result.data;
            if ("string" != typeof data?.result) {
                log.error("summon returned no result", {
                    data
                });
                return {
                    status: "error",
                    error: "Coach did not return a completed plan"
                };
            }
            return {
                status: "ok",
                data: {
                    plan: data.result,
                    sessionId: "string" == typeof data.sessionId ? data.sessionId : void 0
                }
            };
        }
    });
}
export { createAction };

//# sourceMappingURL=index.js.map