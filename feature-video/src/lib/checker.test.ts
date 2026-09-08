import { describe, expect, it } from "@rstest/core";
import { checkPlayscript, formatPlay } from "./checker.js";
import { PEOPLE_PLAYSCRIPT } from "./people-playscript.js";
import { END, type PlayscriptDoc } from "./types.js";

/** A minimal sound document, so each case below changes exactly one thing. */
function doc(over: Partial<PlayscriptDoc> = {}): PlayscriptDoc {
  return {
    targets: { "the button": { role: "button", name: "Go" } },
    beats: [
      {
        id: "one",
        line: "Press it now.",
        cues: [{ on: "Press it", do: [["click", "the button"]] }],
      },
    ],
    ...over,
  };
}

describe("checkPlayscript", () => {
  it("passes the People playscript", () => {
    expect(checkPlayscript(PEOPLE_PLAYSCRIPT)).toEqual([]);
  });

  it("passes the minimal document", () => {
    expect(checkPlayscript(doc())).toEqual([]);
  });

  it("reports a document with no beats", () => {
    expect(checkPlayscript(doc({ beats: [] }))).toContain("the playscript has no beats");
  });

  it("reports a repeated beat id", () => {
    const beat = doc().beats[0];
    const problems = checkPlayscript(doc({ beats: [beat, { ...beat }] }));
    expect(problems).toContain('beat "one" appears twice');
  });

  it("reports a beat with no line", () => {
    const problems = checkPlayscript(
      doc({ beats: [{ id: "one", line: "  ", cues: [{ on: "x", do: [["show"]] }] }] }),
    );
    expect(problems).toContain('beat "one" has no line');
  });

  it("reports a beat with no cues", () => {
    const problems = checkPlayscript(doc({ beats: [{ id: "one", line: "Press it.", cues: [] }] }));
    expect(problems).toContain('beat "one" has no cues');
  });

  it("reports a phrase that is not in the line", () => {
    const problems = checkPlayscript(
      doc({ beats: [{ id: "one", line: "Press it.", cues: [{ on: "Pull it", do: [["show"]] }] }] }),
    );
    expect(problems).toContain('beat "one": "Pull it" is not in the line');
  });

  it("reports cues that do not follow the order of their phrases", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "First then second.",
            cues: [
              { on: "second", do: [["show"]] },
              { on: "First", do: [["show"]] },
            ],
          },
        ],
      }),
    );
    expect(problems).toContain(
      'beat "one": "First" comes before the previous cue\'s phrase in the line',
    );
  });

  it("reports END anywhere but last", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "Press it now.",
            cues: [
              { on: END, do: [["show"]] },
              { on: "now", do: [["show"]] },
            ],
          },
        ],
      }),
    );
    expect(problems).toContain('beat "one": only the last cue may be on END');
  });

  it("accepts END as the last cue", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "Press it now.",
            cues: [
              { on: "Press", do: [["show"]] },
              { on: END, do: [["show"]] },
            ],
          },
        ],
      }),
    );
    expect(problems).toEqual([]);
  });

  it("reports a cue with no gestures", () => {
    const problems = checkPlayscript(
      doc({ beats: [{ id: "one", line: "Press it.", cues: [{ on: "Press", do: [] }] }] }),
    );
    expect(problems).toContain('beat "one", on "Press": no gestures');
  });

  it("reports an unknown verb", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "Press it.",
            cues: [{ on: "Press", do: [["wiggle", "the button"] as unknown as ["show"]] }],
          },
        ],
      }),
    );
    expect(problems).toContain('beat "one", on "Press": unknown verb "wiggle"');
  });

  it("reports the wrong number of arguments", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "Press it.",
            cues: [{ on: "Press", do: [["show", "the button"] as unknown as ["show"]] }],
          },
        ],
      }),
    );
    expect(problems).toContain('beat "one", on "Press": show takes 0 argument(s), got 1');
  });

  it("takes focus with or without a scale", () => {
    const withScale = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "Press it.",
            cues: [{ on: "Press", do: [["focus", "the button", 1.5]] }],
          },
        ],
      }),
    );
    const without = checkPlayscript(
      doc({
        beats: [
          { id: "one", line: "Press it.", cues: [{ on: "Press", do: [["focus", "the button"]] }] },
        ],
      }),
    );
    expect(withScale).toEqual([]);
    expect(without).toEqual([]);
  });

  it("reports an argument of the wrong type", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          {
            id: "one",
            line: "Press it.",
            cues: [{ on: "Press", do: [["hold", "a while"] as unknown as ["hold", number]] }],
          },
        ],
      }),
    );
    expect(problems).toContain('beat "one", on "Press": hold needs a number, got "a while"');
  });

  it("reports a gesture pointing at a target the document does not define", () => {
    const problems = checkPlayscript(
      doc({
        beats: [
          { id: "one", line: "Press it.", cues: [{ on: "Press", do: [["click", "the lever"]] }] },
        ],
      }),
    );
    expect(problems).toContain('beat "one", on "Press": no target named "the lever"');
  });

  it("reports a malformed target spec", () => {
    const problems = checkPlayscript(
      doc({ targets: { "the button": { name: "Go" } as unknown as { role: string } } }),
    );
    expect(problems.some((p) => p.startsWith('target "the button": needs one of'))).toBe(true);
  });

  it("reports a within that names no target", () => {
    const problems = checkPlayscript(
      doc({ targets: { "the button": { role: "button", within: "the panel" } } }),
    );
    expect(problems).toContain('target "the button": within names no target "the panel"');
  });

  it("reports a within cycle instead of looping", () => {
    const problems = checkPlayscript(
      doc({
        targets: {
          "the button": { role: "button", within: "the panel" },
          "the panel": { role: "group", within: "the button" },
        },
      }),
    );
    expect(problems.some((p) => p.includes("is inside itself"))).toBe(true);
  });
});

describe("formatPlay", () => {
  it("prints every beat, its line and its cues", () => {
    const text = formatPlay(PEOPLE_PLAYSCRIPT);
    expect(text).toContain("hook  (~");
    expect(text).toContain('"This is People.');
    expect(text).toContain("show the whole page");
    expect(text).toContain("focus the Unknown chip ×1.6");
  });

  it("drops the estimate mark for beats that have a clip", () => {
    const clips = Object.fromEntries(PEOPLE_PLAYSCRIPT.beats.map((b) => [b.id, 5]));
    const text = formatPlay(PEOPLE_PLAYSCRIPT, { clips });
    expect(text).toContain("hook  (5.0s)");
    expect(text).not.toContain("~");
  });

  it("prints a question mark rather than throwing on a phrase that is not in the line", () => {
    const text = formatPlay(
      doc({ beats: [{ id: "one", line: "Press it.", cues: [{ on: "Pull it", do: [["show"]] }] }] }),
    );
    expect(text).toContain("?s  Pull it");
  });
});
