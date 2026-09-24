import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { createTopic } from "../../lib/store.js";

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
          "title": {
            "type": "string",
            "description": "Human title of the topic, any language."
          },
          "question": {
            "type": "string",
            "description": "Optional research question / scope written into TOPIC.md."
          },
          "slug": {
            "type": "string",
            "description": "Optional ASCII id (lowercase, hyphens). Derived from the title when omitted."
          }
        },
        "required": [
          "title"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      const topic = await createTopic({ title: String(args.title ?? ""), question: opt(args.question), slug: opt(args.slug) });
      return { status: "ok", data: { slug: topic.slug, title: topic.title, projectPath: `research/${topic.slug}` } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
