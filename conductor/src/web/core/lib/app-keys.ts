export const JEV_API_KEY_NAME = "TYPESAFE_API_KEY";
export const JEV_API_KEY_LABEL = "TypeSafe Jev API key";

export interface AppKeyMetadata {
  name: string;
  label: string;
  updatedAt: string;
  overridden: boolean;
}

type FetchLike = typeof fetch;

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: unknown };
  return typeof body.error === "string" && body.error.trim() ? body.error : fallback;
}

/** App-key values never come back from Rome; only value-free metadata does. */
export async function readJevApiKey(fetchImpl: FetchLike = fetch): Promise<AppKeyMetadata | undefined> {
  const response = await fetchImpl("/api/app-keys", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await errorMessage(response, "The Jev API key status could not be read."));
  const body = await response.json() as { keys?: unknown };
  if (!Array.isArray(body.keys)) return undefined;
  return body.keys.find((candidate): candidate is AppKeyMetadata => (
    Boolean(candidate)
    && typeof candidate === "object"
    && (candidate as { name?: unknown }).name === JEV_API_KEY_NAME
  ));
}

/** Rome stores the value as an app key and hot-reloads app runtime hooks. */
export async function saveJevApiKey(value: string, fetchImpl: FetchLike = fetch): Promise<{ overridden: boolean }> {
  const response = await fetchImpl(`/api/app-keys/${encodeURIComponent(JEV_API_KEY_NAME)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: JEV_API_KEY_LABEL, value }),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "The Jev API key could not be saved."));
  const body = await response.json() as { overridden?: unknown };
  return { overridden: body.overridden === true };
}
