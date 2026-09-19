import { readFileSync } from "node:fs";

export interface PromptContract {
  name: string;
  content: string;
}

/** Load one packaged Markdown contract without duplicating its contents in code. */
export function loadPromptContract(name: string, url: URL): PromptContract {
  return { name, content: readFileSync(url, "utf8").trim() };
}
