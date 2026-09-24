import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { listTopics } from "../../lib/store.js";

function opt(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
void opt;

export function createAction(config: ActionConfig, _deps: AppActionRuntimeDeps): Action {
  return {
    config,
    inputSchema: {
        "type": "object",
        "properties": {},
        "required": []
      },
    async execute(args): Promise<ActionResult> {
      try {
      const topics = await listTopics();
      return { status: "ok", data: { topics } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
