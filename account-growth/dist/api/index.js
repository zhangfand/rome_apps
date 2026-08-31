import { createPlansRepository } from "../db/repositories/plans.js";
function json(data, init) {
    return Response.json(data, init);
}
class AccountGrowthApiHandler {
    ctx;
    constructor(ctx){
        this.ctx = ctx;
    }
    async handle(request) {
        const route = request.path.join("/");
        if ("guardian" !== request.caller.kind) return json({
            error: "forbidden"
        }, {
            status: 403
        });
        if ("GET" === request.method && "state" === route) {
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
                    linkedIn: "linkedin.com/in/yunfanye"
                },
                plans
            });
        }
        return json({
            error: "not_found",
            appId: this.ctx.app.id,
            message: `Unknown Account Growth API route: /${route}`
        }, {
            status: 404
        });
    }
}
function createApiHandler(ctx) {
    return new AccountGrowthApiHandler(ctx);
}
export { createApiHandler };

//# sourceMappingURL=index.js.map