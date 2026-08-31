import {
  createAppLogger,
  defineAction,
  z,
  type Action,
  type ActionConfig,
  type AppActionRuntimeDeps,
} from "@rome-os/app-runtime";

const log = createAppLogger("account-growth:weekly_plan");
const schema = z.object({
  focus: z.string().trim().max(500).optional().describe("Optional theme or launch to emphasize this week"),
  sessionId: z.string().optional().describe("Optional coach session to resume"),
});

type SummonData = { result?: unknown; sessionId?: unknown };

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  return defineAction({
    config,
    schema,
    execute: async ({ focus, sessionId }) => {
      const prompt = [
        "Run the complete weekly account-growth planning workflow now.",
        "Refresh the guardian's X and LinkedIn snapshot, analyze performance, research relevant larger X accounts and specific current posts, draft exactly five original X posts with visual briefs and reply-sparking questions, draft genuine replies to specific posts, explain what to double down on, and save the completed plan with account-growth:save_plan.",
        "Do not publish, reply, like, follow, connect, or message anyone. Everything must remain a draft for guardian approval.",
        focus ? `This week's optional focus: ${focus}` : "No extra focus was supplied; choose from current evidence.",
      ].join("\n\n");

      const result = await deps.appContext.runAction("system:summon", {
        agentName: "account-growth:coach",
        prompt,
        sessionId,
      });
      if (result.status !== "ok") return result;
      const data = result.data as SummonData;
      if (typeof data?.result !== "string") {
        log.error("summon returned no result", { data });
        return { status: "error", error: "Coach did not return a completed plan" };
      }
      return {
        status: "ok",
        data: {
          plan: data.result,
          sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
        },
      };
    },
  });
}
