import { describe, expect, it } from "@rstest/core";
import { JEV_API_KEY_LABEL, JEV_API_KEY_NAME, readJevApiKey, saveJevApiKey } from "./app-keys.js";

describe("Jev app-key client", () => {
  it("reads value-free metadata for the Jev key", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ keys: [
      { name: "OTHER_KEY", label: "Other", updatedAt: "2026-09-21T00:00:00.000Z", overridden: false },
      { name: JEV_API_KEY_NAME, label: JEV_API_KEY_LABEL, updatedAt: "2026-09-21T01:00:00.000Z", overridden: true },
    ] }), { status: 200, headers: { "content-type": "application/json" } });

    await expect(readJevApiKey(fetchImpl as typeof fetch)).resolves.toEqual({
      name: JEV_API_KEY_NAME,
      label: JEV_API_KEY_LABEL,
      updatedAt: "2026-09-21T01:00:00.000Z",
      overridden: true,
    });
  });

  it("writes the key through Rome's app-key endpoint without putting it in the URL", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), init };
      return new Response(JSON.stringify({ ok: true, overridden: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await expect(saveJevApiKey("fake-test-key", fetchImpl as typeof fetch)).resolves.toEqual({ overridden: false });
    expect(request?.url).toBe(`/api/app-keys/${JEV_API_KEY_NAME}`);
    expect(request?.url).not.toContain("fake-test-key");
    expect(request?.init).toMatchObject({
      method: "PUT",
      credentials: "include",
      body: JSON.stringify({ label: JEV_API_KEY_LABEL, value: "fake-test-key" }),
    });
  });

  it("surfaces the server's validation error", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ error: "Value is required." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
    await expect(saveJevApiKey("", fetchImpl as typeof fetch)).rejects.toThrow("Value is required.");
  });
});
