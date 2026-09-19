import { describe, expect, it } from "@rstest/core";
import { replySubmissionBody } from "./reply-submission.js";

describe("Board reply submission intent", () => {
  it("omits Asked association for an ordinary steering reply", () => {
    expect(replySubmissionBody("Also update the README.", { kind: "reply" })).toEqual({
      text: "Also update the README.",
    });
  });

  it("includes the exact Asked seq only for the explicit answer path", () => {
    expect(replySubmissionBody("Option A", { kind: "answer", askedSeq: 42 })).toEqual({
      text: "Option A",
      resolvesAskedSeq: 42,
    });
  });
});
