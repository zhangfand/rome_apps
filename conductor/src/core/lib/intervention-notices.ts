import type { ConversationId, RomeAppContext, TalkRouter } from "@rome-os/app-runtime";
import {
  createInterventionNoticeRepository,
  type InterventionNotice,
} from "../db/repositories/intervention-notices.js";
import { createLedgerRepository } from "../db/repositories/ledger.js";
import { createLockRepository } from "../db/repositories/lock.js";
import { type AskedFact, type DiscordInterventionRoute, type Fact } from "./facts.js";
import { fold, isPersonFact, type TaskView } from "./fold.js";

export const INTERVENTION_DELIVERY_LOCK = "intervention-delivery";
const LOCK_LEASE_MS = 5 * 60_000;

export interface InterventionDispatchSummary {
  queued: number;
  delivered: number;
  boardOnly: number;
  cancelled: number;
  outcomeUnknown: number;
  skipped?: string;
}

/**
 * Rebuild the outbox from durable Asked facts, then deliver each pending row.
 * Only this deterministic path receives the narrow Talk delivery capability;
 * no agent can choose a connection, conversation, or message body.
 */
export async function dispatchInterventionNotices(
  appContext: RomeAppContext,
  talkRouter: Pick<TalkRouter, "list" | "send">,
): Promise<InterventionDispatchSummary> {
  const locks = createLockRepository(appContext.db);
  if (!locks.tryAcquire(INTERVENTION_DELIVERY_LOCK, LOCK_LEASE_MS)) {
    return emptySummary("another intervention dispatcher is running");
  }

  try {
    const ledger = createLedgerRepository(appContext.db);
    const notices = createInterventionNoticeRepository(appContext.db);
    const facts = ledger.all();
    const tasks = new Map(fold(new Date(), facts).tasks.map((task) => [task.id, task]));
    const summary = emptySummary();

    // A claim left behind by a dead dispatcher may already have produced a
    // Discord message. Resolve it as uncertain instead of risking a duplicate.
    summary.outcomeUnknown += notices.recoverInterrupted();

    for (const fact of facts) {
      if (fact.kind !== "Asked") continue;
      if (!notices.get(`${fact.taskId}:asked:${fact.seq}`)) summary.queued += 1;
      notices.enqueue(fact.taskId, fact.seq);
    }

    for (const notice of notices.pending()) {
      const task = tasks.get(notice.taskId);
      const asked = task?.facts.find((fact): fact is AskedFact => fact.seq === notice.factSeq && fact.kind === "Asked");
      if (!task || !asked) {
        notices.boardOnly(notice.key, "request_unavailable");
        summary.boardOnly += 1;
        continue;
      }
      if (resolvedAfter(task.facts, asked.seq)) {
        notices.cancel(notice.key);
        summary.cancelled += 1;
        continue;
      }
      const route = validRoute(task);
      if (!route) {
        notices.boardOnly(notice.key, "origin_route_unavailable");
        summary.boardOnly += 1;
        continue;
      }
      let routeAvailable = false;
      try {
        routeAvailable = (await talkRouter.list()).some((connection) => (
          connection.connectionId === route.connectionId && connection.service === "discord"
        ));
      } catch {
        // No provider call was attempted. This is a definite Board fallback,
        // not an ambiguous send outcome.
      }
      if (!routeAvailable) {
        notices.boardOnly(notice.key, "origin_connection_unavailable");
        summary.boardOnly += 1;
        continue;
      }
      // Route discovery is asynchronous. Re-read immediately before claiming
      // so a guardian answer that arrived while the connection was checked
      // cancels the still-pending intent.
      if (resolvedAfter(ledger.factsFor(task.id), asked.seq)) {
        notices.cancel(notice.key);
        summary.cancelled += 1;
        continue;
      }
      if (!notices.claim(notice.key)) continue;

      try {
        const receipt = await talkRouter.send(route.connectionId, route.threadId as ConversationId, {
          text: renderInterventionNotice(task, asked),
        });
        const messageId = String(receipt.messageId ?? "").trim();
        if (messageId) {
          notices.delivered(notice.key, messageId);
          summary.delivered += 1;
        } else {
          notices.outcomeUnknown(notice.key, "delivery_outcome_unknown");
          summary.outcomeUnknown += 1;
        }
      } catch (error) {
        // Invocation errors can occur after the provider accepted the send.
        // Do not inspect provider text and do not retry an ambiguous attempt.
        notices.outcomeUnknown(notice.key, "delivery_outcome_unknown");
        summary.outcomeUnknown += 1;
        appContext.log.warn("Discord intervention notice outcome is unknown", {
          taskId: notice.taskId,
          factSeq: notice.factSeq,
          error: error instanceof Error ? error.name : "unknown",
        });
      }
    }
    return summary;
  } finally {
    locks.release(INTERVENTION_DELIVERY_LOCK);
  }
}

function emptySummary(skipped?: string): InterventionDispatchSummary {
  return { queued: 0, delivered: 0, boardOnly: 0, cancelled: 0, outcomeUnknown: 0, ...(skipped ? { skipped } : {}) };
}

function resolvedAfter(facts: readonly Fact[], askedSeq: number): boolean {
  return facts.some((fact) => fact.seq > askedSeq && isPersonFact(fact));
}

function validRoute(task: TaskView): DiscordInterventionRoute | undefined {
  const created = task.facts.find((fact) => fact.kind === "Created");
  if (!created || created.kind !== "Created") return undefined;
  const route = created.payload.interventionRoute;
  if (!route || route.channel !== "discord" || !route.connectionId || !route.threadId || !route.channelUserId) return undefined;
  if (route.visibility === "guardian-dm" && !route.parentThreadId) return route;
  if (route.visibility === "guardian-authorized-thread" && route.parentThreadId) return route;
  return undefined;
}

export function renderInterventionNotice(task: TaskView, asked: AskedFact): string {
  const title = minimize(task.brief, 120);
  const action = minimize(asked.payload.question, 700);
  return [
    `**Action needed · ${task.id}**`,
    title,
    action,
    `Reply in this conversation, or answer on the Conductor Board for ${task.id}.`,
  ].join("\n\n");
}

/** Conservative minimization for lock-screen-like shared chat surfaces. */
function minimize(input: string, max: number): string {
  const safe = input
    .replace(/```[\s\S]*?```/g, "[details omitted]")
    .replace(/(?:^|\s)(?:\/[\w.-]+){2,}/g, " [path omitted]")
    .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (safe.length <= max) return safe;
  return `${safe.slice(0, max - 1).trimEnd()}…`;
}

export function noticeBoardState(task: TaskView, notice: InterventionNotice | undefined): {
  status: InterventionNotice["status"];
  boardFallback: boolean;
} | undefined {
  const outstandingAsk = [...task.facts].reverse().find((fact) => fact.kind === "Asked" && fact.seq > task.lastPersonFactSeq);
  const currentNotice = outstandingAsk && notice?.factSeq === outstandingAsk.seq ? notice : undefined;
  if (!currentNotice) {
    if (!outstandingAsk || validRoute(task)) return undefined;
    return { status: "board_only", boardFallback: true };
  }
  return {
    status: currentNotice.status,
    boardFallback: currentNotice.status === "board_only" || currentNotice.status === "outcome_unknown",
  };
}
