import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { ExternalLink, GitMerge, MessageSquare, RefreshCw, TriangleAlert } from "lucide-react";
import type { MergeMethod, PullRequestRef, PullRequestStatus } from "../../lib/pull-request.js";
import { useNow } from "../lib/format";

const REVIEW = { APPROVED: "Approved", CHANGES_REQUESTED: "Changes requested", REVIEW_REQUIRED: "Review required", UNREVIEWED: "Not approved", UNKNOWN: "Review unknown" };
const CI = { SUCCESS: "CI passed", FAILURE: "CI failed", PENDING: "CI pending", NONE: "No CI checks", UNKNOWN: "CI unknown" };
export const PR_STALE_AFTER_MS = 3 * 60_000;
export function prDataStale(checkedAt: string | undefined, now: number): boolean {
  const checked = checkedAt ? Date.parse(checkedAt) : NaN;
  return !Number.isFinite(checked) || now - checked > PR_STALE_AFTER_MS;
}

/** Quiet when healthy; progress and problems occupy the same compact slot. */
export function PullRequestFreshness({ loading, warning, number, disabled, retry }: {
  loading: boolean; warning?: string; number: number; disabled?: boolean; retry: () => void;
}) {
  if (loading) return <span role="status" aria-label={`Refreshing PR #${number}`} className="inline-flex items-center px-1 text-muted-foreground">
    <RefreshCw className="size-3 animate-spin" aria-hidden />
  </span>;
  if (!warning) return null;
  const label = `${warning} Retry loading PR #${number}.`;
  return <Button size="xs" variant="ghost" disabled={disabled} onClick={retry} aria-label={label} title={label}>
    <TriangleAlert className="size-3.5 text-warning-fg" aria-hidden />
  </Button>;
}

const METHODS = { squash: "Squash and merge", merge: "Create merge commit", rebase: "Rebase and merge" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchAppApi(path, init);
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

export function PullRequestCard({ taskId, pr, compact = false, actions, details, context }: {
  taskId: string; pr: PullRequestRef; compact?: boolean; actions?: ReactNode; details?: ReactNode; context?: string;
}) {
  const [data, setData] = useState<PullRequestStatus>();
  const [error, setError] = useState<string>();
  const [mergeError, setMergeError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const [confirmation, setConfirmation] = useState<{ sha: string; base: string; method: MergeMethod }>();
  const blockedId = useId();
  const [showBlocked, setShowBlocked] = useState(false);
  const sequence = useRef(0);
  const busy = useRef(false);
  const now = useNow();
  const stale = prDataStale(data?.checkedAt, now);
  const warning = error ?? (stale ? data ? "PR data is over 3 minutes old or its timestamp is unavailable." : "PR data is unavailable." : undefined);
  const path = `tasks/${encodeURIComponent(taskId)}/pull-request`;
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    setLoading(true);
    try {
      const next = await api<PullRequestStatus>(`${path}?url=${encodeURIComponent(pr.url)}`);
      if (ticket !== sequence.current) return;
      setData(next); setError(undefined); setMergeError(undefined);
    } catch (e) {
      if (ticket === sequence.current) setError(e instanceof Error ? e.message : "Could not load PR status.");
    } finally { if (ticket === sequence.current) setLoading(false); }
  }, [path, pr.url]);

  useEffect(() => {
    void refresh();
    const tick = () => { if (!document.hidden && !busy.current) void refresh(); };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { ++sequence.current; clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [refresh]);

  const merge = async () => {
    if (!confirmation || busy.current) return;
    busy.current = true; setMerging(true); setError(undefined); setMergeError(undefined);
    try {
      await api(`${path}/merge`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pr.url, sha: confirmation.sha, method: confirmation.method, confirmed: true }),
      });
      setMerged(true); setConfirmation(undefined);
      await refresh();
    } catch (e) { const message = e instanceof Error ? e.message : "Merge failed. Retry loading before trying again."; setError(message); setMergeError(message); setConfirmation(undefined); }
    finally { busy.current = false; setMerging(false); }
  };

  return (
    <div className={compact ? "min-w-0 rounded-12 border border-border bg-surface p-4" : "mt-3 min-w-0 rounded-8 border border-border px-3 py-3"}>
      {context ? <span className="mb-1 block text-aux text-muted-foreground">{context}</span> : null}
      <PullRequestMetrics pr={pr} data={data} error={warning} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={pr.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-4 border border-border px-2 py-1 text-aux font-medium hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Open PR <ExternalLink className="size-3" aria-hidden />
        </a>
        <Button size="xs" className="aria-disabled:opacity-50" aria-disabled={loading || merging || merged || !!warning || !data || !!data.mergeBlocked}
          aria-describedby={showBlocked ? blockedId : undefined}
          title={warning ? "Current PR data is required before merging" : data?.mergeBlocked ?? "Confirm and merge this PR"}
          onClick={() => {
            if (loading || merging || merged || warning || !data || data.mergeBlocked) { setShowBlocked(!showBlocked); return; }
            setShowBlocked(false);
            setConfirmation({ sha: data.headSha, base: data.baseBranch, method: data.methods[0] });
          }}>
          <GitMerge className="size-3" aria-hidden /> {merging ? "Merging…" : merged || data?.state === "MERGED" ? "Merged" : "Merge PR"}
        </Button>
        {actions}
        <PullRequestFreshness loading={loading} warning={warning} number={pr.number} disabled={merging} retry={() => void refresh()} />
      </div>
      {showBlocked ? <p id={blockedId} role="status" className="mt-2 text-aux text-muted-foreground">{merging ? "A merge is in progress." : merged ? "Already merged." : loading ? "Checking the latest PR status." : warning ?? data?.mergeBlocked ?? "PR is ready to merge."}</p> : null}
      {mergeError ? <p role="alert" className="mt-2 text-aux text-destructive-fg break-words">{mergeError}</p> : null}
      {merged ? <p role="status" className="mt-2 text-aux text-success-fg">Merged on GitHub. Task completion still follows its tracked issue or your instructions.</p> : null}
      {confirmation ? (
        <div role="group" aria-label={`Confirm merge PR #${pr.number}`} className="mt-3 border-t border-border pt-3">
          <p className="text-ui break-words">Merge <strong>{pr.repo}#{pr.number}</strong> into <strong>{confirmation.base}</strong>?</p>
          <p className="mt-1 text-aux text-muted-foreground">Commit {confirmation.sha.slice(0, 7)}. This changes the repository. Review requirements, CI, and mergeability are checked again before merging.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select aria-label="Merge method" disabled={merging} value={confirmation.method}
              onChange={(event) => setConfirmation({ ...confirmation, method: event.target.value as MergeMethod })}
              className="max-w-full rounded-4 border border-border bg-surface px-2 py-1 text-aux">
              {data?.methods.map((method) => <option key={method} value={method}>{METHODS[method]}</option>)}
            </select>
            <Button size="xs" disabled={merging || loading || !!warning} onClick={() => void merge()}>{merging ? "Merging…" : "Confirm merge"}</Button>
            <Button size="xs" variant="ghost" disabled={merging} onClick={() => setConfirmation(undefined)}>Cancel</Button>
          </div>
        </div>
      ) : null}
      {details}
    </div>
  );
}

export function PullRequestMetrics({ pr, data, error }: { pr: PullRequestRef; data?: PullRequestStatus; error?: string }) {
  const reviewTone = error ? "text-muted-foreground" : data?.review === "APPROVED" ? "text-success-fg" : data?.review === "CHANGES_REQUESTED" ? "text-destructive-fg" : "text-muted-foreground";
  const ciTone = error ? "text-muted-foreground" : data?.ci === "SUCCESS" ? "text-success-fg" : data?.ci === "FAILURE" ? "text-destructive-fg" : "text-muted-foreground";
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ui">
        <a className="font-medium hover:underline break-all" href={pr.url} target="_blank" rel="noopener noreferrer">PR #{pr.number}</a>
        <span className="min-w-0 font-medium break-words">{data?.title ?? pr.repo}</span>
        {data ? <span className="text-aux text-muted-foreground break-all">{pr.repo}</span> : null}
        {data?.state === "MERGED" ? <span className="text-aux text-success-fg">Merged</span> : data?.state === "CLOSED" ? <span className="text-aux text-muted-foreground">Closed</span> : data?.draft ? <span className="text-aux text-muted-foreground">Draft</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-aux tabular-nums" aria-label="Pull request statistics">
        <span title="Lines added / deleted" className="inline-flex gap-2 font-medium">
          <span className="text-success-fg" aria-label={data ? `${data.additions} lines added` : "Lines added unavailable"}>+{data?.additions.toLocaleString() ?? "—"}</span>
          <span className="text-destructive-fg" aria-label={data ? `${data.deletions} lines deleted` : "Lines deleted unavailable"}>−{data?.deletions.toLocaleString() ?? "—"}</span>
        </span>
        <a href={`${pr.url}#discussion_bucket`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
          title={data ? `${data.discussionComments} discussion comments + ${data.reviewComments} inline review comments. Excludes review summaries and reactions.` : "Discussion + inline review comments"}>
          <MessageSquare className="size-3" aria-hidden /> {data?.comments.toLocaleString() ?? "—"} comments
        </a>
        <a href={`${pr.url}#pullrequestreview`} target="_blank" rel="noopener noreferrer" className={`hover:underline ${reviewTone}`}>{data ? REVIEW[data.review] : "Review unknown"}</a>
        <a href={`${pr.url}/checks`} target="_blank" rel="noopener noreferrer" className={`hover:underline ${ciTone}`} title="GitHub's aggregate check/status result for the PR head commit; successful rollups may include skipped or neutral checks.">{data ? CI[data.ci] : "CI unknown"}{data?.checks ? ` · ${data.checks}` : ""}</a>
      </div>
    </>
  );
}
