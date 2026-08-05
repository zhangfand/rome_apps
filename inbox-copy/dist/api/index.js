class InboxApiHandler {
    ctx;
    constructor(ctx){
        this.ctx = ctx;
    }
    async handle(request) {
        const route = request.path.join("/");
        if ("GET" === request.method && 0 === request.path.length) return Response.json({
            appId: this.ctx.app.id,
            version: this.ctx.app.version,
            status: "ok"
        });
        if ("GET" === request.method && "inbox" === route) {
            const rawWindow = request.query.get("windowHours");
            const windowHours = rawWindow ? Number(rawWindow) : void 0;
            const threadId = request.query.get("threadId") ?? void 0;
            const result = await this.ctx.runAction("mailbox_read_copy", {
                ...Number.isFinite(windowHours) ? {
                    windowHours
                } : {},
                ...threadId ? {
                    threadId
                } : {}
            });
            if ("ok" !== result.status) {
                const error = "error" === result.status ? result.error : `mailbox_read_copy returned ${result.status}`;
                return Response.json({
                    error
                }, {
                    status: 502
                });
            }
            return Response.json(result.data);
        }
        return Response.json({
            error: "not_found",
            appId: this.ctx.app.id,
            message: `Unknown inbox API route: /${route}`
        }, {
            status: 404
        });
    }
}
function createApiHandler(ctx) {
    return new InboxApiHandler(ctx);
}
export { createApiHandler };

//# sourceMappingURL=index.js.map