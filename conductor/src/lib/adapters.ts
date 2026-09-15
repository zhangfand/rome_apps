import type { RomeAppContext } from "@rome-os/app-runtime";
import type { ConductorConfig } from "./config.js";
import type { LedgerSnapshot } from "./fold.js";
import type { IngestRequest } from "./ingest.js";

/**
 * A source adapter: one outside world Conductor watches.
 *
 * An adapter reads its world and says what it saw, as ingest requests. It does
 * not touch the ledger, does not know the fact vocabulary beyond the two
 * shapes the seam accepts, and cannot wake the orchestrator. Everything
 * domain-specific — what a label means, which branch belongs to which task,
 * how a review reads as one line of English — lives inside the adapter and
 * nowhere else.
 *
 * `tick` runs every enabled adapter, hands the batch to the seam, and moves
 * on. An adapter that throws costs its own observations for that pass and
 * nothing more.
 */
export interface SourceAdapter {
  /** Slug stamped on every request, and on the facts that come from them. */
  readonly source: string;
  /** Whether this configuration gives the adapter anything to watch. */
  enabled(config: ConductorConfig): boolean;
  poll(ctx: AdapterPollContext): Promise<AdapterPollResult>;
}

export interface AdapterPollContext {
  /** The ledger as it stood at the start of the pass. */
  snapshot: LedgerSnapshot;
  config: ConductorConfig;
  now: Date;
  runAction: RomeAppContext["runAction"];
  log: { info(message: string, meta?: Record<string, unknown>): void; warn(message: string, meta?: Record<string, unknown>): void };
}

export interface AdapterPollResult {
  requests: IngestRequest[];
  /**
   * Origin keys this adapter considers already taken for reasons the ledger
   * cannot see on its own, mapped to the task holding them.
   */
  claimed?: Map<string, string>;
}
