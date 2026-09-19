import { randomUUID } from "node:crypto";
import type {
  TurnMiddlewareContext,
  TurnMiddlewareHook,
  TurnMiddlewareHookDeps,
  TurnMiddlewareNext,
} from "@rome-os/app-runtime";
import { createFrontdeskShadowRepository } from "../../../core/db/repositories/frontdesk-shadow.js";
import { createLedgerRepository } from "../../../core/db/repositories/ledger.js";
import { actualOutcome, compareFrontdeskDecision } from "../../../core/frontdesk/compare.js";
import { evaluateFrontdeskWithJev } from "../../../core/frontdesk/jev.js";
import { buildFrontdeskState } from "../../../core/frontdesk/state.js";
import { fold } from "../../../core/lib/fold.js";
import { createSettingsRepository } from "../../../core/db/repositories/settings.js";
import { parseAppConfig, type FrontdeskShadowConfig } from "../../config.js";

const AGENT_NAME = "conductor";
const TYPESAFE_API_KEY_ENV = "TYPESAFE_API_KEY";

/**
 * Run Jev beside the existing LLM front desk. The middleware never rewrites the
 * prompt and always calls next(), so it cannot change user-visible behavior or
 * task history. After the LLM finishes, the row pairs Jev's prediction with the
 * person fact (if any) whose verbatim source is this turn's message.
 */
class FrontdeskShadowMiddleware implements TurnMiddlewareHook {
  readonly order = 90;
  readonly onError = "fail-open" as const;

  constructor(private readonly deps: TurnMiddlewareHookDeps) {}

  async handle(ctx: TurnMiddlewareContext, next: TurnMiddlewareNext): Promise<void> {
    if (ctx.session.agentName !== `${this.deps.appId}:${AGENT_NAME}` || ctx.meta.synthetic) {
      await next();
      return;
    }
    const appContext = this.deps.appContext;
    if (!appContext?.db) {
      await next();
      return;
    }

    let prepared: {
      runId: string;
      beforeSeq: number;
      evaluation?: ReturnType<typeof evaluateFrontdeskWithJev>;
      message: string;
    } | undefined;
    try {
      const config = createSettingsRepository(appContext.db, parseAppConfig).get();
      const shadow = config?.frontdeskShadow as FrontdeskShadowConfig | undefined;
      if (!config || shadow?.enabled === false) {
        await next();
        return;
      }
      const message = ctx.input.prompt ?? "";
      const ledger = createLedgerRepository(appContext.db);
      const facts = ledger.all();
      const beforeSeq = facts.at(-1)?.seq ?? 0;
      const state = buildFrontdeskState(message, fold(new Date(), facts).tasks, config);
      const runId = randomUUID();
      const repository = createFrontdeskShadowRepository(appContext.db);
      const apiKey = process.env[TYPESAFE_API_KEY_ENV]?.trim();
      repository.begin({
        id: runId,
        sessionId: ctx.session.id,
        channelThreadKey: ctx.session.channelThreadKey,
        message,
        state,
        ...(!apiKey ? { status: "skipped_missing_api_key" as const } : {}),
      });
      prepared = {
        runId,
        beforeSeq,
        message,
        ...(apiKey ? {
          evaluation: evaluateFrontdeskWithJev(state, {
            apiKey,
            model: shadow?.model,
            timeoutMs: 5_000,
          }),
        } : {}),
      };
    } catch (error) {
      this.deps.logger.warn("frontdesk shadow preparation failed; ordinary LLM continues", {
        sessionId: ctx.session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await next();
    if (!prepared) return;

    // Do not make the guardian wait for shadow bookkeeping. Jev usually
    // finishes before the LLM, but a slow provider or timeout completes here in
    // the background after the ordinary turn has already streamed its result.
    void this.finish(prepared).catch((error) => {
      this.deps.logger.warn("frontdesk shadow completion failed", {
        runId: prepared!.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async finish(prepared: {
    runId: string;
    beforeSeq: number;
    evaluation?: ReturnType<typeof evaluateFrontdeskWithJev>;
    message: string;
  }): Promise<void> {
    const appContext = this.deps.appContext;
    if (!appContext?.db) return;
    const ledger = createLedgerRepository(appContext.db);
    const repository = createFrontdeskShadowRepository(appContext.db);
    const actual = actualOutcome(ledger.all(), prepared.beforeSeq, prepared.message);
    if (!prepared.evaluation) {
      repository.finishSkipped(prepared.runId, actual);
      return;
    }
    try {
      const evaluation = await prepared.evaluation;
      repository.complete(
        prepared.runId,
        evaluation,
        actual,
        compareFrontdeskDecision(evaluation.decision, actual),
      );
    } catch (error) {
      repository.fail(
        prepared.runId,
        error instanceof Error ? error.message : String(error),
        actual,
      );
    }
  }
}

export function createHook(deps: TurnMiddlewareHookDeps): TurnMiddlewareHook {
  return new FrontdeskShadowMiddleware(deps);
}
