import type {
  Action,
  ActionConfig,
  ActionResult,
  AppActionRuntimeDeps,
} from "@rome-os/app-runtime";
import { createPlayscriptsRepository } from "../../db/repositories/playscripts.js";
import { checkPlayscript, formatPlay } from "../../lib/checker.js";
import type { PlayscriptDoc } from "../../lib/types.js";

interface CheckInput {
  playscriptId?: string;
  doc?: PlayscriptDoc;
}

export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        playscriptId: { type: "string", description: "Id of a stored playscript to check." },
        doc: {
          type: "object",
          description: "A playscript document to check instead of a stored one.",
        },
      },
      additionalProperties: false,
    },
    async execute(input: Record<string, unknown>): Promise<ActionResult> {
      const { playscriptId, doc } = input as CheckInput;
      let subject = doc;
      if (!subject) {
        if (!playscriptId) {
          return { status: "error", error: "Pass a playscriptId or a doc to check." };
        }
        const playscript = await createPlayscriptsRepository(appContext.db).byId(playscriptId);
        if (!playscript) {
          return { status: "error", error: `No playscript with id "${playscriptId}".` };
        }
        subject = playscript.doc;
      }
      const problems = checkPlayscript(subject);
      return { status: "ok", data: { problems, script: formatPlay(subject) } };
    },
  };
}
