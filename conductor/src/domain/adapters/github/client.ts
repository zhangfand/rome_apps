import type { RomeAppContext } from "@rome-os/app-runtime";

/** The small part of a runtime context needed for authenticated GitHub reads. */
export interface GitHubReadContext {
  runAction: RomeAppContext["runAction"];
  log: { warn(message: string, meta?: Record<string, unknown>): void };
}

/**
 * One GitHub GET through the shared connector. A failure is deliberately local:
 * callers get `undefined` and the runtime log keeps the diagnostic.
 */
export async function githubGet(
  ctx: GitHubReadContext,
  path: string,
  meta: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await ctx.runAction("connector:connector_proxy", {
    toolkit: "github",
    path,
    method: "GET",
  }).catch((error: unknown) => ({
    status: "error" as const,
    error: error instanceof Error ? error.message : String(error),
  }));
  if (result.status !== "ok") {
    ctx.log.warn("github read failed", {
      ...meta,
      path,
      reason: result.status === "error" ? result.error : result.status,
    });
    return undefined;
  }
  return (result.data as { data?: unknown } | undefined)?.data;
}
