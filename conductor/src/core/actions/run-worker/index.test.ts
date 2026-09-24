import { describe, expect, it } from "@rstest/core";
import { isResumeRejection, readSummonOutput } from "./index.js";

describe("readSummonOutput", () => {
  it("keeps both the resumable agent id and opaque Rome session ref", () => {
    expect(readSummonOutput({
      result: "done",
      sessionId: "resume-me",
      romeSession: { _romeSessionId: "accounting-session", _type: "action" },
    })).toEqual({
      reply: "done",
      sessionId: "resume-me",
      romeSession: { id: "accounting-session", type: "action" },
    });
  });
});

describe("isResumeRejection", () => {
  it("accepts only the session manager's explicit refusals", () => {
    expect(isResumeRejection('Agent session "s-1" was not found or cannot be resumed')).toBe(true);
    expect(isResumeRejection('Agent session "s-1" does not match this session key')).toBe(true);
  });

  it("treats a run that never started a session as transient, not a refusal", () => {
    expect(isResumeRejection('Summoned agent "conductor:engineer-lead" did not provide a durable Rome session')).toBe(false);
    expect(isResumeRejection("You've hit your session limit · resets 3:30am (America/Los_Angeles)")).toBe(false);
  });
});
