# Feature Video

Records a narrated walkthrough of a web app. A playscript names the elements on
the page and pairs each narrated line with the gestures that go with it; a run
stages the script in a headed browser on a virtual display, captures the screen,
and muxes the recording with a subtitle track built from the narration.

## Using it

The app opens on its projects. Picking one lists its playscripts and shows the
stage the project frames — base URL, the target that proves the app has loaded,
the layout and video sizes, the frame rate, the timezone and locale a run reports.

A playscript opens in its own page at `/apps/feature-video/playscripts/<id>`:
the name, the path the run starts on, and the document itself as JSON. **Check**
saves it and prints the script back with each cue's gestures beside the words
they fire on, plus anything wrong with it. **Record** creates a run and lands on
`/apps/feature-video/runs/<id>`, which follows the recording to `done` or
`failed`, plays the narrated cut, lists every artifact to download, and prints
the cue sheet with the second each gesture was planned for against the second
the hand actually moved.

An empty database seeds one project, "Rome dashboard", and the People
walkthrough as its playscript. Set `FEATURE_VIDEO_SEED_BASE_URL` to point that
project somewhere other than `http://localhost:3200`.

## API

Mounted at `/api/apps/feature-video/`. Everything is JSON but the artifacts.

| Route | What it does |
| --- | --- |
| `GET /projects`, `POST /projects`, `PUT /projects/:id` | The stages to record against. |
| `GET /playscripts?projectId=`, `GET|PUT|DELETE /playscripts/:id`, `POST /playscripts` | The scripts. |
| `POST /playscripts/:id/check` | `{ problems, script }` — the checker's findings and the printout. |
| `POST /playscripts/:id/runs` | Creates a queued run and dispatches `feature-video:record`. 409 while a run of that playscript is queued or running. |
| `GET /runs?playscriptId=`, `GET /runs/:id` | Run status, report, and file list. |
| `GET /runs/:id/files/:name` | Streams one artifact, with `Range` support so the player can seek. A range past the end of the file is answered with 416. |

An artifact is served only under the name the run itself recorded, so the route
takes no path from the caller.

## Storage

Recordings, subtitles, and logs are written per run to
`~/.rome/<profile>/apps/data/feature-video/runs/<run-id>/`. Projects,
playscripts, and run reports live in the system SQLite under the
`feature_video__` table prefix.

## What the runtime needs

A run drives a real browser and a real encoder, so the machine the daemon runs
on needs `ffmpeg`, `ffprobe`, `Xvfb`, a Chromium binary, and the Noto and
Liberation font families — without the fonts the recording renders different
text than the dashboard does. Each binary is taken from `FEATURE_VIDEO_FFMPEG`,
`FEATURE_VIDEO_FFPROBE`, `FEATURE_VIDEO_XVFB` or `FEATURE_VIDEO_CHROMIUM` when
set and from PATH otherwise, and a run fails before it opens the browser when
one is missing, naming the variable that would point at it.

## Building

```sh
pnpm install
pnpm build
pnpm test
```

Then install the built app into the running daemon with the `app_management`
action, `{ "op": "install", "source": { "mode": "source", "path": "<abs path to
this directory>" } }`. Every install rebuilds and repacks, so the same call
ships later edits.
