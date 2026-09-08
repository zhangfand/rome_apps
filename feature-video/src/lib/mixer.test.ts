import { describe, expect, it } from "@rstest/core";
import { buildSrt, srtTime } from "./mixer.js";
import type { CueRecord } from "./types.js";

function cue(id: string, at: number, line: string): CueRecord {
  return { id, at, line, gestures: [] };
}

const CUES: CueRecord[] = [
  cue("hook", 1000, "This is People."),
  cue("second", 6000, "One person, one history."),
];

describe("srtTime", () => {
  it("formats milliseconds as hours, minutes, seconds and thousandths", () => {
    expect(srtTime(0)).toBe("00:00:00,000");
    expect(srtTime(3_723_456)).toBe("01:02:03,456");
  });

  it("clamps a negative time to zero", () => {
    expect(srtTime(-5)).toBe("00:00:00,000");
  });
});

describe("buildSrt", () => {
  it("numbers the entries and runs each for its clip's length", () => {
    const srt = buildSrt(CUES, { hook: 3, second: 4 });
    expect(srt).toBe(
      "1\n00:00:01,000 --> 00:00:04,000\nThis is People.\n\n" +
        "2\n00:00:06,000 --> 00:00:10,000\nOne person, one history.\n",
    );
  });

  it("estimates the length from the line when there are no clips", () => {
    const srt = buildSrt([cue("hook", 0, "One two three four five")], null);
    expect(srt).toContain("00:00:00,000 --> 00:00:02,000");
  });

  it("cuts an entry short so it does not overlap the next cue", () => {
    const srt = buildSrt(CUES, { hook: 30, second: 1 });
    expect(srt).toContain("00:00:01,000 --> 00:00:05,960");
  });

  it("keeps a short entry on screen long enough to read", () => {
    const srt = buildSrt([cue("a", 0, "Hi")], { a: 0.01 });
    expect(srt).toContain("00:00:00,000 --> 00:00:00,500");
  });

  it("gives up the minimum length rather than overlap a cue that comes sooner", () => {
    const srt = buildSrt([cue("a", 0, "Hi"), cue("b", 200, "There")], { a: 0.01, b: 0.01 });
    expect(srt).toContain("00:00:00,000 --> 00:00:00,160");
    expect(srt).toContain("00:00:00,200 --> 00:00:00,700");
  });

  it("is empty for a run with no cues", () => {
    expect(buildSrt([], null)).toBe("");
  });
});
