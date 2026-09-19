import { loadPromptContract } from "./prompt-contract.js";

export const WORK_REPO_CONTRACT_FILE = "work-repo-contract.md";

export const WORK_REPO_PROMPT_CONTRACT = loadPromptContract(
  WORK_REPO_CONTRACT_FILE,
  // A literal URL makes the server build package this Markdown asset.
  new URL("./work-repo-contract.md", import.meta.url),
);

export const WORK_REPO_CONTRACT = WORK_REPO_PROMPT_CONTRACT.content;
