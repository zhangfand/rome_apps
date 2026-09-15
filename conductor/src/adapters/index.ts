import type { SourceAdapter } from "../lib/adapters.js";
import { githubAdapter } from "./github/index.js";

/**
 * Every outside world Conductor watches. The runtime iterates this list and
 * knows nothing else about any of them; adding a source is adding a file here
 * and a line below, with no change to the loop, the ledger or the prompts.
 */
export const SOURCE_ADAPTERS: readonly SourceAdapter[] = [githubAdapter];
