import { describe, expect, it } from "@rstest/core";
import { phraseTime, spoken, wordCount, WORDS_PER_SECOND, type Alignment } from "./timing.js";
import { END, type Beat } from "./types.js";

const BEAT: Beat = {
  id: "hook",
  line: "This is People. Everyone who has said something.",
  cues: [],
};

describe("spoken", () => {
  it("uses the clip's length when there is one", () => {
    expect(spoken(BEAT, { hook: 6.25 })).toBe(6.25);
  });

  it("estimates from the word count without a clip", () => {
    expect(spoken(BEAT, null)).toBe(wordCount(BEAT.line) / WORDS_PER_SECOND);
  });

  it("estimates for a beat the clips do not cover", () => {
    expect(spoken(BEAT, { other: 3 })).toBe(wordCount(BEAT.line) / WORDS_PER_SECOND);
  });
});

describe("phraseTime", () => {
  it("puts END at the end of the line", () => {
    expect(phraseTime(BEAT, END, { clips: { hook: 8 } })).toBe(8);
  });

  it("scales the phrase's offset to the clip's length without an alignment", () => {
    const at = phraseTime(BEAT, "Everyone", { clips: { hook: 10 } });
    expect(at).toBeCloseTo((BEAT.line.indexOf("Everyone") / BEAT.line.length) * 10, 6);
  });

  it("reads the start of the phrase's first character from an alignment", () => {
    const index = BEAT.line.indexOf("Everyone");
    const alignment: Alignment = {
      characters: [...BEAT.line],
      character_start_times_seconds: [...BEAT.line].map((_, i) => i * 0.1),
    };
    expect(phraseTime(BEAT, "Everyone", { alignments: { hook: alignment } })).toBeCloseTo(
      index * 0.1,
      6,
    );
  });

  it("falls back to the estimate when the alignment is short of the phrase", () => {
    const alignment: Alignment = { characters: [...BEAT.line], character_start_times_seconds: [0] };
    const at = phraseTime(BEAT, "Everyone", {
      clips: { hook: 10 },
      alignments: { hook: alignment },
    });
    expect(at).toBeCloseTo((BEAT.line.indexOf("Everyone") / BEAT.line.length) * 10, 6);
  });

  it("throws when the phrase is not in the line", () => {
    expect(() => phraseTime(BEAT, "Nobody", {})).toThrow('is not in the line of beat "hook"');
  });
});
