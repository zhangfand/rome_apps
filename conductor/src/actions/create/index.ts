import type { Action, ActionConfig, ActionResult, AppActionRuntimeDeps } from "@rome-os/app-runtime";
import { getCurrentActionContext } from "@rome-os/app-runtime";
import { writePersonFact } from "../../lib/person-fact.js";
import { createSettingsRepository } from "../../db/repositories/settings.js";
import { resolveHumanProject } from "../../lib/projects.js";
import { createLedgerRepository } from "../../db/repositories/ledger.js";
import { trackedIssueUrls } from "../../lib/intake.js";
import { issueRefsIn } from "../../lib/github-refs.js";
import { fold } from "../../lib/fold.js";

/** Opens a task with a Created fact. The only way a task comes into being from chat. */
export function createAction(config: ActionConfig, deps: AppActionRuntimeDeps): Action {
  const { appContext } = deps;
  return {
    config,
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Target configured project. Explicit choice wins over the selected chat project. Ask rather than guess when ambiguous." },
        brief: { type: "string", description: "What the task is, in a sentence or two. The orchestrator reads this as the request." },
        source: { type: "string", description: "The person's message, verbatim. Recorded as the fact's citation." },
      },
      required: ["brief", "source"],
      additionalProperties: false,
    },
    async execute(args): Promise<ActionResult> {
      const brief = String(args.brief ?? "").trim();
      const source = String(args.source ?? "").trim();
      if (!brief) return { status: "error", error: "brief is required" };
      if (!source) return { status: "error", error: "source is required: pass the person's message verbatim" };
      const settings = createSettingsRepository(appContext.db).get();
      if (!settings) return { status: "error", error: "Run conductor:setup before creating a task." };
      const context = getCurrentActionContext()?.channelContext;
      const tracked = trackedIssueUrls(fold(new Date(), createLedgerRepository(appContext.db).all()));
      const duplicate = issueRefsIn(brief).find((ref) => tracked.has(ref.url.toLowerCase()));
      if (duplicate) return { status: "error", error: `An existing task already names ${duplicate.url}; use reply on that task instead of creating a duplicate.` };
      let binding;
      try {
        binding = resolveHumanProject(settings, {
          projectId: typeof args.projectId === "string" ? args.projectId.trim() : undefined,
          projectPath: context?.projectPath, projectName: context?.projectName,
        });
      } catch (error) {
        return { status: "error", error: error instanceof Error ? error.message : String(error) };
      }
      const taskId = `t-${crypto.randomUUID().slice(0, 8)}`;
      return await writePersonFact(appContext, { taskId, kind: "Created", source, payload: { brief, ...binding } });
    },
  };
}
