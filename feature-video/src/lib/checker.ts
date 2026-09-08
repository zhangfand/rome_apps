// Checks a playscript against itself and prints it as a readable script.
//
// Every cue's phrase has to be in its line, cues have to follow the order of
// their phrases, and every gesture has to use a known verb and point at a
// target the document defines. The recorder runs the same check before it
// opens a browser, so a script that cannot be staged fails in a second rather
// than a minute in.

import { validateTargetSpec } from "./targets.js";
import { phraseTime, spoken, type Clips } from "./timing.js";
import { END, type Beat, type Gesture, type PlayscriptDoc } from "./types.js";

/** What each verb's arguments are, in order. A `target` is a name in `doc.targets`. */
type ArgKind = "target" | "string" | "number";

interface VerbShape {
  args: ArgKind[];
  /** How many leading arguments are required; the rest are optional. */
  required: number;
}

const VERBS: Record<string, VerbShape> = {
  show: { args: [], required: 0 },
  focus: { args: ["target", "number"], required: 1 },
  hover: { args: ["target"], required: 1 },
  click: { args: ["target"], required: 1 },
  type: { args: ["string"], required: 1 },
  press: { args: ["string"], required: 1 },
  wait: { args: ["target"], required: 1 },
  gone: { args: ["target"], required: 1 },
  hold: { args: ["number"], required: 1 },
  scroll: { args: ["target"], required: 1 },
  goto: { args: ["string"], required: 1 },
};

/** Problems with a playscript, as sentences; empty when it is sound. */
export function checkPlayscript(doc: PlayscriptDoc): string[] {
  if (typeof doc !== "object" || doc === null) return ["the playscript is not an object"];
  const targets = doc.targets ?? {};
  const problems: string[] = [];
  if (typeof doc.targets !== "object" || doc.targets === null || Array.isArray(doc.targets)) {
    problems.push("the playscript has no targets object");
  } else {
    for (const [name, spec] of Object.entries(targets)) {
      problems.push(...validateTargetSpec(spec, `target "${name}"`, targets, new Set([name])));
    }
  }
  if (!Array.isArray(doc.beats) || doc.beats.length === 0) {
    problems.push("the playscript has no beats");
    return problems;
  }

  const ids = new Set<string>();
  for (const beat of doc.beats) {
    const where = `beat "${beat?.id}"`;
    if (typeof beat?.id !== "string" || !beat.id.trim()) {
      problems.push("a beat has no id");
      continue;
    }
    if (ids.has(beat.id)) problems.push(`${where} appears twice`);
    ids.add(beat.id);
    if (typeof beat.line !== "string" || !beat.line.trim()) problems.push(`${where} has no line`);
    if (!Array.isArray(beat.cues) || beat.cues.length === 0) {
      problems.push(`${where} has no cues`);
      continue;
    }
    let last = -1;
    beat.cues.forEach((cue, i) => {
      if (cue?.on === END) {
        if (i !== beat.cues.length - 1) problems.push(`${where}: only the last cue may be on END`);
      } else if (typeof cue?.on !== "string") {
        problems.push(`${where}: a cue has no phrase`);
      } else {
        const at = typeof beat.line === "string" ? beat.line.indexOf(cue.on) : -1;
        if (at < 0) {
          problems.push(`${where}: "${cue.on}" is not in the line`);
        } else if (at <= last) {
          problems.push(`${where}: "${cue.on}" comes before the previous cue's phrase in the line`);
        }
        last = Math.max(last, at);
      }
      if (!Array.isArray(cue?.do) || cue.do.length === 0) {
        problems.push(`${where}, on "${cue?.on}": no gestures`);
        return;
      }
      for (const gesture of cue.do) {
        problems.push(...checkGesture(gesture, `${where}, on "${cue.on}"`, targets));
      }
    });
  }
  return problems;
}

function checkGesture(gesture: unknown, where: string, targets: Record<string, unknown>): string[] {
  if (!Array.isArray(gesture) || gesture.length === 0) {
    return [`${where}: ${JSON.stringify(gesture)} is not a gesture`];
  }
  const [verb, ...args] = gesture as [string, ...unknown[]];
  const shape = VERBS[verb];
  if (!shape) return [`${where}: unknown verb "${verb}"`];
  if (args.length < shape.required || args.length > shape.args.length) {
    const wanted =
      shape.required === shape.args.length
        ? `${shape.args.length}`
        : `${shape.required} to ${shape.args.length}`;
    return [`${where}: ${verb} takes ${wanted} argument(s), got ${args.length}`];
  }
  const problems: string[] = [];
  args.forEach((arg, i) => {
    const kind = shape.args[i];
    if (kind === "target" && !(typeof arg === "string" && arg in targets)) {
      problems.push(`${where}: no target named ${JSON.stringify(arg)}`);
    } else if (kind === "number" && typeof arg !== "number") {
      problems.push(`${where}: ${verb} needs a number, got ${JSON.stringify(arg)}`);
    } else if (kind === "string" && typeof arg !== "string") {
      problems.push(`${where}: ${verb} needs text, got ${JSON.stringify(arg)}`);
    }
  });
  return problems;
}

/**
 * The playscript as text: each line, then its cues with the second they fire
 * at. `clips` is seconds per beat id when the narration clips are known.
 *
 * Times taken from a reading-speed estimate rather than a clip are marked `~`,
 * and a cue whose phrase is not in its line prints `?` — the printout is meant
 * to be readable beside the problem list, so it never throws.
 */
export function formatPlay(
  doc: PlayscriptDoc,
  { clips = null }: { clips?: Clips | null } = {},
): string {
  const out: string[] = [];
  for (const beat of doc.beats ?? []) {
    const length = clips?.[beat.id];
    const mark = length == null ? "~" : "";
    out.push(`${beat.id}  (${mark}${(length ?? spoken(beat, null)).toFixed(1)}s)`);
    out.push(`  "${beat.line}"`);
    for (const cue of beat.cues ?? []) {
      const at = cueTime(beat, cue.on, clips);
      const gestures = (cue.do ?? []).map(describe).join("; ");
      out.push(`  ${mark}${at.padStart(4)}s  ${cue.on.padEnd(28)} ${gestures}`);
    }
    out.push("");
  }
  return out.join("\n");
}

function cueTime(beat: Beat, phrase: string, clips: Clips | null): string {
  try {
    return phraseTime(beat, phrase, { clips }).toFixed(1);
  } catch {
    return "?";
  }
}

function describe(gesture: Gesture): string {
  const [verb, ...args] = gesture as [string, ...unknown[]];
  switch (verb) {
    case "show":
      return "show the whole page";
    case "focus":
      return args[1] == null ? `focus ${args[0]}` : `focus ${args[0]} ×${args[1]}`;
    case "type":
      return `type "${args[0]}"`;
    case "press":
      return `press ${args[0]}`;
    case "hold":
      return `hold ${args[0]}ms`;
    case "goto":
      return `go to ${args[0]}`;
    default:
      return `${verb} ${args[0]}`;
  }
}
