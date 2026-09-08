// When each phrase of a beat is spoken, from the narration clips.
//
// A phrase's time is read from the clip's character alignment when the voice
// generator saved one (`<id>.words.json` beside `<id>.mp3`). Without it, the
// phrase's position in the line is scaled to the clip's length, which is
// within a few tenths of a second for a sentence read evenly. Without a clip
// at all, the length is a reading-speed estimate, which is only good enough to
// preview pacing.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { END, type Beat } from "./types.js";

/** Words a narrator manages in a second, for beats that have no clip yet. */
export const WORDS_PER_SECOND = 2.5;
/** The least silence between one line ending and the next beginning, in seconds. */
export const MIN_BREAK_SECONDS = 1.0;
/** How far ahead of its phrase a gesture starts, so the hand is already moving when the word lands. */
export const GESTURE_LEAD_SECONDS = 0.2;
/** How far behind its phrase a gesture may start before the report calls it late. */
export const LATE_SECONDS = 0.5;

/** Seconds per beat id. A beat with no entry has no clip. */
export type Clips = Record<string, number>;

/** A voice generator's per-character timing for one clip. */
export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
}

export type Alignments = Record<string, Alignment>;

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** How long a line takes to say, in seconds: the clip's length, or an estimate. */
export function spoken(beat: Pick<Beat, "id" | "line">, clips?: Clips | null): number {
  return clips?.[beat.id] ?? wordCount(beat.line) / WORDS_PER_SECOND;
}

/**
 * Seconds into the beat at which `phrase` starts. Throws when the phrase is
 * not in the line, so check the playscript first.
 *
 * With an alignment: the start time of the phrase's first character. Without:
 * the phrase's character offset as a fraction of the line, times the spoken
 * length. Both are measured from the clip's start, which is the beat's cue.
 */
export function phraseTime(
  beat: Pick<Beat, "id" | "line">,
  phrase: string,
  {
    clips = null,
    alignments = null,
  }: { clips?: Clips | null; alignments?: Alignments | null } = {},
): number {
  if (phrase === END) return spoken(beat, clips);
  const index = beat.line.indexOf(phrase);
  if (index < 0) throw new Error(`"${phrase}" is not in the line of beat "${beat.id}"`);
  const alignment = alignments?.[beat.id];
  if (alignment) {
    const t = alignment.character_start_times_seconds[index];
    if (typeof t === "number") return t;
  }
  return (index / beat.line.length) * spoken(beat, clips);
}

/**
 * Seconds per beat id from the clips in `audioDir`, or null when any clip is
 * missing or `ffprobe` is null. All or nothing, so a run is paced either to
 * the voice throughout or to the estimate throughout.
 */
export function clipDurations(
  beats: Beat[],
  audioDir: string,
  { ffprobe, log }: { ffprobe: string | null; log?: (line: string) => void },
): Clips | null {
  const durations: Clips = {};
  for (const { id } of beats) {
    const file = join(audioDir, `${id}.mp3`);
    if (!existsSync(file)) return null;
    if (!ffprobe) {
      log?.(`clips found in ${audioDir} but no ffprobe; pacing by estimate`);
      return null;
    }
    durations[id] = Number(probeDuration(ffprobe, file));
  }
  log?.(`Pacing to ${beats.length} narration clips in ${audioDir}.`);
  return durations;
}

/** How long one ffprobe of a clip may take. It reads a header, so it is milliseconds of work. */
const PROBE_TIMEOUT_MS = 30_000;

/**
 * The clip's duration in seconds, as ffprobe prints it. Throws with ffprobe's
 * own diagnostics when it fails or outlives {@link PROBE_TIMEOUT_MS}.
 */
function probeDuration(ffprobe: string, file: string): string {
  try {
    return execFileSync(
      ffprobe,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
      { timeout: PROBE_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
    )
      .toString()
      .trim();
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr?.toString().trim();
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(stderr ? `${message}\n${stderr}` : message);
  }
}

/**
 * Character alignments per beat id, for the clips that have one. An alignment
 * whose characters do not spell the line is ignored: it belongs to an older
 * wording, and its times would land on the wrong words.
 */
export function loadAlignments(
  beats: Beat[],
  audioDir: string,
  log?: (line: string) => void,
): Alignments {
  const alignments: Alignments = {};
  for (const beat of beats) {
    const file = join(audioDir, `${beat.id}.words.json`);
    if (!existsSync(file)) continue;
    const alignment = JSON.parse(readFileSync(file, "utf8")) as Alignment;
    if (alignment.characters?.join("") !== beat.line) {
      log?.(`${file} is for a different wording of "${beat.id}"; ignoring it`);
      continue;
    }
    alignments[beat.id] = alignment;
  }
  return alignments;
}
