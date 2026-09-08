// The app's own API, as the browser sees it. Dates cross as ISO strings and
// the JSON columns arrive decoded, so these shapes are the repository types
// with `Date` replaced by `string`.

import { fetchAppApi } from "@rome-os/app-web-sdk";
import type {
  PlayscriptDoc,
  ProjectSettings,
  RunFile,
  RunReport,
  RunStatus,
} from "../../lib/types.js";

export interface ProjectDto extends ProjectSettings {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayscriptDto {
  id: string;
  projectId: string;
  name: string;
  startPath: string;
  doc: PlayscriptDoc;
  createdAt: string;
  updatedAt: string;
}

export interface RunDto {
  id: string;
  playscriptId: string;
  status: RunStatus;
  dir: string;
  report: RunReport | null;
  files: RunFile[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** What `POST /playscripts/:id/check` answers: the problems, and the script to read them against. */
export interface CheckResult {
  problems: string[];
  script: string;
}

/** The API's own message when it has one, so a 400 explains itself rather than reading as a status code. */
async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchAppApi(path, init);
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

function send<T>(path: string, method: string, body: unknown): Promise<T> {
  return call<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  listProjects: () => call<{ projects: ProjectDto[] }>("projects").then((r) => r.projects),

  updateProject: (id: string, patch: Partial<ProjectSettings> & { name?: string }) =>
    send<{ project: ProjectDto }>(`projects/${id}`, "PUT", patch).then((r) => r.project),

  listPlayscripts: (projectId?: string) =>
    call<{ playscripts: PlayscriptDto[] }>(
      projectId ? `playscripts?projectId=${encodeURIComponent(projectId)}` : "playscripts",
    ).then((r) => r.playscripts),

  createPlayscript: (input: {
    projectId: string;
    name: string;
    startPath: string;
    doc: PlayscriptDoc;
  }) => send<{ playscript: PlayscriptDto }>("playscripts", "POST", input).then((r) => r.playscript),

  readPlayscript: (id: string) =>
    call<{ playscript: PlayscriptDto }>(`playscripts/${id}`).then((r) => r.playscript),

  updatePlayscript: (
    id: string,
    patch: { name?: string; startPath?: string; doc?: PlayscriptDoc },
  ) =>
    send<{ playscript: PlayscriptDto }>(`playscripts/${id}`, "PUT", patch).then(
      (r) => r.playscript,
    ),

  checkPlayscript: (id: string) => send<CheckResult>(`playscripts/${id}/check`, "POST", {}),

  startRun: (playscriptId: string) =>
    send<{ run: RunDto }>(`playscripts/${playscriptId}/runs`, "POST", {}).then((r) => r.run),

  listRuns: (playscriptId: string) =>
    call<{ runs: RunDto[] }>(`runs?playscriptId=${encodeURIComponent(playscriptId)}`).then(
      (r) => r.runs,
    ),

  readRun: (id: string) => call<{ run: RunDto }>(`runs/${id}`).then((r) => r.run),
};

/**
 * The URL an artifact is served from. The `<video>` element and the download
 * links load it themselves rather than through `fetchAppApi`, so the path is
 * built from the same `apiBase` the SDK fetches against.
 */
export function runFileUrl(apiBase: string, runId: string, name: string): string {
  return `${apiBase}/runs/${runId}/files/${encodeURIComponent(name)}`;
}
