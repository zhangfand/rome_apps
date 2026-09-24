import { fetchAppApi } from "@rome-os/app-web-sdk";

/** API error carrying the server's Chinese message and machine code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data ?? {}) as { message?: string; error?: string };
    throw new ApiError(d.message ?? `请求失败（${res.status}）`, res.status, d.error);
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetchAppApi(path));
}

export async function apiSend<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  return parse<T>(await fetchAppApi(path, init));
}

/** Upload one file as a raw binary body. */
export async function apiUpload<T>(reportId: string, file: File): Promise<T> {
  const res = await fetchAppApi(`reports/${encodeURIComponent(reportId)}/files?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  return parse<T>(res);
}

/** Fetch an authenticated image (report page) as an object URL. */
export async function apiBlobUrl(path: string): Promise<string> {
  const res = await fetchAppApi(path);
  if (!res.ok) throw new ApiError(`图片加载失败（${res.status}）`, res.status);
  return URL.createObjectURL(await res.blob());
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
