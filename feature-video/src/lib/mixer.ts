// Turns a finished grab into the deliverable: the recording with the narration
// on it as a subtitle stream, and the clips mixed in when the run had them.
//
// A subtitle runs from its cue for exactly as long as the line takes to say,
// so caption and voice start and end together. The video stream is copied, so
// only the audio is encoded and the mux costs seconds rather than minutes.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_BREAK_SECONDS, WORDS_PER_SECOND, wordCount, type Clips } from "./timing.js";
import type { CueRecord } from "./types.js";

/** The least a subtitle stays on screen, in milliseconds. */
const MIN_SUBTITLE_MS = 500;
/** The gap left before the next cue, so two subtitles never overlap. */
const SUBTITLE_GAP_MS = 40;
/** How long the mux may take. The video stream is copied, so it is seconds of work. */
const MUX_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The narration as an SRT document, one entry per cue in cue order.
 *
 * An entry lasts the clip's length, or a reading-speed estimate of its line
 * when the run had no clips, held on screen for at least
 * {@link MIN_SUBTITLE_MS} and then cut short of the next cue. The next cue
 * wins over the floor, so two entries never overlap however close the cues
 * are. Cue times are milliseconds from the first recorded frame.
 */
export function buildSrt(cues: CueRecord[], clips: Clips | null = null): string {
  return cues
    .map((cue, i) => {
      const seconds = clips?.[cue.id] ?? wordCount(cue.line) / WORDS_PER_SECOND;
      const next = cues[i + 1];
      const ceiling = next ? next.at - SUBTITLE_GAP_MS : Number.POSITIVE_INFINITY;
      const end = Math.min(Math.max(cue.at + seconds * 1000, cue.at + MIN_SUBTITLE_MS), ceiling);
      return `${i + 1}\n${srtTime(cue.at)} --> ${srtTime(end)}\n${cue.line}\n`;
    })
    .join("\n");
}

/** `hh:mm:ss,mmm` from milliseconds. */
export function srtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(total / 3_600_000))}:${pad(Math.floor(total / 60_000) % 60)}:${pad(
    Math.floor(total / 1000) % 60,
  )},${pad(total % 1000, 3)}`;
}

export interface MixInput {
  /** The grab, as an absolute path. */
  video: string;
  cues: CueRecord[];
  /** Seconds per beat id, or null when the run was paced by estimate. */
  clips: Clips | null;
  /** Where `<beat id>.mp3` lives; only read when `clips` is set. */
  clipsDir: string;
  /** Where `narrated.mp4`, `narration.srt`, `narration.txt` and `lines.txt` are written. */
  outDir: string;
  ffmpeg: string;
  log?: (line: string) => void;
}

export interface MixResult {
  narrated: string;
  srt: string;
  narrationTxt: string;
  linesTxt: string;
}

/**
 * Writes the subtitle and narration text files, then muxes `narrated.mp4`.
 *
 * With clips, every clip is laid at its cue and mixed into one track. Without,
 * the output is the copied video and the subtitle stream alone — still
 * `narrated.mp4`, so the file a caller downloads has one name either way.
 * Throws whatever ffmpeg's failure says; the caller owns the run's status.
 */
export function mixNarration(input: MixInput): MixResult {
  const { video, cues, clips, clipsDir, outDir, ffmpeg, log } = input;
  const srt = join(outDir, "narration.srt");
  writeFileSync(srt, buildSrt(cues, clips));
  const { narrationTxt, linesTxt } = writeNarration(outDir, cues, clips);

  const narrated = join(outDir, "narrated.mp4");
  const audio = clips ? cues.map((cue) => join(clipsDir, `${cue.id}.mp3`)) : [];
  const args = ["-y", "-loglevel", "error", "-i", video];
  for (const file of audio) args.push("-i", file);
  args.push("-i", srt);
  if (audio.length > 0) {
    // Each clip is delayed to its cue and the delayed streams are summed, so
    // one aac track carries the whole narration. `amix` runs to its longest
    // input, so the track ends on the last clip and the video plays out the
    // rest in silence.
    const delayed = cues.map((cue, i) => `[${i + 1}:a]adelay=${cue.at}|${cue.at}[a${i}]`);
    const mix = `${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0[a]`;
    args.push("-filter_complex", `${delayed.join(";")};${mix}`);
  }
  args.push("-map", "0:v");
  if (audio.length > 0) args.push("-map", "[a]");
  args.push("-map", `${audio.length + 1}:s`);
  args.push("-c:v", "copy");
  if (audio.length > 0) args.push("-c:a", "aac", "-b:a", "192k");
  args.push("-c:s", "mov_text", "-metadata:s:s:0", "language=eng");
  // No `-shortest`: every input is already finite, and the subtitle input
  // reaches EOF on its last cue — seconds before the last frame — so asking
  // for the shortest one would cut the tail off the video.
  args.push(narrated);
  runFfmpeg(ffmpeg, args);
  log?.(`Narrated: ${narrated}`);
  return { narrated, srt, narrationTxt, linesTxt };
}

/**
 * Runs ffmpeg to completion. Throws with ffmpeg's own diagnostics when it
 * fails or when it outlives {@link MUX_TIMEOUT_MS}, which a mux of a finished
 * grab never does.
 */
function runFfmpeg(ffmpeg: string, args: string[]): void {
  try {
    execFileSync(ffmpeg, args, { timeout: MUX_TIMEOUT_MS, stdio: ["ignore", "ignore", "pipe"] });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string }).stderr?.toString().trim();
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(stderr ? `${message}\n${stderr}` : message);
  }
}

/**
 * The voiceover in two shapes, for generating it after the fact.
 *
 * `narration.txt` is one script with `<break time="…s" />` tags between lines,
 * sized so each line starts at its cue when read at about 150 words a minute;
 * a voice generator caps a break at 3 seconds, so longer gaps are several
 * tags. `lines.txt` is one line per cue with its start time, for generating
 * each line as its own clip and dropping it on the timeline at that time.
 */
export function writeNarration(
  outDir: string,
  cues: CueRecord[],
  clips: Clips | null = null,
): { narrationTxt: string; linesTxt: string } {
  const said = (cue: CueRecord) => clips?.[cue.id] ?? wordCount(cue.line) / WORDS_PER_SECOND;
  const breaks = (seconds: number) => {
    const tags: string[] = [];
    let left = Math.max(0, seconds);
    while (left > 0.25) {
      const step = Math.min(3, left);
      tags.push(`<break time="${step.toFixed(1)}s" />`);
      left -= step;
    }
    return tags.join(" ");
  };
  const script: string[] = [];
  if (cues.length > 0 && cues[0].at > 300) script.push(breaks(cues[0].at / 1000));
  cues.forEach((cue, i) => {
    script.push(cue.line);
    const next = cues[i + 1];
    if (!next) return;
    const gap = Math.max(MIN_BREAK_SECONDS, (next.at - cue.at) / 1000 - said(cue));
    const tags = breaks(gap);
    if (tags) script.push(tags);
  });
  const narrationTxt = join(outDir, "narration.txt");
  const linesTxt = join(outDir, "lines.txt");
  writeFileSync(narrationTxt, `${script.join("\n\n")}\n`);
  writeFileSync(
    linesTxt,
    `${cues.map((cue) => `${formatClock(cue.at)}  ${cue.line}`).join("\n")}\n`,
  );
  return { narrationTxt, linesTxt };
}

function formatClock(ms: number): string {
  const seconds = ms / 1000;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
