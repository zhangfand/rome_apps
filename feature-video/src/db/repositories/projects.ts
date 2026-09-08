import { asc, eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import type { ProjectSettings, TargetSpec } from "../../lib/types.js";
import { createAppDbSchema } from "../schema.js";

/** A project row with `readyTargetJson` already decoded. */
export interface Project extends ProjectSettings {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewProject = Omit<Project, "id" | "createdAt" | "updatedAt">;

export type ProjectPatch = Partial<NewProject>;

interface ProjectRow {
  id: string;
  name: string;
  baseUrl: string;
  readyTargetJson: string;
  stageSelector: string | null;
  layout: string;
  video: string;
  fps: number;
  timezone: string | null;
  locale: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function decode(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    readyTarget: JSON.parse(row.readyTargetJson) as TargetSpec,
    stageSelector: row.stageSelector ?? undefined,
    layout: row.layout,
    video: row.video,
    fps: row.fps,
    timezone: row.timezone ?? undefined,
    locale: row.locale ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Reads and writes projects. JSON columns are decoded here, so callers only see `ProjectSettings` shapes. */
export class ProjectsRepository {
  private readonly tables;

  constructor(
    private readonly db: DrizzleDb,
    tablePrefix: string,
  ) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  /** Oldest first, so the seeded project stays at the top of the list. */
  async list(): Promise<Project[]> {
    const rows = this.db
      .select()
      .from(this.tables.projects)
      .orderBy(asc(this.tables.projects.createdAt))
      .all() as ProjectRow[];
    return rows.map(decode);
  }

  async byId(id: string): Promise<Project | undefined> {
    const row = this.db
      .select()
      .from(this.tables.projects)
      .where(eq(this.tables.projects.id, id))
      .get() as ProjectRow | undefined;
    return row ? decode(row) : undefined;
  }

  async insert(input: NewProject): Promise<Project> {
    const now = new Date();
    const project: Project = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.db
      .insert(this.tables.projects)
      .values({
        id: project.id,
        name: project.name,
        baseUrl: project.baseUrl,
        readyTargetJson: JSON.stringify(project.readyTarget),
        stageSelector: project.stageSelector ?? null,
        layout: project.layout,
        video: project.video,
        fps: project.fps,
        timezone: project.timezone ?? null,
        locale: project.locale ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return project;
  }

  /** Returns the updated project, or undefined when no project has that id. */
  async update(id: string, patch: ProjectPatch): Promise<Project | undefined> {
    const existing = await this.byId(id);
    if (!existing) return undefined;
    const next: Project = { ...existing, ...patch, updatedAt: new Date() };
    this.db
      .update(this.tables.projects)
      .set({
        name: next.name,
        baseUrl: next.baseUrl,
        readyTargetJson: JSON.stringify(next.readyTarget),
        stageSelector: next.stageSelector ?? null,
        layout: next.layout,
        video: next.video,
        fps: next.fps,
        timezone: next.timezone ?? null,
        locale: next.locale ?? null,
        updatedAt: next.updatedAt,
      })
      .where(eq(this.tables.projects.id, id))
      .run();
    return next;
  }

  /** Leaves the project's playscripts in place; the caller deletes them first when it wants them gone. */
  async remove(id: string): Promise<boolean> {
    const existing = await this.byId(id);
    if (!existing) return false;
    this.db.delete(this.tables.projects).where(eq(this.tables.projects.id, id)).run();
    return true;
  }
}

export function createProjectsRepository(ctx: AppDbContext): ProjectsRepository {
  return new ProjectsRepository(ctx.connection, ctx.tablePrefix);
}
