import { loadPromptContract } from "./prompt-contract.js";

/** The Markdown file is the single source of truth; this module only loads it. */
export const PRODUCT_SPEC_FORMAT_FILE = "product-spec-format.md";

export const PRODUCT_SPEC_FORMAT_PROMPT_CONTRACT = loadPromptContract(
  PRODUCT_SPEC_FORMAT_FILE,
  // Keep this URL literal so the server bundler emits only this asset rather
  // than treating the whole domain directory as a dynamic asset context.
  new URL("./product-spec-format.md", import.meta.url),
);

export const PRODUCT_SPEC_FORMAT = PRODUCT_SPEC_FORMAT_PROMPT_CONTRACT.content;
