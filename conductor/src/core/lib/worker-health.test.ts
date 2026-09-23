import { describe, expect, it } from "@rstest/core";
import type { DispatchedFact } from "./facts.js";
import { heartbeatState } from "./worker-health.js";

const dispatched = {
  taskId: "t-1",
  kind: "Dispatched",
  createdAt: new Date("2026-09-23T00:00:00Z"),
  payload: { workerId: "w-1" },
} as DispatchedFact;

describe("worker heartbeat lease", () => {
  it("uses the configured lease for startup and live heartbeat deadlines", () => {
    const twoMinutes = 2 * 60_000;
    expect(heartbeatState(dispatched, undefined, new Date("2026-09-23T00:01:59Z"), twoMinutes).status).toBe("starting");
    expect(heartbeatState(dispatched, undefined, new Date("2026-09-23T00:02:00Z"), twoMinutes).status).toBe("expired");

    const heartbeat = {
      taskId: "t-1", workerId: "w-1", ownerId: "owner",
      lastHeartbeatAt: Date.parse("2026-09-23T00:05:00Z"),
      expiresAt: Date.parse("2026-09-23T01:00:00Z"),
    };
    const state = heartbeatState(dispatched, heartbeat, new Date("2026-09-23T00:07:00Z"), twoMinutes);
    expect(state.status).toBe("expired");
    expect(state.expiresAt).toBe("2026-09-23T00:07:00.000Z");
  });
});
