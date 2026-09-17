import { safeText } from "./facts";
import type { ConfigJson, ProjectPresentation, RuntimeJson } from "./types";

/** The shape both settings pages read from GET/PATCH `config`. */
export interface ConfigResponse {
  configured?: boolean;
  config: ConfigJson;
  runtime: RuntimeJson;
  projectPresentation?: Record<string, ProjectPresentation>;
}

/** Hide ledger mechanics from the global SOP before it reaches the UI. */
export function presentConfig(config: ConfigJson): ConfigJson {
  return { ...config, sop: safeText(config.sop) };
}

export async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `The change did not save (HTTP ${response.status}). Try again.`;
}
