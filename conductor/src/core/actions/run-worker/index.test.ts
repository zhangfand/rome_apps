import { describe, expect, it } from "@rstest/core";
import { readSummonOutput } from "./index.js";

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
