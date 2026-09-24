import { appendFile, copyFile, mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { parseFrontmatter, str, stringifyFrontmatter } from "./frontmatter.js";
import { assertSlug, isValidSlug, researchRoot, safeJoin, slugify, topicDir } from "./paths.js";
import { localDate, localStamp, nowIso } from "./time.js";
import { extractPdfText, htmlToText } from "./extract.js";

// ---------------------------------------------------------------------------
// Types

export type LogKind = "topic" | "conversation" | "source" | "note" | "brief";

export interface LogEntry {
  at: string;
  kind: string;
  text: string;
  link?: string;
}

export interface TopicCounts {
  conversations: number;
  sources: number;
  notes: number;
}

export interface TopicSummary {
  slug: string;
  title: string;
  created?: string;
  updated?: string;
  excerpt: string;
  counts: TopicCounts;
}

export interface TopicDetail extends TopicSummary {
  brief: string;
  log: LogEntry[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  sessionId?: string;
  started?: string;
  updated?: string;
  turns?: number;
  excerpt: string;
}

export interface ConversationDetail extends ConversationSummary {
  summary: string;
  transcript: string;
}

export type SourceKind = "pdf" | "url" | "code" | "image" | "text" | "file";

export interface SourceSummary {
  id: string;
  title: string;
  kind: SourceKind;
  url?: string;
  savedAt?: string;
  tags: string[];
  files: string[];
  excerpt: string;
}

export interface SourceDetail extends SourceSummary {
  body: string;
  fileInfo: Array<{ name: string; size: number }>;
  content?: string;
  contentTruncated?: boolean;
}

export interface NoteSummary {
  id: string;
  title: string;
  created?: string;
  updated?: string;
  excerpt: string;
}

export interface NoteDetail extends NoteSummary {
  body: string;
}

export interface SearchHit {
  slug: string;
  topicTitle: string;
  path: string;
  line: number;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Helpers

const TOPIC_FILE = "TOPIC.md";
const LOG_FILE = "log.md";
const SUBDIRS = ["conversations", "sources", "notes"] as const;
const CONTENT_FILE = "content.md";
const META_FILE = "meta.md";

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Write via temp file + rename so readers never observe a truncated file. */
async function writeAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${path}.tmp-${randomUUID()}`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cross-process per-topic lock (API handler, actions and the archive hook may run in
 * different workers). A `.lock` directory is created exclusively; stale locks (>30s) are
 * broken. Not re-entrant — never call a locked function from inside another.
 */
async function withTopicLock<T>(slug: string, fn: () => Promise<T>): Promise<T> {
  const lock = join(topicDir(slug), ".lock");
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      await mkdir(lock);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const info = await stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 30_000) {
        await rmdir(lock).catch(() => undefined);
        continue;
      }
      if (Date.now() > deadline) throw new Error(`Topic is busy: ${slug}`);
      await sleep(20 + Math.random() * 30);
    }
  }
  try {
    return await fn();
  } finally {
    await rmdir(lock).catch(() => undefined);
  }
}

async function listDirs(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

async function listFiles(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function excerpt(markdown: string, max = 180): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/[*_`>#-]+/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function nextNumberedId(existing: string[], title: string, fallback: string): string {
  let max = 0;
  for (const name of existing) {
    const n = Number.parseInt(name.slice(0, 4), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${String(max + 1).padStart(4, "0")}-${slugify(title, fallback, true)}`;
}

function assertChildId(id: string): string {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,160}$/u.test(id)) throw new Error(`Invalid id: ${id}`);
  return id;
}

// ---------------------------------------------------------------------------
// Topics

export async function ensureResearchRoot(): Promise<string> {
  const root = researchRoot();
  await mkdir(root, { recursive: true });
  const readme = join(root, "README.md");
  if (!existsSync(readme)) {
    await writeFile(
      readme,
      [
        "# Research",
        "",
        "Each folder here is one long-running research topic managed by the Research app.",
        "",
        "- `TOPIC.md` — what the topic is and where it stands (the agent reads this first)",
        "- `log.md` — timeline of conversations, saved sources, notes",
        "- `conversations/` — per-chat summary and full transcript",
        "- `sources/` — saved material of any type, each with a `meta.md`",
        "- `notes/` — free-form notes and insights",
        "",
      ].join("\n"),
    );
  }
  return root;
}

export async function topicExists(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  return existsSync(join(topicDir(slug), TOPIC_FILE));
}

async function requireTopic(slug: string): Promise<string> {
  assertSlug(slug);
  if (!(await topicExists(slug))) throw new Error(`Topic not found: ${slug}`);
  return topicDir(slug);
}

async function counts(dir: string): Promise<TopicCounts> {
  const [conversations, sources, notes] = await Promise.all([
    listDirs(join(dir, "conversations")),
    listDirs(join(dir, "sources")),
    listFiles(join(dir, "notes")),
  ]);
  return {
    conversations: conversations.length,
    sources: sources.length,
    notes: notes.filter((n) => n.endsWith(".md")).length,
  };
}

async function readTopicSummary(slug: string): Promise<TopicSummary | null> {
  const dir = topicDir(slug);
  const text = await readText(join(dir, TOPIC_FILE));
  if (text === null) return null;
  const { data, body } = parseFrontmatter(text);
  const logInfo = await stat(join(dir, LOG_FILE)).catch(() => null);
  const logUpdated = logInfo ? new Date(logInfo.mtimeMs).toISOString() : undefined;
  const fmUpdated = str(data.updated);
  const updated = [fmUpdated, logUpdated].filter((v): v is string => Boolean(v)).sort().pop();
  return {
    slug,
    title: str(data.title) ?? slug,
    created: str(data.created),
    updated,
    excerpt: excerpt(body),
    counts: await counts(dir),
  };
}

export async function listTopics(): Promise<TopicSummary[]> {
  const root = await ensureResearchRoot();
  const slugs = (await listDirs(root)).filter(isValidSlug);
  const topics = (await Promise.all(slugs.map(readTopicSummary))).filter(
    (t): t is TopicSummary => t !== null,
  );
  return topics.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
}

export async function getTopic(slug: string, logLimit = 50): Promise<TopicDetail | null> {
  if (!isValidSlug(slug)) return null;
  const summary = await readTopicSummary(slug);
  if (!summary) return null;
  const text = (await readText(join(topicDir(slug), TOPIC_FILE))) ?? "";
  return {
    ...summary,
    brief: parseFrontmatter(text).body,
    log: await readLog(slug, logLimit),
  };
}

export interface CreateTopicInput {
  title: string;
  slug?: string;
  question?: string;
}

export async function createTopic(input: CreateTopicInput): Promise<TopicDetail> {
  const title = input.title.trim();
  if (!title) throw new Error("Topic title is required");
  await ensureResearchRoot();
  let slug = input.slug?.trim() ? assertSlug(input.slug.trim()) : slugify(title, "topic");
  if (!input.slug) {
    let n = 2;
    const base = slug;
    while (existsSync(topicDir(slug))) slug = `${base}-${n++}`;
  } else if (existsSync(topicDir(slug))) {
    throw new Error(`课题 ID 已存在：${slug}`);
  }
  const dir = topicDir(slug);
  await mkdir(dir, { recursive: true });
  for (const sub of SUBDIRS) await mkdir(join(dir, sub), { recursive: true });
  const now = nowIso();
  const question = input.question?.trim();
  const body = [
    "## 研究问题",
    "",
    question || "（还没写。第一次对话时和 agent 一起明确。）",
    "",
    "## 当前状态",
    "",
    "刚开始，还没有结论。",
    "",
    "## 开放问题",
    "",
    "- ",
    "",
  ].join("\n");
  await writeAtomic(join(dir, TOPIC_FILE), stringifyFrontmatter({ title, created: now, updated: now }, body));
  await writeAtomic(join(dir, LOG_FILE), `# ${title} · 时间线\n\n`);
  await appendLog(slug, "topic", "创建课题");
  const topic = await getTopic(slug);
  if (!topic) throw new Error("Failed to create topic");
  return topic;
}

export async function updateBrief(slug: string, brief: string, note?: string): Promise<void> {
  if (!brief.trim()) throw new Error("Brief is required and must be non-empty");
  const dir = await requireTopic(slug);
  const path = join(dir, TOPIC_FILE);
  await withTopicLock(slug, async () => {
    const { data } = parseFrontmatter((await readText(path)) ?? "");
    data.updated = nowIso();
    await writeAtomic(path, stringifyFrontmatter(data, brief));
  });
  await appendLog(slug, "brief", note?.trim() || "更新了课题状态", "TOPIC.md");
}

export async function renameTopic(slug: string, title: string): Promise<void> {
  const dir = await requireTopic(slug);
  const path = join(dir, TOPIC_FILE);
  await withTopicLock(slug, async () => {
    const { data, body } = parseFrontmatter((await readText(path)) ?? "");
    data.title = title.trim();
    data.updated = nowIso();
    await writeAtomic(path, stringifyFrontmatter(data, body));
  });
}

// ---------------------------------------------------------------------------
// Log

const LOG_RE = /^- (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (\w+) · (?:\[(.*)\]\((.*)\)|(.*))$/;

export async function appendLog(slug: string, kind: LogKind, text: string, link?: string): Promise<void> {
  const dir = topicDir(slug);
  const clean = text.replace(/[\r\n]+/g, " ").replace(/[[\]]/g, "").trim();
  const line = link
    ? `- ${localStamp()} · ${kind} · [${clean}](${link.replace(/ /g, "%20")})\n`
    : `- ${localStamp()} · ${kind} · ${clean}\n`;
  await appendFile(join(dir, LOG_FILE), line);
}

export async function readLog(slug: string, limit = 50): Promise<LogEntry[]> {
  const text = (await readText(join(topicDir(slug), LOG_FILE))) ?? "";
  const entries: LogEntry[] = [];
  for (const line of text.split("\n")) {
    const m = LOG_RE.exec(line.trim());
    if (!m) continue;
    entries.push({
      at: m[1]!,
      kind: m[2]!,
      text: (m[3] ?? m[5] ?? "").trim(),
      link: m[4] ? decodeURI(m[4]) : undefined,
    });
  }
  return entries.reverse().slice(0, limit);
}

// ---------------------------------------------------------------------------
// Conversations

function conversationsDir(slug: string): string {
  return join(topicDir(slug), "conversations");
}

export async function findConversationId(slug: string, sessionId: string): Promise<string | null> {
  const suffix = `-${sessionId.slice(0, 8)}`;
  const dirs = await listDirs(conversationsDir(slug));
  return dirs.find((d) => d.endsWith(suffix)) ?? null;
}

async function readConversationSummary(slug: string, id: string): Promise<ConversationDetail | null> {
  const dir = join(conversationsDir(slug), id);
  const summaryText = await readText(join(dir, "summary.md"));
  if (summaryText === null) return null;
  const { data, body } = parseFrontmatter(summaryText);
  return {
    id,
    title: str(data.title) ?? id,
    sessionId: str(data.sessionId),
    started: str(data.started),
    updated: str(data.updated),
    turns: typeof data.turns === "number" ? data.turns : undefined,
    excerpt: excerpt(body),
    summary: body,
    transcript: "",
  };
}

export async function listConversations(slug: string): Promise<ConversationSummary[]> {
  await requireTopic(slug);
  const ids = await listDirs(conversationsDir(slug));
  const items = await Promise.all(ids.map((id) => readConversationSummary(slug, id)));
  return items
    .filter((c): c is ConversationDetail => c !== null)
    .map(({ summary: _s, transcript: _t, ...rest }) => rest)
    .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
}

export async function getConversation(slug: string, id: string): Promise<ConversationDetail | null> {
  if (!isValidSlug(slug)) return null;
  assertChildId(id);
  const item = await readConversationSummary(slug, id);
  if (!item) return null;
  item.transcript = (await readText(join(conversationsDir(slug), id, "transcript.md"))) ?? "";
  return item;
}

export interface WriteConversationInput {
  sessionId: string;
  title: string;
  started: string;
  turns: number;
  transcript: string;
  summary?: string;
}

/** Creates or refreshes the conversation folder for a webchat session. */
export async function writeConversation(slug: string, input: WriteConversationInput): Promise<string> {
  await requireTopic(slug);
  const { id, isNew } = await withTopicLock(slug, async () => {
    let id = await findConversationId(slug, input.sessionId);
    const isNew = id === null;
    if (!id) id = `${localDate(new Date(input.started))}-${input.sessionId.slice(0, 8)}`;
    const dir = join(conversationsDir(slug), id);
    await mkdir(dir, { recursive: true });
    const summaryPath = join(dir, "summary.md");
    const existing = parseFrontmatter((await readText(summaryPath)) ?? "");
    const body = input.summary ?? (existing.body.trim() ? existing.body : "（摘要生成中…）");
    await writeAtomic(
      summaryPath,
      stringifyFrontmatter(
        {
          title: input.title,
          sessionId: input.sessionId,
          started: input.started,
          updated: nowIso(),
          turns: input.turns,
        },
        body,
      ),
    );
    await writeAtomic(join(dir, "transcript.md"), input.transcript);
    return { id, isNew };
  });
  if (isNew) await appendLog(slug, "conversation", input.title, `conversations/${id}/summary.md`);
  return id;
}

export async function readConversationSummaryBody(slug: string, id: string): Promise<string> {
  const text = (await readText(join(conversationsDir(slug), id, "summary.md"))) ?? "";
  return parseFrontmatter(text).body;
}

// ---------------------------------------------------------------------------
// Sources

function sourcesDir(slug: string): string {
  return join(topicDir(slug), "sources");
}

function inferKind(name: string | undefined, url: string | undefined, hasContent = false): SourceKind {
  const ext = (name ? extname(name) : "").toLowerCase();
  if (url && /github\.com|gitlab\.com/.test(url)) return "code";
  if (url && ext !== ".pdf" && (!name || name === "page.html")) return "url";
  if (ext === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic"].includes(ext)) return "image";
  if (
    [
      ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".kt", ".swift", ".c", ".cc",
      ".cpp", ".h", ".rb", ".sh", ".sql", ".ipynb", ".zip",
    ].includes(ext)
  )
    return "code";
  if ([".md", ".txt", ".html", ".htm", ".json", ".csv", ".yaml", ".yml"].includes(ext)) return "text";
  if (url) {
    if (/github\.com|gitlab\.com/.test(url)) return "code";
    if (/\.pdf($|\?)/i.test(url) || /arxiv\.org\/pdf\//.test(url)) return "pdf";
    return "url";
  }
  return hasContent && !name ? "text" : "file";
}

async function readSource(slug: string, id: string, withContent: boolean): Promise<SourceDetail | null> {
  const dir = join(sourcesDir(slug), id);
  const metaText = await readText(join(dir, META_FILE));
  if (metaText === null) return null;
  const { data, body } = parseFrontmatter(metaText);
  const files = (await listFiles(dir)).filter((f) => f !== META_FILE);
  const fileInfo = await Promise.all(
    files.map(async (name) => ({ name, size: (await stat(join(dir, name))).size })),
  );
  const detail: SourceDetail = {
    id,
    title: str(data.title) ?? id,
    kind: (str(data.kind) as SourceKind | undefined) ?? "file",
    url: str(data.url),
    savedAt: str(data.savedAt),
    tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [],
    files,
    excerpt: excerpt(body),
    body,
    fileInfo,
  };
  if (withContent && files.includes(CONTENT_FILE)) {
    const content = (await readText(join(dir, CONTENT_FILE))) ?? "";
    const max = 60_000;
    detail.content = content.length > max ? content.slice(0, max) : content;
    detail.contentTruncated = content.length > max;
  }
  return detail;
}

export async function listSources(slug: string): Promise<SourceSummary[]> {
  await requireTopic(slug);
  const ids = await listDirs(sourcesDir(slug));
  const items = await Promise.all(ids.map((id) => readSource(slug, id, false)));
  return items
    .filter((s): s is SourceDetail => s !== null)
    .map(({ body: _b, fileInfo: _f, content: _c, contentTruncated: _t, ...rest }) => rest)
    .sort((a, b) => b.id.localeCompare(a.id));
}

export async function getSource(slug: string, id: string): Promise<SourceDetail | null> {
  if (!isValidSlug(slug)) return null;
  assertChildId(id);
  return readSource(slug, id, true);
}

export function sourceFilePath(slug: string, id: string, name: string): string {
  assertChildId(id);
  if (name.includes("/") || name.includes("\\") || name.startsWith(".")) throw new Error("Invalid file name");
  return safeJoin(join(sourcesDir(slug), id), name);
}

export interface SaveSourceInput {
  title?: string;
  kind?: SourceKind;
  url?: string;
  why?: string;
  summary?: string;
  /** Extracted or pasted text; stored as content.md for reading and search. */
  content?: string;
  /** Absolute path, or a path relative to the topic folder, of a file to copy in. */
  filePath?: string;
  /** Raw bytes of an uploaded file. */
  fileBytes?: Uint8Array;
  fileName?: string;
  tags?: string[];
  /** Download the URL into the source folder when no file is given. Default true. */
  fetchUrl?: boolean;
}

function pdfTitle(text: string): string | undefined {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("<!--")) continue;
    return line.length > 140 ? `${line.slice(0, 140)}…` : line;
  }
  return undefined;
}

function urlLabel(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split("/").filter(Boolean).slice(-2).join("/");
    return tail ? `${u.hostname}/${tail}` : u.hostname;
  } catch {
    return url;
  }
}

function safeFileName(name: string): string {
  const base = basename(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim();
  return base && !base.startsWith(".") ? base.slice(0, 160) : "file";
}

async function fetchIntoSource(
  url: string,
  dir: string,
): Promise<{ fileName?: string; content?: string; title?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "Mozilla/5.0 (Rome Research app)" },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 50 * 1024 * 1024) return { error: "file larger than 50 MB, kept link only" };
    if (type.includes("pdf") || /\.pdf($|\?)/i.test(url)) {
      const fileName = "original.pdf";
      await writeFile(join(dir, fileName), bytes);
      const content = await extractPdfText(bytes);
      return { fileName, content, title: pdfTitle(content) };
    }
    if (type.includes("html")) {
      const html = new TextDecoder().decode(bytes);
      await writeFile(join(dir, "page.html"), html);
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim();
      return { fileName: "page.html", content: htmlToText(html), title };
    }
    if (type.startsWith("text/") || type.includes("json")) {
      const fileName = type.includes("json") ? "original.json" : "original.txt";
      await writeFile(join(dir, fileName), bytes);
      return { fileName, content: new TextDecoder().decode(bytes) };
    }
    const guess = safeFileName(new URL(url).pathname.split("/").pop() || "download");
    await writeFile(join(dir, guess), bytes);
    return { fileName: guess };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveSource(slug: string, input: SaveSourceInput): Promise<SourceDetail> {
  const topic = await requireTopic(slug);
  const dir0 = sourcesDir(slug);
  await mkdir(dir0, { recursive: true });

  let fileName = input.fileName ? safeFileName(input.fileName) : undefined;
  let srcPath: string | undefined;
  if (input.filePath) {
    srcPath = input.filePath.startsWith("/") ? input.filePath : safeJoin(topic, input.filePath);
    if (!existsSync(srcPath)) throw new Error(`File not found: ${input.filePath}`);
    fileName = fileName ?? safeFileName(basename(srcPath));
  }
  const url = input.url?.trim() || undefined;
  if (!fileName && !url && !input.content?.trim() && !input.fileBytes) {
    throw new Error("A source needs a url, filePath, or content (required: at least one)");
  }

  // Stage into a hidden folder; the final id is derived from the resolved title.
  const dir = join(dir0, `.staging-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  try {
    return await fillSource(slug, dir0, dir, input, fileName, srcPath, url);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function fillSource(
  slug: string,
  dir0: string,
  dir: string,
  input: SaveSourceInput,
  fileNameIn: string | undefined,
  srcPath: string | undefined,
  url: string | undefined,
): Promise<SourceDetail> {
  let fileName = fileNameIn;
  let content = input.content;
  let fetchedTitle: string | undefined;
  let fetchNote: string | undefined;
  if (srcPath && fileName) {
    await copyFile(srcPath, join(dir, fileName));
  } else if (input.fileBytes && fileName) {
    await writeFile(join(dir, fileName), input.fileBytes);
  } else if (url && input.fetchUrl !== false && !/github\.com/.test(url)) {
    const fetched = await fetchIntoSource(url, dir);
    if (fetched.fileName) fileName = fetched.fileName;
    if (!content && fetched.content) content = fetched.content;
    fetchedTitle = fetched.title;
    if (fetched.error) fetchNote = `抓取失败（${fetched.error}），只保存了链接。`;
  }

  if (!content && fileName && extname(fileName).toLowerCase() === ".pdf") {
    const bytes = new Uint8Array(await readFile(join(dir, fileName)));
    content = await extractPdfText(bytes);
  }
  if (content?.trim()) await writeFile(join(dir, CONTENT_FILE), content);

  if (!fetchedTitle && fileName && extname(fileName).toLowerCase() === ".pdf") fetchedTitle = pdfTitle(content ?? "");
  const title = input.title?.trim() || fetchedTitle || (url ? urlLabel(url) : undefined) || fileName || "Untitled";
  const kind = input.kind ?? inferKind(fileName, url, Boolean(content?.trim()));
  const bodyParts: string[] = [];
  bodyParts.push("## 为什么保存", "", input.why?.trim() || "（未填写）", "");
  if (input.summary?.trim()) bodyParts.push("## 摘要", "", input.summary.trim(), "");
  if (fetchNote) bodyParts.push("> " + fetchNote, "");
  await writeFile(
    join(dir, META_FILE),
    stringifyFrontmatter(
      {
        title,
        kind,
        url,
        savedAt: nowIso(),
        tags: input.tags?.length ? input.tags : undefined,
        file: fileName,
      },
      bodyParts.join("\n"),
    ),
  );
  const id = await withTopicLock(slug, async () => {
    const next = nextNumberedId(await listDirs(dir0), title, "source");
    await rename(dir, join(dir0, next));
    return next;
  });
  await appendLog(slug, "source", title, `sources/${id}/${META_FILE}`);
  const saved = await readSource(slug, id, false);
  if (!saved) throw new Error("Failed to save source");
  return saved;
}

export async function updateSourceMeta(
  slug: string,
  id: string,
  patch: { title?: string; why?: string; summary?: string; tags?: string[] },
): Promise<SourceDetail> {
  await requireTopic(slug);
  assertChildId(id);
  const path = join(sourcesDir(slug), id, META_FILE);
  await withTopicLock(slug, async () => {
  const text = await readText(path);
  if (text === null) throw new Error(`Source not found: ${id}`);
  const { data, body } = parseFrontmatter(text);
  if (patch.title?.trim()) data.title = patch.title.trim();
  if (patch.tags) data.tags = patch.tags;
  let nextBody = body;
  if (patch.why !== undefined || patch.summary !== undefined) {
    const why = patch.why ?? sectionOf(body, "为什么保存") ?? "";
    const summary = patch.summary ?? sectionOf(body, "摘要") ?? "";
    nextBody = ["## 为什么保存", "", why.trim() || "（未填写）", ""]
      .concat(summary.trim() ? ["## 摘要", "", summary.trim(), ""] : [])
      .join("\n");
  }
  await writeAtomic(path, stringifyFrontmatter(data, nextBody));
  });
  const saved = await readSource(slug, id, true);
  if (!saved) throw new Error("Failed to update source");
  return saved;
}

function sectionOf(body: string, heading: string): string | undefined {
  const re = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
  return re.exec(body)?.[1]?.trim();
}

// ---------------------------------------------------------------------------
// Notes

function notesDir(slug: string): string {
  return join(topicDir(slug), "notes");
}

async function readNote(slug: string, file: string): Promise<NoteDetail | null> {
  const text = await readText(join(notesDir(slug), file));
  if (text === null) return null;
  const { data, body } = parseFrontmatter(text);
  const id = file.replace(/\.md$/, "");
  return {
    id,
    title: str(data.title) ?? id,
    created: str(data.created),
    updated: str(data.updated),
    excerpt: excerpt(body),
    body,
  };
}

export async function listNotes(slug: string): Promise<NoteSummary[]> {
  await requireTopic(slug);
  const files = (await listFiles(notesDir(slug))).filter((f) => f.endsWith(".md"));
  const items = await Promise.all(files.map((f) => readNote(slug, f)));
  return items
    .filter((n): n is NoteDetail => n !== null)
    .map(({ body: _b, ...rest }) => rest)
    .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
}

export async function getNote(slug: string, id: string): Promise<NoteDetail | null> {
  if (!isValidSlug(slug)) return null;
  assertChildId(id);
  return readNote(slug, `${id}.md`);
}

export async function saveNote(
  slug: string,
  input: { id?: string; title: string; body: string },
): Promise<NoteDetail> {
  await requireTopic(slug);
  const dir = notesDir(slug);
  await mkdir(dir, { recursive: true });
  const title = input.title.trim() || "Untitled";
  const id = await withTopicLock(slug, async () => {
    const now = nowIso();
    let id = input.id ? assertChildId(input.id) : undefined;
    let created = now;
    if (id) {
      const existing = await readNote(slug, `${id}.md`);
      if (!existing) throw new Error(`Note not found: ${id}`);
      created = existing.created ?? now;
    } else {
      const base = `${localDate()}-${slugify(title, "note", true)}`;
      id = base;
      let n = 2;
      while (existsSync(join(dir, `${id}.md`))) id = `${base}-${n++}`;
    }
    await writeAtomic(join(dir, `${id}.md`), stringifyFrontmatter({ title, created, updated: now }, input.body));
    return id;
  });
  if (!input.id) await appendLog(slug, "note", title, `notes/${id}.md`);
  const note = await readNote(slug, `${id}.md`);
  if (!note) throw new Error("Failed to save note");
  return note;
}

// ---------------------------------------------------------------------------
// Search

const TEXT_EXT = new Set([
  ".md", ".txt", ".html", ".htm", ".json", ".csv", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx",
  ".py", ".rs", ".go", ".java", ".sh", ".sql",
]);

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.isFile() && TEXT_EXT.has(extname(e.name).toLowerCase()) && e.name !== "page.html") out.push(p);
  }
}

export async function search(query: string, opts: { slug?: string; limit?: number } = {}): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const limit = opts.limit ?? 80;
  const topics = opts.slug ? [opts.slug] : (await listTopics()).map((t) => t.slug);
  const hits: SearchHit[] = [];
  for (const slug of topics) {
    const summary = await readTopicSummary(slug);
    if (!summary) continue;
    const root = topicDir(slug);
    const files: string[] = [];
    await walk(root, files);
    for (const file of files) {
      const info = await stat(file);
      if (info.size > 5 * 1024 * 1024) continue;
      const text = await readText(file);
      if (!text) continue;
      const lower = text.toLowerCase();
      if (!terms.every((t) => lower.includes(t))) continue;
      const lines = text.split("\n");
      let perFile = 0;
      for (let i = 0; i < lines.length && perFile < 3; i++) {
        const l = lines[i]!.toLowerCase();
        if (!terms.some((t) => l.includes(t))) continue;
        const raw = lines[i]!.trim();
        const pos = Math.max(0, l.indexOf(terms.find((t) => l.includes(t))!) - 60);
        hits.push({
          slug,
          topicTitle: summary.title,
          path: relative(root, file),
          line: i + 1,
          snippet: (pos > 0 ? "…" : "") + raw.slice(pos, pos + 220),
        });
        perFile++;
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Context pack for the agent

export async function buildContext(slug: string): Promise<string> {
  const topic = await getTopic(slug, 30);
  if (!topic) throw new Error(`Topic not found: ${slug}`);
  const conversations = (await listConversations(slug)).slice(0, 5);
  const sources = (await listSources(slug)).slice(0, 30);
  const notes = (await listNotes(slug)).slice(0, 30);
  const recentSummaries: string[] = [];
  for (const c of conversations.slice(0, 3)) {
    const body = await readConversationSummaryBody(slug, c.id);
    recentSummaries.push(`### ${c.title} (${c.id})\n\n${body.trim()}`);
  }
  return [
    `# Topic: ${topic.title}`,
    `Folder: research/${slug} (your working directory). Counts: ${topic.counts.conversations} conversations, ${topic.counts.sources} sources, ${topic.counts.notes} notes.`,
    "",
    "## TOPIC.md",
    topic.brief.trim(),
    "",
    "## Recent timeline",
    topic.log.map((e) => `- ${e.at} [${e.kind}] ${e.text}${e.link ? ` → ${e.link}` : ""}`).join("\n") || "(empty)",
    "",
    "## Recent conversation summaries",
    recentSummaries.join("\n\n") || "(none yet)",
    "",
    "## Sources",
    sources.map((s) => `- ${s.id} [${s.kind}] ${s.title}${s.url ? ` <${s.url}>` : ""} — ${s.excerpt}`).join("\n") ||
      "(none yet)",
    "",
    "## Notes",
    notes.map((n) => `- notes/${n.id}.md — ${n.title}`).join("\n") || "(none yet)",
  ].join("\n");
}
