import type { FrontdeskShadowRow } from "../db/repositories/frontdesk-shadow.js";
import { estimatedJevInputCost } from "./jev.js";

export const DEFAULT_FRONTDESK_SHADOW_LIMIT = 20;
export const MAX_FRONTDESK_SHADOW_LIMIT = 100;

export function frontdeskShadowLimit(value: unknown): number {
  const requested = Number(value ?? DEFAULT_FRONTDESK_SHADOW_LIMIT);
  return Number.isFinite(requested)
    ? Math.min(MAX_FRONTDESK_SHADOW_LIMIT, Math.max(1, Math.round(requested)))
    : DEFAULT_FRONTDESK_SHADOW_LIMIT;
}

/** A stable, JSON-safe view shared by the action and the guardian UI. */
export function frontdeskShadowReport(rows: FrontdeskShadowRow[]) {
  const completed = rows.filter((row) => row.status === "completed");
  const compared = completed.filter((row) => row.matched !== undefined);
  const matched = compared.filter((row) => row.matched).length;
  const inputTokens = completed.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0);
  const latencies = completed.flatMap((row) => row.latencyMs === undefined ? [] : [row.latencyMs]);
  return {
    summary: {
      returned: rows.length,
      running: rows.filter((row) => row.status === "running").length,
      completed: completed.length,
      compared: compared.length,
      matched,
      mismatched: compared.filter((row) => row.matched === false).length,
      errors: rows.filter((row) => row.status === "error").length,
      skippedMissingApiKey: rows.filter((row) => row.status === "skipped_missing_api_key").length,
      matchRate: compared.length ? matched / compared.length : undefined,
      inputTokens,
      estimatedInputCostUsd: estimatedJevInputCost(inputTokens),
      averageLatencyMs: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : undefined,
    },
    runs: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      ...(row.completedAt ? { completedAt: row.completedAt.toISOString() } : {}),
      status: row.status,
      input: row.input,
      state: row.state,
      model: row.model,
      decision: row.decision,
      actual: row.actual,
      matched: row.matched,
      mismatch: row.mismatch,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedInputCostUsd: estimatedJevInputCost(row.inputTokens),
      latencyMs: row.latencyMs,
      error: row.error,
    })),
  };
}
