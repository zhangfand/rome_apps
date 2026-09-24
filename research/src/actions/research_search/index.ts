import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { search } from "../../lib/store.js";

function opt(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
void opt;

export function createAction(config: ActionConfig, _deps: AppActionRuntimeDeps): Action {
  return {
    config,
    inputSchema: {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Space-separated terms; all must appear in a file."
          },
          "topic": {
            "type": "string",
            "description": "Optional topic id to restrict the search."
          },
          "limit": {
            "type": "number"
          }
        },
        "required": [
          "query"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      const hits = await search(String(args.query ?? ""), { slug: opt(args.topic), limit: typeof args.limit === "number" ? args.limit : undefined });
      return { status: "ok", data: { hits } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
