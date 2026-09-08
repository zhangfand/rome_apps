import { createWriteStream } from "node:fs";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createAppLogger } from "@rome-os/app-runtime";
import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createPlayscriptsRepository } from "../../db/repositories/playscripts.js";
import { createProjectsRepository } from "../../db/repositories/projects.js";
import { createRunsRepository } from "../../db/repositories/runs.js";
import { findFfmpeg } from "../../lib/media.js";
import { mixNarration } from "../../lib/mixer.js";
import { appDataDir, runDir } from "../../lib/paths.js";
import { recordPlayscript } from "../../lib/recorder.js";
import type { RunFile, RunReport } from "../../lib/types.js";

const log = createAppLogger("feature_video_record");

/** The artifacts a run can produce, and how the API labels each one. */
const ARTIFACTS: Array<{ name: string; kind: RunFile["kind"] }> = [
  { name: "recording.mp4", kind: "video" },
  { name: "narrated.mp4", kind: "narrated" },
  { name: "narration.srt", kind: "srt" },
  { name: "narration.txt", kind: "text" },
  { name: "lines.txt", kind: "text" },
  { name: "cues.json", kind: "cues" },
  { name: "run.log", kind: "log" },
];

/** Every artifact that exists in `dir`, with its size. A run that failed early has few. */
function artifactsIn(dir: string): RunFile[] {
  const files: RunFile[] = [];
  for (const { name, kind } of ARTIFACTS) {
    try {
      files.push({ name, kind, bytes: statSync(join(dir, name)).size });
    } catch {
      // The run did not get far enough to write this one.
    }
  }
  return files;
}

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        runId: {
          type: "string",
          description: "Id of a queued run to record. Create the run first, then pass its id.",
        },
      },
      required: ["runId"],
      additionalProperties: false,
    },
    async execute(input: Record<string, unknown>): Promise<ActionResult> {
      const runId = input.runId;
      if (typeof runId !== "string" || !runId) {
        return { status: "error", error: "A run id is required." };
      }
      const runs = createRunsRepository(appContext.db);
      const run = await runs.byId(runId);
      if (!run) return { status: "error", error: `No run with id "${runId}".` };
      // Only a run nothing has picked up yet is recordable. A second execution
      // of the same id would write over the first one's directory, so this one
      // leaves the row exactly as it found it.
      if (run.status !== "queued") {
        return { status: "error", error: `Run "${runId}" is already ${run.status}.` };
      }

      const playscript = await createPlayscriptsRepository(appContext.db).byId(run.playscriptId);
      if (!playscript) {
        await runs.updateStatus(runId, "failed", `No playscript with id "${run.playscriptId}".`);
        return { status: "error", error: `No playscript with id "${run.playscriptId}".` };
      }
      const project = await createProjectsRepository(appContext.db).byId(playscript.projectId);
      if (!project) {
        await runs.updateStatus(runId, "failed", `No project with id "${playscript.projectId}".`);
        return { status: "error", error: `No project with id "${playscript.projectId}".` };
      }

      const dir = run.dir || runDir(runId);
      mkdirSync(dir, { recursive: true });
      const logFile = createWriteStream(join(dir, "run.log"), { flags: "a" });
      const write = (line: string) => {
        logFile.write(`${new Date().toISOString()} ${line}\n`);
      };
      // The log's own size goes in the file list, so the stream is flushed
      // before the directory is read.
      const closeLog = () => new Promise<void>((resolve) => logFile.end(resolve));
      await runs.updateStatus(runId, "running");

      try {
        const clipsDir = join(appDataDir(), "clips", playscript.id);
        write(`Recording playscript "${playscript.name}" of project "${project.name}"`);
        const result = await recordPlayscript({
          project,
          startPath: playscript.startPath,
          doc: playscript.doc,
          outDir: dir,
          clipsDir,
          log: write,
        });
        // The grab is on disk and playable now, so the file list is written
        // before the mux rather than only at the end: the run page offers the
        // recording while the narration is still being muxed in.
        await runs.setFiles(runId, artifactsIn(dir));

        const ffmpeg = findFfmpeg();
        if (ffmpeg) {
          mixNarration({
            video: result.video,
            cues: result.cues,
            clips: result.clips,
            clipsDir,
            outDir: dir,
            ffmpeg,
            log: write,
          });
        } else {
          write("No ffmpeg, so the narration was not muxed in.");
        }

        write(`Done in ${result.durationSeconds.toFixed(1)}s, ${result.late} late gesture(s)`);
        await closeLog();
        const files = artifactsIn(dir);
        const report: RunReport = {
          cues: result.cues,
          late: result.late,
          durationSeconds: result.durationSeconds,
          files,
        };
        await runs.setFiles(runId, files);
        await runs.setReport(runId, report);
        await runs.updateStatus(runId, "done");
        log.info("run finished", { runId, late: result.late });
        return { status: "ok", data: { runId, status: "done", report } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        write(`Failed: ${message}`);
        await closeLog();
        // The grab up to the failure is still worth keeping, so whatever
        // landed on disk is recorded before the run is marked failed.
        await runs.setFiles(runId, artifactsIn(dir));
        await runs.updateStatus(runId, "failed", message);
        log.error("run failed", { runId, error: message });
        return { status: "error", error: message };
      }
    },
  };
}
