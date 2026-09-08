// Stages a playscript in a real browser and grabs the screen.
//
// The stage is a headed Chromium on a virtual X display the size of the video
// plus room for the browser's toolbar, and the recording is ffmpeg reading
// that display at a fixed frame rate. Nothing here is faked: the page is the
// app, the clicks are real input, and the cue sheet is written from the clock
// of the grab's first captured frame, so a narration clip laid at a cue lands
// on the frame the gesture is in.
//
// Backend only. It spawns processes and writes files, so never import it from
// `src/web/`.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "playwright-core";
import { checkPlayscript } from "./checker.js";
import { findChromium, findFfmpeg, findFfprobe, findXvfb, requireBinary } from "./media.js";
import { resolveSpec, resolveTarget } from "./targets.js";
import {
  clipDurations,
  GESTURE_LEAD_SECONDS,
  LATE_SECONDS,
  loadAlignments,
  MIN_BREAK_SECONDS,
  phraseTime,
  spoken,
  type Alignments,
  type Clips,
} from "./timing.js";
import type { Beat, CueRecord, Gesture, PlayscriptDoc, ProjectSettings } from "./types.js";

/** How long a focus change takes on screen, in milliseconds. */
const FOCUS_MS = 800;
/** Room above the video on the virtual screen for Chromium's toolbar, in device pixels. */
const TOOLBAR_ROOM = 600;

export interface RecordInput {
  project: ProjectSettings;
  /** Path appended to the project `baseUrl` before the first beat. */
  startPath: string;
  doc: PlayscriptDoc;
  /** Directory the recording, cue sheet and log go in. Created if missing. */
  outDir: string;
  /** Directory of `<beat id>.mp3` narration clips. Pacing falls back to an estimate without it. */
  clipsDir?: string;
  log: (line: string) => void;
}

/**
 * What one recording produced. A cue's `at` is milliseconds from the first
 * recorded frame; a gesture's `planned` and `at` are milliseconds from the
 * start of its own beat.
 */
export interface RecordingResult {
  cues: CueRecord[];
  /** Gestures that started more than {@link LATE_SECONDS} after their phrase. */
  late: number;
  durationSeconds: number;
  /** Absolute path of the grab. */
  video: string;
  /** Absolute path of the cue sheet as JSON. */
  cuesFile: string;
  /** Seconds per beat id when the run was paced to clips, else null. */
  clips: Clips | null;
}

interface Size {
  width: number;
  height: number;
}

function parseSize(text: string, field: string): Size {
  const m = /^(\d+)x(\d+)$/.exec(text ?? "");
  if (!m) throw new Error(`${field} should be WIDTHxHEIGHT, got "${text}"`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/**
 * Records the playscript and returns its cue sheet. Rejects when the
 * playscript does not check out, when a binary is missing, or when a gesture
 * cannot be performed; the browser and the display are torn down either way.
 *
 * Writes `recording.mp4` and `cues.json` into `outDir`, and streams its own
 * progress plus ffmpeg's summary to `log`.
 */
export async function recordPlayscript(input: RecordInput): Promise<RecordingResult> {
  const { project, doc, outDir, log } = input;
  const problems = checkPlayscript(doc);
  if (problems.length) {
    throw new Error(`the playscript cannot be staged:\n  - ${problems.join("\n  - ")}`);
  }

  const layout = parseSize(project.layout, "layout");
  const video = parseSize(project.video, "video");
  const scale = video.width / layout.width;
  if (Math.abs(video.height / layout.height - scale) > 0.01) {
    throw new Error(
      `video ${project.video} and layout ${project.layout} need the same aspect ratio`,
    );
  }

  const ffmpeg = requireBinary(findFfmpeg(), "ffmpeg", "FEATURE_VIDEO_FFMPEG");
  const xvfb = requireBinary(findXvfb(), "Xvfb", "FEATURE_VIDEO_XVFB");
  const executablePath = requireBinary(findChromium(), "chromium", "FEATURE_VIDEO_CHROMIUM");
  mkdirSync(outDir, { recursive: true });

  const clipsDir = input.clipsDir;
  const clips =
    clipsDir && existsSync(clipsDir)
      ? clipDurations(doc.beats, clipsDir, { ffprobe: findFfprobe(), log })
      : null;
  const alignments = clips && clipsDir ? loadAlignments(doc.beats, clipsDir, log) : null;

  const display = await startXvfb(
    xvfb,
    { width: video.width, height: video.height + TOOLBAR_ROOM },
    log,
  );
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let grab: Grab | undefined;
  try {
    browser = await chromium.launch({
      headless: false,
      executablePath,
      env: { ...process.env, DISPLAY: display.name, ...fontEnv(outDir) },
      // The window is the recording, so it has to be exactly the video size
      // (see fillScreen), and dropping --enable-automation drops the
      // "controlled by automated test software" bar that would otherwise sit
      // on the first frames.
      args: [
        // Window sizes are in CSS pixels; the scale factor makes each one
        // `scale` device pixels on the X screen. Set explicitly, because
        // Chromium otherwise derives a factor from the X screen's reported
        // physical size, and a 1.05 factor puts the window well past the edge
        // of the grab.
        `--window-size=${layout.width},${layout.height}`,
        "--window-position=0,0",
        "--hide-scrollbars",
        `--force-device-scale-factor=${scale}`,
        // A container has no user namespaces for the sandbox and a 64MB
        // /dev/shm, either of which stops Chromium before the first frame.
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    context = await browser.newContext({
      // A null viewport lets the page fill the window rather than being
      // letterboxed inside it.
      viewport: null,
      colorScheme: "light",
      locale: project.locale ?? "en-US",
      timezoneId: project.timezone ?? "America/Los_Angeles",
    });
    await context.addInitScript(scrollLockScript);
    await context.addInitScript(overlayScript);
    const page = await context.newPage();
    const origin = await fillScreen(context, page, layout, scale);

    // The page is up before the grab starts, so the video opens on it rather
    // than on a blank window loading.
    const startUrl = urlFor(project.baseUrl, input.startPath);
    log(`Opening ${startUrl}`);
    await page.goto(startUrl);
    await resolveSpec(page, doc.targets, project.readyTarget).first().waitFor();

    grab = await startGrab({
      ffmpeg,
      file: join(outDir, "recording.mp4"),
      display: display.name,
      origin,
      size: video,
      fps: project.fps,
      log,
    });
    const stage = new Stage(page, {
      project,
      doc,
      layout,
      clips,
      alignments,
      t0: grab.startedAt,
      log,
    });
    await runPlay(stage);
    const durationSeconds = (Date.now() - grab.startedAt) / 1000;
    const file = await grab.stop();
    grab = undefined;
    const cuesFile = join(outDir, "cues.json");
    writeFileSync(cuesFile, JSON.stringify(stage.cues, null, 2));
    const late = stage.cues.reduce(
      (n, cue) => n + cue.gestures.filter((g) => g.at - g.planned > LATE_SECONDS * 1000).length,
      0,
    );
    if (late) {
      log(
        `${late} gesture(s) started late. A cue that follows a wait inherits the wait; move it to a later phrase, or give the beat more line before it.`,
      );
    }
    return { cues: stage.cues, late, durationSeconds, video: file, cuesFile, clips };
  } finally {
    if (grab) await grab.stop().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    display.stop();
  }
}

function urlFor(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${(path ?? "/").replace(/^\//, "")}`;
}

// ---------------------------------------------------------------------------
// The virtual display and the grab.
// ---------------------------------------------------------------------------

interface Display {
  name: string;
  stop: () => void;
}

/**
 * Starts an X server on a display number nothing else on the box is using and
 * resolves once its socket exists. 24-bit depth is what x11grab reads fastest.
 *
 * The number is picked by looking at what is on disk, so two runs starting in
 * the same millisecond can pick the same one; the loser's Xvfb exits and the
 * run fails rather than recording someone else's screen.
 */
function startXvfb(xvfb: string, size: Size, log: (line: string) => void): Promise<Display> {
  const number = freeDisplayNumber();
  const name = `:${number}`;
  const socket = `/tmp/.X11-unix/X${number}`;
  log(`Xvfb ${name} at ${size.width}x${size.height}`);
  const proc = spawn(
    xvfb,
    [
      name,
      "-screen",
      "0",
      `${size.width}x${size.height}x24`,
      "-dpi",
      "96",
      "-nolisten",
      "tcp",
      "-noreset",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const stop = () => {
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    proc.kill("SIGTERM");
    // An Xvfb that does not take the term holds its display number and its
    // lock file, which no later run can then use.
    const hard = setTimeout(() => proc.kill("SIGKILL"), 3000);
    hard.unref();
    proc.once("exit", () => clearTimeout(hard));
  };
  return new Promise<Display>((resolve, reject) => {
    let settled = false;
    const timer = setInterval(() => {
      if (settled) return;
      if (existsSync(socket)) {
        settled = true;
        clearInterval(timer);
        resolve({ name, stop });
      }
    }, 100);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      stop();
      reject(new Error(`Xvfb ${name} did not come up in 15s:\n${stderr}`));
    }, 15_000);
    proc.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      reject(new Error(`Xvfb ${name} exited (${code}):\n${stderr}`));
    });
  });
}

/**
 * A display number between 90 and 199 that no X server holds. Throws when
 * every number in the range is taken.
 *
 * A number is taken when it has a socket in `/tmp/.X11-unix` or a
 * `/tmp/.X<n>-lock` file. An X server that died without cleaning up leaves
 * only the lock, and Xvfb refuses that number, so the lock counts as much as
 * the socket does.
 */
export function freeDisplayNumber(): number {
  const taken = new Set<string>();
  try {
    for (const entry of readdirSync("/tmp/.X11-unix")) taken.add(entry);
  } catch {
    // No socket directory means no X server is running, so no number is taken
    // by one.
  }
  for (let n = 90; n < 200; n++) {
    if (!taken.has(`X${n}`) && !existsSync(`/tmp/.X${n}-lock`)) return n;
  }
  throw new Error("no free X display number between :90 and :199");
}

interface Grab {
  /** When ffmpeg reported its first encoded frame. Every cue time counts from it. */
  startedAt: number;
  /**
   * Ends the recording and resolves with the file, at the latest
   * {@link GRAB_STOP_MS} after being called. Never rejects.
   */
  stop: () => Promise<string>;
}

/** How long ffmpeg has to report a first frame before the grab is given up on. */
const GRAB_START_MS = 20_000;
/** How long ffmpeg has to finalize the file after being asked to quit. */
const GRAB_STOP_MS = 15_000;

/**
 * Grabs the display with ffmpeg at a fixed frame rate into an H.264 MP4.
 *
 * Resolves once ffmpeg reports its first encoded frame, so the recording is
 * rolling before the page moves. Rejects with ffmpeg's output when no frame
 * arrives within {@link GRAB_START_MS} or when ffmpeg exits first; the process
 * is dead either way. `-preset veryfast` keeps a 4K stream at 60fps inside
 * real time on a many-core box; a slower preset drops frames, which x11grab
 * hides by repeating the last one.
 */
async function startGrab(opts: {
  ffmpeg: string;
  file: string;
  display: string;
  origin: { x: number; y: number };
  size: Size;
  fps: number;
  log: (line: string) => void;
}): Promise<Grab> {
  const { ffmpeg, file, display, origin, size, fps, log } = opts;
  const proc = spawn(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "info",
      "-y",
      "-f",
      "x11grab",
      "-framerate",
      String(fps),
      "-video_size",
      `${size.width}x${size.height}`,
      "-draw_mouse",
      "0",
      "-i",
      `${display}+${origin.x},${origin.y}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      file,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let output = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    if (output.length > 20_000) output = output.slice(-10_000);
  });
  // ffmpeg can be gone before or during the "q" that ends the grab, and an
  // unhandled EPIPE on its stdin would take this process down with it.
  proc.stdin.on("error", () => {});

  const startedAt = await new Promise<number>((resolve, reject) => {
    const rolling = setInterval(() => {
      if (!/frame=\s*\d+/.test(output)) return;
      clearInterval(rolling);
      clearTimeout(deadline);
      resolve(Date.now());
    }, 50);
    const deadline = setTimeout(() => {
      clearInterval(rolling);
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg captured no frame in ${GRAB_START_MS / 1000}s:\n${output}`));
    }, GRAB_START_MS);
    proc.once("exit", (code) => {
      clearInterval(rolling);
      clearTimeout(deadline);
      reject(new Error(`ffmpeg exited early (${code}):\n${output}`));
    });
  });
  log(`Recording ${size.width}x${size.height} at ${fps}fps into ${file}`);
  return {
    startedAt,
    stop: () =>
      new Promise<string>((resolve) => {
        const done = () => {
          clearTimeout(deadline);
          const last = output
            .trim()
            .split(/[\r\n]+/)
            .filter((line) => line.startsWith("frame="))
            .at(-1);
          if (last) log(`ffmpeg: ${last.replace(/\s+/g, " ")}`);
          resolve(file);
        };
        // An ffmpeg that never exits would otherwise hold the run open for as
        // long as it lives, so the wait ends and the caller keeps whatever is
        // on disk.
        const deadline = setTimeout(() => {
          log(`ffmpeg did not exit in ${GRAB_STOP_MS / 1000}s; killing it. ${file} may be torn.`);
          proc.kill("SIGKILL");
          resolve(file);
        }, GRAB_STOP_MS);
        if (proc.exitCode !== null || proc.signalCode !== null) {
          done();
          return;
        }
        proc.once("exit", done);
        // ffmpeg finalizes the MP4 index on "q"; killing it leaves the file
        // unplayable.
        proc.stdin.write("q");
        proc.stdin.end();
      }),
  };
}

/**
 * Sizes the page's window so its content is exactly the video, and reports
 * where on the screen that content starts, in device pixels.
 *
 * Chromium keeps its toolbar in a headed window, and without a window manager
 * it also clamps the window to the screen, so the toolbar cannot be pushed off
 * the top. Instead the virtual screen is taller than the video by
 * {@link TOOLBAR_ROOM}, the window is the video plus its toolbar, and the grab
 * starts below the toolbar. `--kiosk` is not an option: Playwright opens its
 * page in a new window, and the flag only shapes Chromium's startup one.
 */
async function fillScreen(
  context: BrowserContext,
  page: Page,
  layout: Size,
  scale: number,
): Promise<{ x: number; y: number }> {
  const cdp = await context.newCDPSession(page);
  const { windowId } = (await cdp.send("Browser.getWindowForTarget")) as { windowId: number };
  const measure = () =>
    page.evaluate(() => ({
      dw: window.outerWidth - window.innerWidth,
      dh: window.outerHeight - window.innerHeight,
      w: window.innerWidth,
      h: window.innerHeight,
    }));
  // `outerHeight - innerHeight` can be a pixel off from the toolbar's true
  // height, so the window is sized from it once and then corrected by whatever
  // error the content shows, until the content is exactly the video.
  let m = await measure();
  let width = layout.width + m.dw;
  let height = layout.height + m.dh;
  for (let attempt = 0; attempt < 5; attempt++) {
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "normal", left: 0, top: 0, width, height },
    });
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      m = await measure();
      if (m.w === layout.width && m.h === layout.height) break;
    }
    if (m.w === layout.width && m.h === layout.height) break;
    width -= m.w - layout.width;
    height -= m.h - layout.height;
  }
  if (m.w !== layout.width || m.h !== layout.height) {
    throw new Error(
      `page is ${m.w}x${m.h}, wanted ${layout.width}x${layout.height}. ` +
        `The X screen must be at least ${width}x${height}.`,
    );
  }
  // The window sits at the screen's origin and has no bottom or side borders,
  // so the content is its bottom `layout.height` rows. The grab is in device
  // pixels, so the origin is scaled.
  return {
    x: Math.floor((width - layout.width) / 2) * scale,
    y: (height - layout.height) * scale,
  };
}

// ---------------------------------------------------------------------------
// The stage: everything the viewer sees happen is one of these.
// ---------------------------------------------------------------------------

interface StageOptions {
  project: ProjectSettings;
  doc: PlayscriptDoc;
  layout: Size;
  clips: Clips | null;
  alignments: Alignments | null;
  /** The clock cue times count from: when the grab's first frame was captured. */
  t0: number;
  log: (line: string) => void;
}

class Stage {
  readonly cues: CueRecord[] = [];
  private readonly opts: StageOptions;
  private mouse: { x: number; y: number };
  /** The layout point held still on screen, and the magnification around it. Scale 1 is the whole stage. */
  private view = { x: 0, y: 0, s: 1 };
  /** The beat each cue record came from, for pacing; not part of the report. */
  private readonly beats = new Map<CueRecord, Beat>();

  constructor(
    private readonly page: Page,
    opts: StageOptions,
  ) {
    this.opts = opts;
    this.mouse = { x: opts.layout.width / 2, y: opts.layout.height / 2 };
  }

  get clips(): Clips | null {
    return this.opts.clips;
  }

  get beatList(): Beat[] {
    return this.opts.doc.beats;
  }

  /** The locator for a target the playscript names. */
  private target(name: string): Locator {
    return resolveTarget(this.page, this.opts.doc.targets, name);
  }

  /**
   * Magnifies the stage around an element, smoothly, over {@link FOCUS_MS}.
   *
   * The stage element carries `translate(...) scale(s)` chosen around an
   * anchor: a layout point that stays exactly where it was on screen while
   * everything around it grows. The anchor starts at the element's centre and
   * is moved only as far as it takes to keep the whole element on screen, and
   * the scale is lowered only if the element would not fit at the one asked
   * for. Both parts of the transform animate, so moving from one focus to
   * another glides rather than jumps.
   *
   * The stage rather than the body: popups (a select, a menu) are portalled to
   * the body and positioned from the on-screen rectangle of the control that
   * opened them. Outside the transform they land exactly there; inside it the
   * same numbers would be scaled and shifted a second time. The drawn cursor
   * hangs off the document element and keeps its screen position either way.
   * Element boxes and mouse coordinates already account for the transform, so
   * gestures land.
   */
  async focus(locator: Locator, scale = 1.5): Promise<void> {
    await locator.waitFor();
    await this.resetScroll();
    const box = await locator.boundingBox();
    if (!box) throw new Error("element has no box to focus");
    // The box in layout coordinates, undoing the current focus.
    const { x: tx, y: ty, s } = this.view;
    const toLayout = (vx: number, vy: number) => ({
      x: (vx - tx * (1 - s)) / s,
      y: (vy - ty * (1 - s)) / s,
    });
    const tl = toLayout(box.x, box.y);
    const br = toLayout(box.x + box.width, box.y + box.height);
    const W = this.opts.layout.width;
    const H = this.opts.layout.height;
    // A scale the element fits at, with a margin, whatever was asked for.
    const fit = Math.min(scale, (0.92 * W) / (br.x - tl.x), (0.92 * H) / (br.y - tl.y));
    // With anchor u held still, a layout point p lands at u + (p - u) * fit.
    // For the element to stay on screen the anchor has to sit in a range, and
    // the element's centre is moved into it when it falls outside.
    const anchor = (lo: number, hi: number, size: number) => {
      const centre = (lo + hi) / 2;
      if (fit <= 1) return centre;
      const min = (hi * fit - size) / (fit - 1);
      const max = (lo * fit) / (fit - 1);
      return Math.min(Math.max(centre, min), max, size);
    };
    await this.applyView({ x: anchor(tl.x, br.x, W), y: anchor(tl.y, br.y, H), s: fit });
  }

  /** Back to the whole stage. */
  async unfocus(): Promise<void> {
    if (this.view.s === 1) return;
    await this.applyView({ ...this.view, s: 1 });
  }

  async applyView(view: { x: number; y: number; s: number }): Promise<void> {
    this.view = view;
    await this.page.evaluate(
      ({ x, y, s, ms, selector }) => {
        const stage = selector
          ? document.querySelector<HTMLElement>(selector)
          : (document.body.firstElementChild as HTMLElement | null);
        if (!stage) throw new Error(`no stage element for ${selector ?? "body's first child"}`);
        stage.style.transformOrigin = "0 0";
        stage.style.transition = `transform ${ms}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        stage.style.transform = `translate(${x * (1 - s)}px, ${y * (1 - s)}px) scale(${s})`;
      },
      { ...view, ms: FOCUS_MS, selector: this.opts.project.stageSelector ?? null },
    );
    await sleep(FOCUS_MS + 80);
  }

  /**
   * Marks the start of a narration line.
   *
   * A beat does not begin until the previous line has finished: its clip's
   * real length when clips exist, otherwise about 150 words a minute, plus at
   * least `MIN_BREAK_SECONDS` of silence. The gestures set the floor of each
   * beat's length and the narration sets the ceiling, so a clip placed at its
   * cue never runs into the next one.
   *
   * Returns the wall clock the beat started at, which its cues are due from.
   */
  async beat(beat: Beat): Promise<number> {
    const last = this.cues.at(-1);
    if (last) {
      const lastBeat = this.beats.get(last) ?? beat;
      const dueAt =
        this.opts.t0 + last.at + (spoken(lastBeat, this.clips) + MIN_BREAK_SECONDS) * 1000;
      const wait = dueAt - Date.now();
      if (wait > 0) await sleep(wait);
    }
    const now = Date.now();
    const record: CueRecord = {
      id: beat.id,
      at: now - this.opts.t0,
      line: beat.line,
      gestures: [],
    };
    this.cues.push(record);
    this.beats.set(record, beat);
    return now;
  }

  /**
   * Waits until `phrase` of the beat that began at `start` is about to be
   * spoken, and notes in the cue sheet when the gestures actually got going.
   */
  async awaitPhrase(beat: Beat, phrase: string, start: number): Promise<void> {
    const planned =
      phraseTime(beat, phrase, { clips: this.clips, alignments: this.opts.alignments }) * 1000;
    const wait = start + planned - GESTURE_LEAD_SECONDS * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    this.cues.at(-1)?.gestures.push({
      on: phrase,
      planned: Math.round(planned),
      at: Math.round(Date.now() - start),
    });
  }

  /** Runs one gesture from the playscript. */
  async perform(gesture: Gesture): Promise<void> {
    const [verb, ...args] = gesture as [string, ...unknown[]];
    switch (verb) {
      case "show":
        return this.unfocus();
      case "focus":
        return this.focus(this.target(args[0] as string), args[1] as number | undefined);
      case "hover":
        return this.hoverAt(this.target(args[0] as string));
      case "click":
        return this.clickAt(this.target(args[0] as string));
      case "type":
        return this.type(args[0] as string);
      case "press":
        return this.page.keyboard.press(args[0] as string);
      case "wait":
        return this.target(args[0] as string).waitFor();
      case "gone":
        return this.target(args[0] as string).waitFor({ state: "detached", timeout: 15_000 });
      case "hold":
        return this.hold(args[0] as number);
      case "scroll":
        return this.scrollTo(this.target(args[0] as string));
      case "goto":
        return this.goto(args[0] as string);
      default:
        throw new Error(`unknown gesture "${verb}"`);
    }
  }

  hold(ms: number): Promise<void> {
    return sleep(ms);
  }

  /**
   * Navigates to a path under the project's `baseUrl`. The new document has no
   * transform on it, so the view state goes back to the whole stage without
   * animating one.
   */
  async goto(path: string): Promise<void> {
    const url = urlFor(this.opts.project.baseUrl, path);
    this.opts.log(`goto ${url}`);
    await this.page.goto(url);
    await this.page.waitForLoadState("load");
    this.view = { x: 0, y: 0, s: 1 };
  }

  /**
   * Scrolls the stage with the wheel until the element's box is inside the
   * viewport. Gives up after enough steps to cross a long page, so an element
   * in a container the wheel does not move does not hang the run.
   */
  async scrollTo(locator: Locator): Promise<void> {
    await locator.waitFor();
    const height = this.opts.layout.height;
    for (let step = 0; step < 40; step++) {
      const box = await locator.boundingBox();
      if (!box) break;
      const above = box.y;
      const below = box.y + box.height - height;
      if (above >= 0 && below <= 0) return;
      const delta = above < 0 ? Math.max(above, -240) : Math.min(below, 240);
      await this.page.mouse.wheel(0, delta);
      await sleep(60);
    }
  }

  async hoverAt(locator: Locator): Promise<void> {
    await locator.waitFor();
    const box = await locator.boundingBox();
    if (!box) throw new Error("element has no box to hover");
    await this.glide(box.x + box.width * 0.45, box.y + box.height * 0.55);
  }

  async clickAt(locator: Locator): Promise<void> {
    await this.hoverAt(locator);
    await sleep(160);
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
  }

  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text, { delay: 42 });
  }

  /** Moves the mouse along an eased path, so the drawn arrow reads as a hand. */
  async glide(x: number, y: number): Promise<void> {
    const from = this.mouse;
    const distance = Math.hypot(x - from.x, y - from.y);
    const duration = Math.min(900, 260 + distance * 0.9);
    const steps = Math.max(12, Math.round(duration / 16));
    for (let i = 1; i <= steps; i++) {
      const t = easeInOut(i / steps);
      await this.page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
      await sleep(duration / steps);
    }
    this.mouse = { x, y };
  }

  /**
   * Puts every scroll position back to the top before a focus is measured. A
   * control that opens while the stage is magnified can make the browser
   * scroll to reveal itself, and that scroll would outlive the focus.
   */
  private async resetScroll(): Promise<void> {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
      for (const el of document.querySelectorAll("*")) {
        if (el.scrollTop || el.scrollLeft) {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      }
    });
  }
}

/**
 * Stages the playscript: each beat in turn, each cue when its phrase is due.
 *
 * A gesture that blocks on the page can push later cues past their phrases;
 * the cue sheet records how far, and the report counts them.
 */
async function runPlay(stage: Stage): Promise<void> {
  await stage.hold(1000);
  for (const beat of stage.beatList) {
    const start = await stage.beat(beat);
    for (const cue of beat.cues) {
      await stage.awaitPhrase(beat, cue.on, start);
      for (const gesture of cue.do) await stage.perform(gesture);
    }
  }
  // Let the last line finish over the final picture.
  const last = stage.beatList.at(-1);
  if (last) await stage.hold(spoken(last, stage.clips) * 1000 + 800);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Scripts installed in the page before any of its own runs.
// ---------------------------------------------------------------------------

/**
 * Refuses the scrolls a magnified stage invites.
 *
 * A page that fits the layout never needs to scroll. It can, though, once the
 * stage is magnified: the scaled overflow makes the viewport scrollable, and a
 * control that opens and takes keyboard focus (a select, a menu) scrolls the
 * document to reveal itself, pushing what the focus framed off the top.
 * Chromium scrolls the viewport for that even under `overflow: clip`, so the
 * scroll is refused at its source, and any that still lands is undone before
 * the next frame.
 */
function scrollLockScript(): void {
  const apply = () => {
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options?: FocusOptions) {
      return focus.call(this, { ...options, preventScroll: true });
    };
    document.addEventListener(
      "scroll",
      (event) => {
        const t = event.target;
        if (t !== document && t !== document.documentElement && t !== document.body) return;
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      },
      true,
    );
  };
  if (document.documentElement) apply();
  else document.addEventListener("DOMContentLoaded", apply);
}

/**
 * Draws the cursor. Playwright renders no pointer, so the video would show
 * things happening with nothing doing them: an arrow follows the mouse and a
 * ring expands on every press.
 */
function overlayScript(): void {
  const mount = () => {
    if (document.getElementById("__fv-cursor")) return;

    const cursor = document.createElement("div");
    cursor.id = "__fv-cursor";
    cursor.innerHTML =
      '<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 2 L2 24 L8 18.5 L12.5 28 L16 26.5 L11.5 17 L20 17 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
      "</svg>";
    Object.assign(cursor.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "22px",
      height: "30px",
      pointerEvents: "none",
      zIndex: "2147483647",
      transform: "translate(-2px, -2px)",
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))",
    });

    const ring = document.createElement("div");
    ring.id = "__fv-ring";
    Object.assign(ring.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "36px",
      height: "36px",
      marginLeft: "-18px",
      marginTop: "-18px",
      borderRadius: "50%",
      border: "2.5px solid rgba(37, 99, 235, .85)",
      pointerEvents: "none",
      zIndex: "2147483646",
      opacity: "0",
      transform: "scale(.4)",
    });

    document.documentElement.append(cursor, ring);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    const place = () => {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };
    place();
    document.addEventListener(
      "mousemove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        place();
      },
      true,
    );
    document.addEventListener(
      "mousedown",
      () => {
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.style.transition = "none";
        ring.style.opacity = "1";
        ring.style.transform = "scale(.4)";
        requestAnimationFrame(() => {
          ring.style.transition = "opacity 420ms ease-out, transform 420ms ease-out";
          ring.style.opacity = "0";
          ring.style.transform = "scale(1.35)";
        });
      },
      true,
    );
  };
  if (document.documentElement) mount();
  else document.addEventListener("DOMContentLoaded", mount);
}

/**
 * A fontconfig file that adds `FEATURE_VIDEO_FONT_DIRS` on top of the system
 * configuration, handed to the browser process only. Nothing on the host
 * changes. A host with no CJK or emoji fonts renders those rows as boxes
 * without it.
 */
function fontEnv(outDir: string): Record<string, string> {
  const dirs = (process.env.FEATURE_VIDEO_FONT_DIRS ?? "").split(":").filter(Boolean);
  if (dirs.length === 0) return {};
  const conf = join(outDir, "fonts.conf");
  const system = process.env.FONTCONFIG_FILE ?? "/etc/fonts/fonts.conf";
  writeFileSync(
    conf,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n` +
      `  <include ignore_missing="yes">${system}</include>\n` +
      dirs.map((dir) => `  <dir>${dir}</dir>\n`).join("") +
      `  <cachedir>${join(outDir, "fontconfig-cache")}</cachedir>\n</fontconfig>\n`,
  );
  return { FONTCONFIG_FILE: conf };
}
