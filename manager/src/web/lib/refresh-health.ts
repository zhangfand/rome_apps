export const REFRESH_FAILURE_GRACE_MS = 3 * 60_000;

export type RefreshFailure = { since: number; attempts: number; message: string };

/** Only consecutive failures count; a successful refresh starts a new grace period. */
export function updateRefreshFailure(previous: RefreshFailure | null, error: string | null, now: number): RefreshFailure | null {
  return error === null ? null : {
    since: previous?.since ?? now,
    attempts: (previous?.attempts ?? 0) + 1,
    message: error,
  };
}

export function refreshWarning(failure: RefreshFailure | null, now: number): string | undefined {
  if (!failure || failure.attempts < 2 || now - failure.since < REFRESH_FAILURE_GRACE_MS) return undefined;
  return "Refresh has been failing for at least 3 minutes. Displayed data may be out of date. We'll keep trying automatically.";
}
