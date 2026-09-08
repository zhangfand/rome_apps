// The app's HTTP surface: projects and playscripts as CRUD, a check that runs
// the playscript through the checker without a browser, run creation, and the
// run's artifacts streamed back to the player in the web UI.
//
// Every write validates its body here rather than trusting the caller, because
// a malformed playscript reaches the recorder as a browser session that fails
// a minute in.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import { createPlayscriptsRepository } from "../db/repositories/playscripts.js";
import { createProjectsRepository, type NewProject } from "../db/repositories/projects.js";
import { createRunsRepository } from "../db/repositories/runs.js";
import { checkPlayscript, formatPlay } from "../lib/checker.js";
import { runDir } from "../lib/paths.js";
import { ensureSeed } from "../lib/seed.js";
import type { PlayscriptDoc, TargetSpec } from "../lib/types.js";

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function badRequest(message: string): Response {
  return json({ error: "invalid_request", message }, { status: 400 });
}

type JsonBody = { ok: true; value: unknown } | { ok: false; reason: "empty" | "parse_error" };

function readJsonBody(request: RomeAppApiRequest): JsonBody {
  if (!request.body || request.body.byteLength === 0) return { ok: false, reason: "empty" };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(request.body)) };
  } catch {
    return { ok: false, reason: "parse_error" };
  }
}

/** A JSON object body, or the message explaining why it is not one. */
function readObjectBody(
  request: RomeAppApiRequest,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const parsed = readJsonBody(request);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.reason === "empty" ? "a JSON body is required" : "the body is not valid JSON",
    };
  }
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return { ok: false, message: "the body must be a JSON object" };
  }
  return { ok: true, value: parsed.value as Record<string, unknown> };
}

/** `"<width>x<height>"`, the form both `layout` and `video` take. */
const SIZE = /^\d{2,5}x\d{2,5}$/;

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** A target spec is checked for its selector key only; the checker owns the rest. */
function isTargetSpec(value: unknown): value is TargetSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = ["role", "label", "text", "placeholder", "testId", "css", "xpath"];
  return keys.some((key) => typeof (value as Record<string, unknown>)[key] === "string");
}

/** Shape-checks a playscript document. Its consistency is the checker's answer, not this one's. */
function isPlayscriptDoc(value: unknown): value is PlayscriptDoc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const doc = value as Record<string, unknown>;
  if (!doc.targets || typeof doc.targets !== "object" || Array.isArray(doc.targets)) return false;
  return Array.isArray(doc.beats);
}

/** The project fields a body may carry, defaults applied. Returns the message when one is wrong. */
function readProjectInput(
  body: Record<string, unknown>,
): { ok: true; value: NewProject } | { ok: false; message: string } {
  if (!nonEmptyString(body.name)) return { ok: false, message: "name is required" };
  if (!nonEmptyString(body.baseUrl)) return { ok: false, message: "baseUrl is required" };
  if (!isTargetSpec(body.readyTarget)) {
    return { ok: false, message: "readyTarget must be a target spec, e.g. { role, name }" };
  }
  const patch = readProjectPatch(body);
  if (!patch.ok) return patch;
  return {
    ok: true,
    value: {
      name: body.name.trim(),
      baseUrl: body.baseUrl.trim(),
      readyTarget: body.readyTarget,
      stageSelector: patch.value.stageSelector,
      layout: patch.value.layout ?? "1280x720",
      video: patch.value.video ?? "3840x2160",
      fps: patch.value.fps ?? 60,
      timezone: patch.value.timezone,
      locale: patch.value.locale,
    },
  };
}

/** The subset of project fields a body actually sets, so a PUT leaves the rest alone. */
function readProjectPatch(
  body: Record<string, unknown>,
): { ok: true; value: Partial<NewProject> } | { ok: false; message: string } {
  const patch: Partial<NewProject> = {};
  if (body.name !== undefined) {
    if (!nonEmptyString(body.name))
      return { ok: false, message: "name must be a non-empty string" };
    patch.name = body.name.trim();
  }
  if (body.baseUrl !== undefined) {
    if (!nonEmptyString(body.baseUrl)) {
      return { ok: false, message: "baseUrl must be a non-empty string" };
    }
    patch.baseUrl = body.baseUrl.trim();
  }
  if (body.readyTarget !== undefined) {
    if (!isTargetSpec(body.readyTarget)) {
      return { ok: false, message: "readyTarget must be a target spec, e.g. { role, name }" };
    }
    patch.readyTarget = body.readyTarget;
  }
  if (body.stageSelector !== undefined) {
    if (body.stageSelector !== null && typeof body.stageSelector !== "string") {
      return { ok: false, message: "stageSelector must be a CSS selector or null" };
    }
    patch.stageSelector = nonEmptyString(body.stageSelector)
      ? body.stageSelector.trim()
      : undefined;
  }
  for (const field of ["layout", "video"] as const) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string" || !SIZE.test(body[field])) {
      return { ok: false, message: `${field} must read "<width>x<height>", e.g. "1280x720"` };
    }
    patch[field] = body[field];
  }
  if (body.fps !== undefined) {
    if (typeof body.fps !== "number" || !Number.isFinite(body.fps) || body.fps <= 0) {
      return { ok: false, message: "fps must be a positive number" };
    }
    patch.fps = Math.round(body.fps);
  }
  for (const field of ["timezone", "locale"] as const) {
    if (body[field] === undefined) continue;
    if (body[field] !== null && typeof body[field] !== "string") {
      return { ok: false, message: `${field} must be a string or null` };
    }
    patch[field] = nonEmptyString(body[field]) ? body[field].trim() : undefined;
  }
  return { ok: true, value: patch };
}

/** What the browser is told each artifact is, so the player and the download both work. */
function contentTypeFor(name: string): string {
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".srt")) return "text/plain; charset=utf-8";
  if (name.endsWith(".txt") || name.endsWith(".log")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

/**
 * The byte interval a `Range` header asks for, clamped to the file.
 *
 * Returns null when the header asks for no range or is not a form this route
 * understands, which the caller answers with the whole file, and
 * `"unsatisfiable"` when it names bytes the file does not have, which the
 * caller answers with 416.
 *
 * parseRange("bytes=0-99", 500) returns { start: 0, end: 99 };
 * parseRange("bytes=900-", 500) returns "unsatisfiable".
 */
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  // A suffix range ("bytes=-500") asks for the last N bytes.
  const start = rawStart === "" ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === "" || rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return "unsatisfiable";
  return { start, end };
}

/** One header by name, whatever case the host handed it over in. */
function header(request: RomeAppApiRequest, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(request.headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function fileStream(path: string, range?: { start: number; end: number }): ReadableStream {
  const stream = createReadStream(path, range);
  return Readable.toWeb(stream) as unknown as ReadableStream;
}

/**
 * The seed runs once per process. The host builds a handler per request, so the
 * promise lives in the module rather than on the handler: two requests that
 * arrive together share one seed instead of each inserting the project. A seed
 * that rejects is forgotten, so the next request tries again.
 */
let seeding: Promise<void> | null = null;

function seedOnce(db: RomeAppContext["db"]): Promise<void> {
  seeding ??= ensureSeed(db).catch((err: unknown) => {
    seeding = null;
    throw err;
  });
  return seeding;
}

class FeatureVideoApiHandler implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    const { method, path } = request;
    const route = path.join("/");

    if (method === "GET" && path.length === 0) {
      return json({ appId: this.ctx.app.id, version: this.ctx.app.version, status: "ok" });
    }

    await seedOnce(this.ctx.db);

    if (route === "projects") {
      if (method === "GET") return this.listProjects();
      if (method === "POST") return this.createProject(request);
    }
    if (path[0] === "projects" && path.length === 2 && method === "PUT") {
      return this.updateProject(path[1], request);
    }

    if (route === "playscripts") {
      if (method === "GET") return this.listPlayscripts(request);
      if (method === "POST") return this.createPlayscript(request);
    }
    if (path[0] === "playscripts" && path.length === 2) {
      if (method === "GET") return this.readPlayscript(path[1]);
      if (method === "PUT") return this.updatePlayscript(path[1], request);
      if (method === "DELETE") return this.deletePlayscript(path[1]);
    }
    if (method === "POST" && path[0] === "playscripts" && path.length === 3) {
      if (path[2] === "check") return this.checkStoredPlayscript(path[1]);
      if (path[2] === "runs") return this.startRun(path[1]);
    }

    if (method === "GET" && route === "runs") return this.listRuns(request);
    if (method === "GET" && path[0] === "runs" && path.length === 2) return this.readRun(path[1]);
    if (method === "GET" && path[0] === "runs" && path[2] === "files" && path.length === 4) {
      return this.readRunFile(path[1], path[3], request);
    }

    return json(
      { error: "not_found", message: `Unknown Feature Video API route: ${method} /${route}` },
      { status: 404 },
    );
  }

  private async listProjects(): Promise<Response> {
    return json({ projects: await createProjectsRepository(this.ctx.db).list() });
  }

  private async createProject(request: RomeAppApiRequest): Promise<Response> {
    const body = readObjectBody(request);
    if (!body.ok) return badRequest(body.message);
    const input = readProjectInput(body.value);
    if (!input.ok) return badRequest(input.message);
    const project = await createProjectsRepository(this.ctx.db).insert(input.value);
    return json({ project }, { status: 201 });
  }

  private async updateProject(id: string, request: RomeAppApiRequest): Promise<Response> {
    const body = readObjectBody(request);
    if (!body.ok) return badRequest(body.message);
    const patch = readProjectPatch(body.value);
    if (!patch.ok) return badRequest(patch.message);
    const project = await createProjectsRepository(this.ctx.db).update(id, patch.value);
    if (!project) return json({ error: "not_found" }, { status: 404 });
    return json({ project });
  }

  private async listPlayscripts(request: RomeAppApiRequest): Promise<Response> {
    const repo = createPlayscriptsRepository(this.ctx.db);
    const projectId = request.query.get("projectId");
    const playscripts = projectId ? await repo.listForProject(projectId) : await repo.list();
    return json({ playscripts });
  }

  private async readPlayscript(id: string): Promise<Response> {
    const playscript = await createPlayscriptsRepository(this.ctx.db).byId(id);
    if (!playscript) return json({ error: "not_found" }, { status: 404 });
    return json({ playscript });
  }

  private async createPlayscript(request: RomeAppApiRequest): Promise<Response> {
    const body = readObjectBody(request);
    if (!body.ok) return badRequest(body.message);
    const { projectId, name, startPath, doc } = body.value;
    if (!nonEmptyString(projectId)) return badRequest("projectId is required");
    if (!nonEmptyString(name)) return badRequest("name is required");
    if (startPath !== undefined && typeof startPath !== "string") {
      return badRequest("startPath must be a string");
    }
    if (!isPlayscriptDoc(doc)) {
      return badRequest("doc must be an object with `targets` and a `beats` array");
    }
    const project = await createProjectsRepository(this.ctx.db).byId(projectId);
    if (!project) return badRequest(`no project with id "${projectId}"`);
    const playscript = await createPlayscriptsRepository(this.ctx.db).insert({
      projectId,
      name: name.trim(),
      startPath: nonEmptyString(startPath) ? startPath.trim() : "/",
      doc,
    });
    return json({ playscript }, { status: 201 });
  }

  private async updatePlayscript(id: string, request: RomeAppApiRequest): Promise<Response> {
    const body = readObjectBody(request);
    if (!body.ok) return badRequest(body.message);
    const { name, startPath, doc } = body.value;
    const patch: { name?: string; startPath?: string; doc?: PlayscriptDoc } = {};
    if (name !== undefined) {
      if (!nonEmptyString(name)) return badRequest("name must be a non-empty string");
      patch.name = name.trim();
    }
    if (startPath !== undefined) {
      if (!nonEmptyString(startPath)) return badRequest("startPath must be a non-empty string");
      patch.startPath = startPath.trim();
    }
    if (doc !== undefined) {
      if (!isPlayscriptDoc(doc)) {
        return badRequest("doc must be an object with `targets` and a `beats` array");
      }
      patch.doc = doc;
    }
    const playscript = await createPlayscriptsRepository(this.ctx.db).update(id, patch);
    if (!playscript) return json({ error: "not_found" }, { status: 404 });
    return json({ playscript });
  }

  private async deletePlayscript(id: string): Promise<Response> {
    const removed = await createPlayscriptsRepository(this.ctx.db).remove(id);
    if (!removed) return json({ error: "not_found" }, { status: 404 });
    return json({ removed: true });
  }

  private async checkStoredPlayscript(id: string): Promise<Response> {
    const playscript = await createPlayscriptsRepository(this.ctx.db).byId(id);
    if (!playscript) return json({ error: "not_found" }, { status: 404 });
    return json({
      problems: checkPlayscript(playscript.doc),
      script: formatPlay(playscript.doc, { clips: null }),
    });
  }

  /**
   * Creates the run row the recorder picks up, then hands the recording off as
   * a detached execution: the recording outlives the request, and the browser
   * follows it through the run row rather than through an open connection.
   *
   * One playscript records at a time — a second run would drive the same app
   * through the same script — so a playscript that already has a queued or
   * running one is answered with 409.
   */
  private async startRun(playscriptId: string): Promise<Response> {
    const playscript = await createPlayscriptsRepository(this.ctx.db).byId(playscriptId);
    if (!playscript) return json({ error: "not_found" }, { status: 404 });

    const runs = createRunsRepository(this.ctx.db);
    const active = (await runs.listForPlayscript(playscriptId)).find(
      (candidate) => candidate.status === "queued" || candidate.status === "running",
    );
    if (active) {
      return json(
        {
          error: "run_in_progress",
          message: `run ${active.id} of this playscript is still ${active.status}`,
          run: active,
        },
        { status: 409 },
      );
    }

    // The id is minted here so the row and its directory on disk agree.
    const id = crypto.randomUUID();
    const run = await runs.insert({ id, playscriptId, dir: runDir(id) });

    try {
      const receipt = await this.ctx.runAction(
        "feature-video:record",
        { runId: run.id },
        { detached: true },
      );
      return json({ run, executionId: receipt.executionId }, { status: 201 });
    } catch (err) {
      // The row is already there and nothing will pick it up, so it is marked
      // failed here rather than left queued forever.
      const message = err instanceof Error ? err.message : String(err);
      await runs.updateStatus(run.id, "failed", message);
      return json({ error: "run_not_started", message }, { status: 500 });
    }
  }

  private async listRuns(request: RomeAppApiRequest): Promise<Response> {
    const repo = createRunsRepository(this.ctx.db);
    const playscriptId = request.query.get("playscriptId");
    const runs = playscriptId ? await repo.listForPlayscript(playscriptId) : await repo.list();
    return json({ runs });
  }

  private async readRun(id: string): Promise<Response> {
    const run = await createRunsRepository(this.ctx.db).byId(id);
    if (!run) return json({ error: "not_found" }, { status: 404 });
    return json({ run });
  }

  /**
   * Streams one artifact. The name is looked up in the run's own file list
   * rather than joined onto the run directory, so a traversal has nothing to
   * match and a file the run never wrote stays a 404.
   */
  private async readRunFile(
    id: string,
    name: string,
    request: RomeAppApiRequest,
  ): Promise<Response> {
    const run = await createRunsRepository(this.ctx.db).byId(id);
    if (!run) return json({ error: "not_found" }, { status: 404 });
    let wanted = name;
    try {
      wanted = decodeURIComponent(name);
    } catch {
      // A name the router already decoded can hold a stray `%`; match it raw.
    }
    const listed = run.files.find((file) => file.name === wanted);
    if (!listed) return json({ error: "not_found" }, { status: 404 });

    const path = join(runDir(run.id), listed.name);
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      return json({ error: "not_found" }, { status: 404 });
    }

    const contentType = contentTypeFor(listed.name);
    const range = parseRange(header(request, "range"), size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
      });
    }
    if (range) {
      return new Response(fileStream(path, range), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(range.end - range.start + 1),
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
    return new Response(fileStream(path), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
      },
    });
  }
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new FeatureVideoApiHandler(ctx);
}
