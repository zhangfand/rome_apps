import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createPlansRepository } from "../db/repositories/plans.js";

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

class AccountGrowthApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");

    if (request.caller.kind !== "guardian") {
      return json({ error: "forbidden" }, { status: 403 });
    }

    if (request.method === "GET" && route === "state") {
      const repository = createPlansRepository(this.ctx.db);
      const plans = await repository.list(12);
      return json({
        appId: this.ctx.app.id,
        version: this.ctx.app.version,
        config: {
          niche: "AI agents and agent-native software, with founder and investor takes grounded in building Rome OS",
          audience: "AI builders, founders, engineers, investors, and early adopters",
          voice: "Practical and conversational",
          cadence: "5 original X posts per week",
          boundary: "Draft only — never publish",
          xAccount: "@realYunfanYe",
          linkedIn: "linkedin.com/in/yunfanye",
        },
        plans,
      });
    }

    return json(
      {
        error: "not_found",
        appId: this.ctx.app.id,
        message: `Unknown Account Growth API route: /${route}`,
      },
      { status: 404 },
    );
  }
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new AccountGrowthApiHandler(ctx);
}
