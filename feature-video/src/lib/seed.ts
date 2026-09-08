// What the app opens on before a guardian has written anything: the Rome
// dashboard as a stage, and the People walkthrough as the playscript to record
// on it.

import type { AppDbContext } from "@rome-os/app-runtime";
import { createPlayscriptsRepository } from "../db/repositories/playscripts.js";
import { createProjectsRepository, type NewProject } from "../db/repositories/projects.js";
import { PEOPLE_PLAYSCRIPT } from "./people-playscript.js";

/** Where the seeded project points when the environment does not say. */
const DEFAULT_BASE_URL = "http://localhost:3200";

/** The Rome dashboard as a recording stage: the dashboard's own frame and clock. */
function seedProject(): NewProject {
  return {
    name: "Rome dashboard",
    baseUrl: process.env.FEATURE_VIDEO_SEED_BASE_URL ?? DEFAULT_BASE_URL,
    // The View switch only renders once the dashboard has its data.
    readyTarget: { role: "radiogroup", name: "View" },
    stageSelector: "#root",
    layout: "1280x720",
    video: "3840x2160",
    fps: 60,
    timezone: "America/Los_Angeles",
    locale: "en-US",
  };
}

/**
 * Puts the Rome dashboard project and the People playscript in an empty
 * database, so the app opens on something to record rather than an empty list.
 *
 * Emptiness is the whole condition: once a guardian owns a project, the seed
 * never writes again, and deleting the seeded one is a decision the app keeps.
 */
export async function ensureSeed(db: AppDbContext): Promise<void> {
  const projects = createProjectsRepository(db);
  if ((await projects.list()).length > 0) return;

  const project = await projects.insert(seedProject());
  await createPlayscriptsRepository(db).insert({
    projectId: project.id,
    name: "People",
    startPath: "/people/latest",
    doc: PEOPLE_PLAYSCRIPT,
  });
}
