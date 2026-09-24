import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { saveSource, type SourceKind } from "../../lib/store.js";

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
            "description": "Topic id."
          },
          "title": {
            "type": "string",
            "description": "Short title of the material."
          },
          "url": {
            "type": "string",
            "description": "Source URL, if any."
          },
          "filePath": {
            "type": "string",
            "description": "Absolute path, or path relative to the topic folder, of a file to copy in (e.g. an uploaded attachment)."
          },
          "content": {
            "type": "string",
            "description": "Optional text content to store as content.md (pasted text, extracted notes, code snippet)."
          },
          "why": {
            "type": "string",
            "description": "Why this is worth keeping for the research — one or two sentences."
          },
          "summary": {
            "type": "string",
            "description": "Optional short summary of the material's key points."
          },
          "kind": {
            "type": "string",
            "enum": [
              "pdf",
              "url",
              "code",
              "image",
              "text",
              "file"
            ],
            "description": "Optional; inferred from file/URL when omitted."
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Optional tags."
          },
          "fetchUrl": {
            "type": "boolean",
            "description": "Download the URL into the folder (default true)."
          }
        },
        "required": [
          "topic"
        ]
      },
    async execute(args): Promise<ActionResult> {
      try {
      const source = await saveSource(String(args.topic ?? ""), {
        title: opt(args.title), url: opt(args.url), filePath: opt(args.filePath), content: opt(args.content),
        why: opt(args.why), summary: opt(args.summary), kind: opt(args.kind) as SourceKind | undefined,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
        fetchUrl: typeof args.fetchUrl === "boolean" ? args.fetchUrl : undefined,
      });
      return { status: "ok", data: { id: source.id, title: source.title, kind: source.kind, files: source.files, path: `sources/${source.id}` } };
      } catch (err) {
        return { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
