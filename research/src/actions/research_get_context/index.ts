import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { buildContext } from "../../lib/store.js";

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
            "type": "string",
            "description": "Topic id (the folder name under research/)."
          }
        },
        "required": [
          "topic"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      const context = await buildContext(String(args.topic ?? ""));
      return { status: "ok", data: { context } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
