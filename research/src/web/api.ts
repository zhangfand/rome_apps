import { fetchAppApi, getBootstrap } from "@rome-os/app-web-sdk";

export interface LogEntry {
  at: string;
  kind: string;
  text: string;
  link?: string;
}

export interface TopicSummary {
  slug: string;
  title: string;
  created?: string;
  updated?: string;
  excerpt: string;
  counts: { conversations: number; sources: number; notes: number };
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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchAppApi(path, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  return api<T>(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function enc(id: string): string {
  return encodeURIComponent(id);
}

/** Direct URL to a stored source file (same-origin, cookie-authenticated). */
export function fileUrl(slug: string, id: string, name: string, download = false): string {
  const base = getBootstrap().apiBase.replace(/\/$/, "");
  return `${base}/topics/${enc(slug)}/sources/${enc(id)}/files/${enc(name)}${download ? "?download=1" : ""}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
