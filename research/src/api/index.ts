import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { RomeAppApiHandler, RomeAppApiRequest, RomeAppContext } from "@rome-os/app-runtime";
import {
  createTopic,
  getConversation,
  getNote,
  getSource,
  getTopic,
  listConversations,
  listNotes,
  listSources,
  listTopics,
  renameTopic,
  saveNote,
  saveSource,
  search,
  sourceFilePath,
  updateBrief,
  updateSourceMeta,
} from "../lib/store.js";
import { topicProjectPath } from "../lib/paths.js";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/plain; charset=utf-8", // never render saved pages inside the app origin
  ".htm": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function notFound(what = "not_found"): Response {
  return json({ error: what }, { status: 404 });
}

function header(request: RomeAppApiRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(request.headers)) if (k.toLowerCase() === lower) return v;
  return undefined;
}

function readJson(request: RomeAppApiRequest): Record<string, unknown> | null {
  if (!request.body || request.body.byteLength === 0) return {};
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(request.body));
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function s(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

class ResearchApi implements RomeAppApiHandler {
  constructor(private readonly ctx: RomeAppContext) {}

  async handle(request: RomeAppApiRequest): Promise<Response> {
    try {
      return await this.route(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = /not found/i.test(message) ? 404 : /invalid|required|needs/i.test(message) ? 400 : 500;
      if (status === 500) this.ctx.log.error("research api error", { error: message, path: request.path.join("/") });
      return json({ error: message }, { status });
    }
  }

  private async route(request: RomeAppApiRequest): Promise<Response> {
    const p = request.path.map((seg) => decodeURIComponent(seg));
    const m = request.method;

    if (m === "GET" && p.length === 1 && p[0] === "search") {
      const q = request.query.get("q") ?? "";
      const topic = request.query.get("topic") ?? undefined;
      return json({ hits: await search(q, { slug: topic || undefined, limit: 100 }) });
    }

    if (p[0] !== "topics") return notFound();

    if (p.length === 1) {
      if (m === "GET") return json({ topics: await listTopics() });
      if (m === "POST") {
        const body = readJson(request);
        if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
        const title = s(body.title);
        if (!title) return json({ error: "title required" }, { status: 400 });
        const topic = await createTopic({ title, question: s(body.question) });
        return json({ topic }, { status: 201 });
      }
    }

    const slug = p[1]!;

    if (p.length === 2) {
      if (m === "GET") {
        const topic = await getTopic(slug);
        return topic ? json({ topic, projectPath: topicProjectPath(slug) }) : notFound("topic not found");
      }
      if (m === "PATCH") {
        const body = readJson(request);
        const title = body && s(body.title);
        if (!title) return json({ error: "title required" }, { status: 400 });
        await renameTopic(slug, title);
        return json({ ok: true });
      }
    }

    if (p.length === 3 && p[2] === "brief" && m === "PUT") {
      const body = readJson(request);
      if (!body || typeof body.brief !== "string") return json({ error: "brief required" }, { status: 400 });
      await updateBrief(slug, body.brief, "手动编辑了课题状态");
      return json({ ok: true });
    }

    // Conversations
    if (p[2] === "conversations") {
      if (p.length === 3 && m === "GET") return json({ conversations: await listConversations(slug) });
      if (p.length === 4 && m === "GET") {
        const c = await getConversation(slug, p[3]!);
        return c ? json({ conversation: c }) : notFound("conversation not found");
      }
    }

    // Sources
    if (p[2] === "sources") {
      if (p.length === 3 && m === "GET") return json({ sources: await listSources(slug) });
      if (p.length === 3 && m === "POST") return this.createSource(slug, request);
      if (p.length === 4 && m === "GET") {
        const src = await getSource(slug, p[3]!);
        return src ? json({ source: src }) : notFound("source not found");
      }
      if (p.length === 4 && m === "PATCH") {
        const body = readJson(request);
        if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
        const source = await updateSourceMeta(slug, p[3]!, {
          title: s(body.title),
          why: typeof body.why === "string" ? body.why : undefined,
          summary: typeof body.summary === "string" ? body.summary : undefined,
          tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
        });
        return json({ source });
      }
      if (p.length === 6 && p[4] === "files" && m === "GET") {
        const path = sourceFilePath(slug, p[3]!, p[5]!);
        const info = await stat(path).catch(() => null);
        if (!info?.isFile()) return notFound("file not found");
        const bytes = await readFile(path);
        const ext = extname(path).toLowerCase();
        const headers: Record<string, string> = {
          "content-type": MIME[ext] ?? "application/octet-stream",
          "content-length": String(bytes.byteLength),
          "x-content-type-options": "nosniff",
          "content-security-policy": "sandbox",
        };
        if (request.query.get("download") === "1") {
          headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(p[5]!)}`;
        }
        return new Response(bytes, { headers });
      }
    }

    // Notes
    if (p[2] === "notes") {
      if (p.length === 3 && m === "GET") return json({ notes: await listNotes(slug) });
      if (p.length === 3 && m === "POST") {
        const body = readJson(request);
        if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
        const note = await saveNote(slug, { title: s(body.title) ?? "Untitled", body: String(body.body ?? "") });
        return json({ note }, { status: 201 });
      }
      if (p.length === 4 && m === "GET") {
        const note = await getNote(slug, p[3]!);
        return note ? json({ note }) : notFound("note not found");
      }
      if (p.length === 4 && m === "PUT") {
        const body = readJson(request);
        if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
        const note = await saveNote(slug, { id: p[3]!, title: s(body.title) ?? "Untitled", body: String(body.body ?? "") });
        return json({ note });
      }
    }

    return notFound();
  }

  /** JSON body for links/text; raw bytes (with x-file-name header) for uploads. */
  private async createSource(slug: string, request: RomeAppApiRequest): Promise<Response> {
    const type = header(request, "content-type") ?? "";
    if (type.includes("application/json")) {
      const body = readJson(request);
      if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
      const source = await saveSource(slug, {
        title: s(body.title),
        url: s(body.url),
        why: s(body.why),
        summary: s(body.summary),
        content: s(body.content),
      });
      return json({ source }, { status: 201 });
    }
    if (!request.body || request.body.byteLength === 0) return json({ error: "file body required" }, { status: 400 });
    const rawName = header(request, "x-file-name");
    const fileName = rawName ? decodeURIComponent(rawName) : "upload";
    const source = await saveSource(slug, {
      fileBytes: request.body,
      fileName,
      title: s(request.query.get("title")),
      why: s(request.query.get("why")),
    });
    return json({ source }, { status: 201 });
  }
}

export function createApiHandler(ctx: RomeAppContext): RomeAppApiHandler {
  return new ResearchApi(ctx);
}
