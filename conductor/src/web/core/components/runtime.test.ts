import { describe, expect, it } from "@rstest/core";
import type { ConfigJson } from "../lib/types.js";
import { limitsDraft, parseLimitsDraft } from "./runtime-settings.js";

const config: ConfigJson = {
  projects: {},
  workerAgents: {},
  orchestratorAgent: "conductor:engineer-lead",
  maxWorkers: 3,
  intervalMinutes: 5,
  reuseSessions: true,
  maxDecisionsPerTurn: 25,
  heartbeatLeaseMinutes: 3,
};

describe("Runtime limit editor", () => {
  it("round-trips every editable limit into one configuration patch", () => {
    const draft = limitsDraft(config);
    expect(parseLimitsDraft({
      ...draft,
      orchestratorAgent: " custom:lead ",
      maxWorkers: "4",
      intervalMinutes: "10",
      reuseSessions: false,
      maxDecisionsPerTurn: "30",
      heartbeatLeaseMinutes: "6",
    })).toEqual({
      ok: true,
      patch: {
        orchestratorAgent: "custom:lead",
        maxWorkers: 4,
        intervalMinutes: 10,
        reuseSessions: false,
        maxDecisionsPerTurn: 30,
        heartbeatLeaseMinutes: 6,
      },
    });
  });

  it("rejects blank coordinators and out-of-range values before saving", () => {
    expect(parseLimitsDraft({ ...limitsDraft(config), orchestratorAgent: " " })).toEqual({ ok: false, error: "Coordinator is required." });
    expect(parseLimitsDraft({ ...limitsDraft(config), heartbeatLeaseMinutes: "0" })).toEqual({
      ok: false,
      error: "Heartbeat lease must be a whole number from 1 to 1440.",
    });
  });
});
