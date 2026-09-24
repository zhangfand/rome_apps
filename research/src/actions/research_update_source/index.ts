import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { updateSourceMeta } from "../../lib/store.js";

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
          "topic": {
            "type": "string"
          },
          "id": {
            "type": "string",
            "description": "Source id, e.g. 0003-letta-memfs."
          },
          "title": {
            "type": "string"
          },
          "why": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "topic",
          "id"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      const source = await updateSourceMeta(String(args.topic ?? ""), String(args.id ?? ""), {
        title: opt(args.title), why: typeof args.why === "string" ? args.why : undefined,
        summary: typeof args.summary === "string" ? args.summary : undefined,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
      });
      return { status: "ok", data: { id: source.id, title: source.title } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
