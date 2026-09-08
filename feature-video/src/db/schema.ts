import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Feature Video data model. A project frames a stage, a playscript describes
 * what to narrate and do on it, and a run is one recording of a playscript.
 * Logical names only; the daemon joins the `feature_video__` prefix.
 *
 * JSON-valued columns are stored as text and named `<field>Json`, because the
 * shapes they hold (`TargetSpec`, `PlayscriptDoc`, `RunReport`, `RunFile[]` in
 * `src/lib/types.ts`) are versioned by the app, not by a migration.
 */
export function createAppDbSchema(tablePrefix: string = "feature_video") {
  // A web app to record, plus how its stage is framed. `ProjectSettings`.
  const projects = sqliteTable(`${tablePrefix}__projects`, {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Origin every playscript path resolves against. */
    baseUrl: text("base_url").notNull(),
    /** `TargetSpec` the recorder waits for before the first beat. */
    readyTargetJson: text("ready_target_json").notNull(),
    /** CSS selector for the element that fills the frame; null means the first element child of `body`. */
    stageSelector: text("stage_selector"),
    layout: text("layout").notNull().default("1280x720"),
    video: text("video").notNull().default("3840x2160"),
    fps: integer("fps").notNull().default(60),
    timezone: text("timezone"),
    locale: text("locale"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  });

  // One script for a project: where to start, and the beats to play.
  const playscripts = sqliteTable(
    `${tablePrefix}__playscripts`,
    {
      id: text("id").primaryKey(),
      projectId: text("project_id").notNull(),
      name: text("name").notNull(),
      /** Path appended to the project `baseUrl` before the first beat, e.g. "/people/latest". */
      startPath: text("start_path").notNull().default("/"),
      /** `PlayscriptDoc`. */
      docJson: text("doc_json").notNull(),
      createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
      updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    },
    (t) => [index(`${tablePrefix}__playscripts_project_idx`).on(t.projectId)],
  );

  // One recording of a playscript. `RunStatus`.
  const runs = sqliteTable(
    `${tablePrefix}__runs`,
    {
      id: text("id").primaryKey(),
      playscriptId: text("playscript_id").notNull(),
      /** "queued" | "running" | "done" | "failed" */
      status: text("status").notNull().default("queued"),
      /** Absolute path to the run's output directory. */
      dir: text("dir").notNull(),
      /** `RunReport`; null until the run finishes. */
      reportJson: text("report_json"),
      /** `RunFile[]`; written as artifacts land, so it is populated before the run finishes. */
      filesJson: text("files_json"),
      error: text("error"),
      startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
      finishedAt: integer("finished_at", { mode: "timestamp" }),
    },
    (t) => [
      index(`${tablePrefix}__runs_playscript_idx`).on(t.playscriptId),
      index(`${tablePrefix}__runs_status_idx`).on(t.status),
    ],
  );

  return { projects, playscripts, runs };
}

const defaultSchema = createAppDbSchema();

export const projects = defaultSchema.projects;
export const playscripts = defaultSchema.playscripts;
export const runs = defaultSchema.runs;
