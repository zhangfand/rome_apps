import type { ConfigJson, ProjectPresentation, RuntimeJson } from "./types";

/** The shape both settings pages read from GET/PATCH `config`. */
export interface ConfigResponse {
  configured?: boolean;
  config: ConfigJson;
  runtime: RuntimeJson;
  projectPresentation?: Record<string, ProjectPresentation>;
}

export function presentConfig(config: ConfigJson): ConfigJson {
  return config;
}

export async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `The change did not save (HTTP ${response.status}). Try again.`;
}
