import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";

class InboxApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");

    if (request.method === "GET" && request.path.length === 0) {
      return Response.json({ appId: this.ctx.app.id, version: this.ctx.app.version, status: "ok" });
    }

    // GET inbox?windowHours=720&threadId=... — reads the Rome mailbox, grouped
    // into threads. Shaping lives in the mailbox_read_copy action so the agent and
    // this UI share one code path.
    if (request.method === "GET" && route === "inbox") {
      const rawWindow = request.query.get("windowHours");
      const windowHours = rawWindow ? Number(rawWindow) : undefined;
      const threadId = request.query.get("threadId") ?? undefined;

      const result = await this.ctx.runAction("mailbox_read_copy", {
        ...(Number.isFinite(windowHours) ? { windowHours } : {}),
        ...(threadId ? { threadId } : {}),
      });

      if (result.status !== "ok") {
        const error =
          result.status === "error" ? result.error : `mailbox_read_copy returned ${result.status}`;
        return Response.json({ error }, { status: 502 });
      }
      return Response.json(result.data);
    }

    return Response.json(
      {
        error: "not_found",
        appId: this.ctx.app.id,
        message: `Unknown inbox API route: /${route}`,
      },
      { status: 404 },
    );
  }
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new InboxApiHandler(ctx);
}
