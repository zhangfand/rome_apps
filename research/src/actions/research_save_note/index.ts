import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { saveNote } from "../../lib/store.js";

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
          "title": {
            "type": "string"
          },
          "body": {
            "type": "string",
            "description": "Markdown body."
          },
          "id": {
            "type": "string",
            "description": "Existing note id to update; omit to create."
          }
        },
        "required": [
          "topic",
          "title",
          "body"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      const body = [args.body, args.content, args.text].find((v): v is string => typeof v === "string" && v.trim().length > 0);
      if (!body) return { status: "error", error: "`body` (Markdown content of the note) is required and must be non-empty" };
      if (!opt(args.title)) return { status: "error", error: "`title` is required" };
      const note = await saveNote(String(args.topic ?? ""), { id: opt(args.id), title: String(args.title), body });
      return { status: "ok", data: { id: note.id, path: `notes/${note.id}.md` } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
