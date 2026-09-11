import { describe, expect, it } from "@rstest/core";
import { REFRESH_FAILURE_GRACE_MS, refreshWarning, updateRefreshFailure } from "./refresh-health";

describe("dashboard refresh health", () => {
  it("stays silent when healthy or after a single failure, even after a long absence", () => {
    expect(refreshWarning(null, 999_999)).toBeUndefined();
    const first = updateRefreshFailure(null, "Offline", 0);
    expect(refreshWarning(first, 999_999)).toBeUndefined();
  });
  it("warns only after repeated failures persist for three minutes", () => {
    const first = updateRefreshFailure(null, "Offline", 1_000);
    const repeated = updateRefreshFailure(first, "HTTP 503", 16_000);
    expect(repeated).toEqual({ since: 1_000, attempts: 2, message: "HTTP 503" });
    expect(refreshWarning(repeated, 1_000 + REFRESH_FAILURE_GRACE_MS - 1)).toBeUndefined();
    expect(refreshWarning(repeated, 1_000 + REFRESH_FAILURE_GRACE_MS)).toContain("3 minutes");
  });
  it("clears on success and starts a fresh grace period for the next outage", () => {
    const failure = { since: 0, attempts: 20, message: "Offline" };
    expect(refreshWarning(failure, REFRESH_FAILURE_GRACE_MS)).toBeDefined();
    const recovered = updateRefreshFailure(failure, null, REFRESH_FAILURE_GRACE_MS);
    expect(recovered).toBeNull();
    expect(refreshWarning(recovered, REFRESH_FAILURE_GRACE_MS)).toBeUndefined();
    const next = updateRefreshFailure(recovered, "Offline again", 500_000);
    expect(next).toEqual({ since: 500_000, attempts: 1, message: "Offline again" });
    expect(refreshWarning(next, 500_000)).toBeUndefined();
  });
});
