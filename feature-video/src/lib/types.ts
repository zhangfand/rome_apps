// The playscript and run contract shared by the checker, the recorder, the
// mixer, the actions, the API handler, and the web UI. Every value here
// crosses a JSON boundary — the DB stores playscripts and run reports as
// text, and the API hands the same shapes to the browser — so nothing in this
// file may hold a class instance, a Date, or a function.

/**
 * How to find one element on the stage. Interpreted into a Playwright locator
 * by the recorder; the checker validates it without a browser.
 *
 * Exactly one of `role` / `label` / `text` / `placeholder` / `testId` / `css` /
 * `xpath` selects the element; the shared fields below narrow the match.
 * A playscript names targets, and every gesture refers to one by that name, so
 * a spec is written once and reused.
 *
 * `{ css: "div", has: { text: "Jules Marchetti", exact: true }, last: true }`
 * is the row of a named person: the innermost `div` that contains that text.
 */
export type TargetSpec =
  | RoleTarget
  | LabelTarget
  | TextTarget
  | PlaceholderTarget
  | TestIdTarget
  | CssTarget
  | XPathTarget;

/** Narrowing shared by every `TargetSpec` variant. */
interface TargetNarrowing {
  /** Name of another target to scope the search to. */
  within?: string;
  /** Zero-based index into the matches. Mutually exclusive with `last`. */
  nth?: number;
  /** Take the last match. Mutually exclusive with `nth`. */
  last?: boolean;
  /** Keep only matches that themselves contain this target. */
  has?: TargetSpec;
  /** Keep only matches whose text contains this substring. */
  hasText?: string;
}

/** An ARIA role, optionally narrowed by accessible name. */
export interface RoleTarget extends TargetNarrowing {
  role: string;
  name?: string;
  exact?: boolean;
}

/** A form control by its label text. */
export interface LabelTarget extends TargetNarrowing {
  label: string;
  exact?: boolean;
}

/** An element by its visible text. */
export interface TextTarget extends TargetNarrowing {
  text: string;
  exact?: boolean;
}

/** An input by its placeholder text. */
export interface PlaceholderTarget extends TargetNarrowing {
  placeholder: string;
  exact?: boolean;
}

/** An element by its `data-testid`. */
export interface TestIdTarget extends TargetNarrowing {
  testId: string;
}

/** An element by CSS selector. */
export interface CssTarget extends TargetNarrowing {
  css: string;
}

/** An element by XPath expression. */
export interface XPathTarget extends TargetNarrowing {
  xpath: string;
}

/**
 * One step the recorder performs on the stage. The first element is the verb;
 * a `string` argument that names an element is a key into
 * `PlayscriptDoc.targets`, never an inline spec.
 *
 * - `["show"]` — reset the view to the whole stage.
 * - `["focus", target, scale?]` — zoom the view onto a target; `scale` defaults
 *   to the recorder's own default.
 * - `["hover", target]` / `["click", target]` — move the cursor overlay there,
 *   then hover or click.
 * - `["type", text]` — type into whatever holds focus.
 * - `["press", key]` — press one key, in Playwright's key syntax ("Enter").
 * - `["wait", target]` — block until the target is visible.
 * - `["gone", target]` — block until the target is no longer visible.
 * - `["hold", ms]` — pause for `ms` milliseconds.
 * - `["scroll", target]` — scroll the stage until the target is in view.
 * - `["goto", path]` — navigate to a path relative to the project `baseUrl`,
 *   which resets the focus state to the whole stage.
 */
export type Gesture =
  | ["show"]
  | ["focus", string, number?]
  | ["hover", string]
  | ["click", string]
  | ["type", string]
  | ["press", string]
  | ["wait", string]
  | ["gone", string]
  | ["hold", number]
  | ["scroll", string]
  | ["goto", string];

/**
 * Gestures anchored to a point in the narration. `on` is a phrase to match
 * inside the beat's `line`, or `END` to fire once the line has been spoken.
 */
export interface Cue {
  on: string;
  do: Gesture[];
}

/** `Cue.on` value that anchors a cue to the end of its beat's line. */
export const END = "(end of line)";

/**
 * One narrated line and the gestures it drives. `id` is the base name of the
 * beat's audio clip (`<id>.mp3`, optional `<id>.words.json` alignment), so it
 * is unique within a playscript.
 */
export interface Beat {
  id: string;
  line: string;
  cues: Cue[];
}

/** A whole playscript: the named targets its gestures refer to, and the beats in order. */
export interface PlayscriptDoc {
  targets: Record<string, TargetSpec>;
  beats: Beat[];
}

/** How a project's stage is framed and recorded. Shared by every playscript in the project. */
export interface ProjectSettings {
  /** Origin every `["goto", path]` and the playscript `startPath` resolve against. */
  baseUrl: string;
  /** Target the recorder waits for before the first beat, proving the app has loaded. */
  readyTarget: TargetSpec;
  /** CSS selector for the element that fills the frame. Defaults to the first element child of `body`. */
  stageSelector?: string;
  /** Browser viewport, `"<width>x<height>"` — the CSS pixel grid the app lays out on. */
  layout: string;
  /** Recorded frame size, `"<width>x<height>"`. Its ratio to `layout` is the device scale factor. */
  video: string;
  fps: number;
  /** IANA timezone the browser reports, e.g. `"America/Los_Angeles"`. */
  timezone?: string;
  /** BCP 47 locale the browser reports, e.g. `"en-US"`. */
  locale?: string;
}

/**
 * One gesture as performed, for the run report. `planned` and `at` are
 * milliseconds from the start of the beat the gesture belongs to, not from the
 * start of the recording.
 */
export interface GestureRecord {
  /** The verb, i.e. `Gesture[0]`. */
  on: string;
  planned: number;
  at: number;
}

/** One cue as performed. `at` is milliseconds from the first recorded frame. */
export interface CueRecord {
  id: string;
  at: number;
  line: string;
  gestures: GestureRecord[];
}

/** What a finished run produced: every cue with its planned and actual timing, plus the artifacts on disk. */
export interface RunReport {
  cues: CueRecord[];
  /** How many gestures landed after their planned time by more than the recorder's tolerance. */
  late: number;
  durationSeconds: number;
  files: RunFile[];
}

/** One artifact in the run directory. `name` is a plain file name, never a path. */
export interface RunFile {
  name: string;
  kind: "video" | "narrated" | "srt" | "cues" | "text" | "log";
  bytes: number;
}

/** Lifecycle of a run. Only `done` and `failed` are terminal. */
export type RunStatus = "queued" | "running" | "done" | "failed";
