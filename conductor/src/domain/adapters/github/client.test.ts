import { describe, expect, it } from "@rstest/core";
import type { RomeAppContext } from "@rome-os/app-runtime";
import { githubGet, type GitHubReadContext } from "./client.js";

describe("shared GitHub client", () => {
  it("warns and returns undefined when the connector read fails", async () => {
    const warnings: Array<{ message: string; meta?: Record<string, unknown> }> = [];
    const ctx = {
      runAction: async () => ({ status: "error" as const, error: "not connected" }),
      log: { warn: (message: string, meta?: Record<string, unknown>) => warnings.push({ message, meta }) },
    } as unknown as GitHubReadContext;

    await expect(githubGet(ctx, "/repos/acme/widgets/pulls/12", { pull: "pr-12" })).resolves.toBeUndefined();
    expect(warnings).toEqual([{
      message: "github read failed",
      meta: { pull: "pr-12", path: "/repos/acme/widgets/pulls/12", reason: "not connected" },
    }]);
  });

  it("unwraps successful connector data", async () => {
    const ctx = {
      runAction: async () => ({ status: "ok" as const, data: { data: { title: "Ready" } } }),
      log: { warn: () => undefined },
    } as unknown as Pick<RomeAppContext, "runAction"> & GitHubReadContext;
    await expect(githubGet(ctx, "/repos/acme/widgets/pulls/12")).resolves.toEqual({ title: "Ready" });
  });
});
