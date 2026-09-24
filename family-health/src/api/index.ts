import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/**
 * HTTP API for 家庭体检助手. Phase 1 only exposes a status probe; the member /
 * report / trend routes are added on top of the domain library and
 * repositories in later iterations.
 */
class FamilyHealthApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const route = request.path.join("/");

    if (request.method === "GET" && route === "status") {
      return json({ appId: this.ctx.app.id, version: this.ctx.app.version, status: "ok" });
    }

    return json({ error: "not_found", message: `未知接口：/${route}` }, { status: 404 });
  }
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new FamilyHealthApiHandler(ctx);
}
