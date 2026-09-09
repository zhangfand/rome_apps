import { afterEach, describe, expect, it, rs } from "@rstest/core";
import { heartbeatState, HEARTBEAT_INTERVAL_MS, HEARTBEAT_LEASE_MS, startHeartbeatTimer } from "./worker-health.js";
import type { StartedFact } from "./facts.js";

const at = new Date("2026-09-09T03:00:00Z");
const started = { kind: "Started", createdAt: at, payload: { workerId: "w1", heartbeatProtocol: 1 } } as StartedFact;
afterEach(() => rs.useRealTimers());

describe("worker heartbeat policy", () => {
  it("leaves old workers legacy and grants new starts a bounded grace", () => {
    expect(heartbeatState({ ...started, payload: { workerId: "w1", prompt: "go" } }, undefined, at).status).toBe("legacy");
    expect(heartbeatState(started, undefined, at).status).toBe("starting");
    expect(heartbeatState(started, undefined, new Date(+at + HEARTBEAT_LEASE_MS)).status).toBe("expired");
  });
  it("uses heartbeat freshness, not task or worker age", () => {
    const now = new Date(+at + 9 * 3600_000);
    expect(heartbeatState(started, { workerId: "w1", taskId: "t1", ownerId: "owner", lastHeartbeatAt: +now, expiresAt: +now + HEARTBEAT_LEASE_MS }, now).status).toBe("alive");
  });
  it("ticks without model activity and stops on cleanup", () => {
    rs.useFakeTimers();
    const renew = rs.fn(() => true);
    const stop = startHeartbeatTimer(renew, rs.fn());
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
    expect(renew).toHaveBeenCalledTimes(3);
    stop();
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);
    expect(renew).toHaveBeenCalledTimes(3);
  });
  it("does not resurrect a rejected lease", () => {
    rs.useFakeTimers();
    const renew = rs.fn(() => false);
    startHeartbeatTimer(renew, rs.fn());
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 5);
    expect(renew).toHaveBeenCalledTimes(1);
  });
  it("contains heartbeat DB errors and retries on the next interval", () => {
    rs.useFakeTimers();
    const renew = rs.fn().mockImplementationOnce(() => { throw new Error("DB unavailable"); }).mockReturnValue(true);
    const onError = rs.fn();
    const stop = startHeartbeatTimer(renew, onError);
    rs.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(renew).toHaveBeenCalledTimes(2);
    stop();
  });
});
