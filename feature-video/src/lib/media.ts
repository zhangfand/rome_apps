// Where the external binaries a run needs are found.
//
// A recording shells out to four programs the app does not ship: ffmpeg and
// ffprobe for the grab and the mux, Xvfb for the virtual display, and a
// Chromium for the stage. Each is looked up once, from an environment
// variable first so an operator can point at a build the image does not carry,
// and the failure names the variable.

import { execFileSync } from "node:child_process";

/** Absolute path of `bin` on PATH, or null when the shell cannot find it. */
export function which(bin: string): string | null {
  try {
    return (
      execFileSync("sh", ["-c", `command -v ${bin}`])
        .toString()
        .trim() || null
    );
  } catch {
    return null;
  }
}

function fromEnvOrPath(envVar: string, name: string): string | null {
  return process.env[envVar] || which(name);
}

/** The ffmpeg binary, or null when neither `FEATURE_VIDEO_FFMPEG` nor PATH names one. */
export function findFfmpeg(): string | null {
  return fromEnvOrPath("FEATURE_VIDEO_FFMPEG", "ffmpeg");
}

/** The ffprobe binary, or null when neither `FEATURE_VIDEO_FFPROBE` nor PATH names one. */
export function findFfprobe(): string | null {
  return fromEnvOrPath("FEATURE_VIDEO_FFPROBE", "ffprobe");
}

/** The Xvfb binary, or null when neither `FEATURE_VIDEO_XVFB` nor PATH names one. */
export function findXvfb(): string | null {
  return fromEnvOrPath("FEATURE_VIDEO_XVFB", "Xvfb");
}

/**
 * A Chromium to stage the playscript in.
 *
 * Playwright's own download is a generic Linux build that neither NixOS nor a
 * slim container can run, so a system browser wins: `FEATURE_VIDEO_CHROMIUM`,
 * then the usual names. `/usr/bin/chromium` is checked as a file because the
 * Docker image installs it there without always putting it on PATH.
 */
export function findChromium(): string | null {
  const override = process.env.FEATURE_VIDEO_CHROMIUM;
  if (override) return override;
  for (const name of [
    "/usr/bin/chromium",
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ]) {
    const found = name.startsWith("/") ? whichFile(name) : which(name);
    if (found) return found;
  }
  return null;
}

function whichFile(path: string): string | null {
  try {
    execFileSync("sh", ["-c", `test -x ${path}`]);
    return path;
  } catch {
    return null;
  }
}

/** Throws when `binary` is null, naming the environment variable that overrides the lookup. */
export function requireBinary(binary: string | null, name: string, envVar: string): string {
  if (!binary) throw new Error(`no ${name} found; put one on PATH or set ${envVar}`);
  return binary;
}
