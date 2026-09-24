import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { updateBrief } from "../../lib/store.js";

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
          "brief": {
            "type": "string",
            "description": "Full Markdown body for TOPIC.md."
          },
          "note": {
            "type": "string",
            "description": "One-line description of what changed, for the timeline."
          }
        },
        "required": [
          "topic",
          "brief"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      await updateBrief(String(args.topic ?? ""), String(args.brief ?? ""), opt(args.note));
      return { status: "ok", data: { updated: true } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
