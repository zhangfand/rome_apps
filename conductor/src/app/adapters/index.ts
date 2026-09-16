import type { SourceAdapter } from "../../core/lib/adapters.js";
import { githubAdapter } from "../../domain/adapters/github/index.js";

export const SOURCE_ADAPTERS: readonly SourceAdapter[] = [githubAdapter];
