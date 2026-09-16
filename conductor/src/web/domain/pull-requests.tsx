import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { IconButton } from "@rome-os/ui/icon-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rome-os/ui/tooltip";
import { ExternalLink, GitMerge, GitPullRequest, MessageSquare, RefreshCw, TriangleAlert } from "lucide-react";
import type {
  PullRequestCiStatus,
  PullRequestStatuses,
  PullRequestStatus,
} from "../../domain/adapters/github/status.js";

const REFRESH_MS = 60_000;
const STALE_MS = 3 * 60_000;

export function PullRequestsPanel({ taskId }: { taskId: string }) {
  const [data, setData] = useState<PullRequestStatuses>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++request.current;
    setLoading(true);
    try {
      const response = await fetchAppApi(`tasks/${encodeURIComponent(taskId)}/pull-requests`);
      const body = await response.json().catch(() => ({})) as PullRequestStatuses & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Pull request status could not be read (HTTP ${response.status}).`);
      if (ticket !== request.current) return;
      setData(body);
      setError(undefined);
    } catch (caught) {
      if (ticket === request.current) {
        setError(caught instanceof Error ? caught.message : "Pull request status could not be read.");
      }
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (!document.hidden) void load();
    };
    refreshIfVisible();
    const timer = window.setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      request.current += 1;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  if (!data) {
    if (!error) return null;
    return (
      <div className="flex items-center gap-2 text-aux text-muted-foreground">
        <ReadWarning message={error} loading={loading} retry={load} />
        Pull request status is unavailable.
      </div>
    );
  }
  if (data.pullRequests.length === 0) return null;

  const checked = Date.parse(data.checkedAt);
  const stale = !Number.isFinite(checked) || Date.now() - checked > STALE_MS;
  const freshnessWarning = error ?? (stale ? "This pull request status is more than three minutes old." : undefined);

  return (
    <section className="flex flex-col gap-2.5" aria-label="Pull requests">
      {data.pullRequests.map((pull) => (
        <PullRequestCard
          key={`${pull.owner}/${pull.repo}#${pull.number}`}
          pull={pull}
          warning={pull.error ?? freshnessWarning}
          loading={loading}
          retry={load}
        />
      ))}
    </section>
  );
}

function PullRequestCard({ pull, warning, loading, retry }: {
  pull: PullRequestStatus;
  warning?: string;
  loading: boolean;
  retry: () => Promise<void>;
}) {
  const state = pull.merged ? "merged" : pull.draft ? "draft" : pull.state;
  const PullIcon = state === "merged" ? GitMerge : GitPullRequest;
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PullIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <CardTitle className="min-w-0 break-words">{pull.title ?? `Pull request #${pull.number}`}</CardTitle>
          {state && <Badge variant={stateBadge(state)}>{capitalize(state)}</Badge>}
          <span className="font-mono text-[11px] text-subtle-foreground">#{pull.number} · {pull.owner}/{pull.repo}</span>
          {warning && <ReadWarning message={warning} loading={loading} retry={retry} />}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 text-aux tabular-nums">
        <span className="inline-flex items-center gap-2 font-medium" title="Lines added and deleted">
          <span className="text-success-fg">+{displayNumber(pull.additions)}</span>
          <span className="text-destructive-fg">−{displayNumber(pull.deletions)}</span>
          <span className="text-muted-foreground">{displayNumber(pull.changed_files)} files</span>
        </span>
        {pull.review && <span className={reviewTone(pull.review)}>{reviewLabel(pull.review)}</span>}
        {pull.ci && (
          <span className={ciTone(pull.ci)}>
            {ciLabel(pull.ci)} · {pull.checks?.completed ?? 0}/{pull.checks?.total ?? 0}
          </span>
        )}
        {pull.total_comments !== undefined && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MessageSquare className="size-3" aria-hidden /> {pull.total_comments.toLocaleString()} {pull.total_comments === 1 ? "comment" : "comments"}
          </span>
        )}
        <Button asChild variant="outline" size="xs" className="ml-auto">
          <a href={pull.html_url} target="_blank" rel="noopener noreferrer">
            Open PR <ExternalLink className="size-3" aria-hidden />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function ReadWarning({ message, loading, retry }: { message: string; loading: boolean; retry: () => Promise<void> }) {
  const label = loading ? "Refreshing pull request status." : `${message} Click to retry.`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            size="xs"
            label={label}
            disabled={loading}
            onClick={() => void retry()}
            icon={loading
              ? <RefreshCw className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
              : <TriangleAlert className="size-3.5 text-warning-fg" aria-hidden />}
          />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function stateBadge(state: string): "info" | "warning" | "muted" | "success" {
  if (state === "merged") return "success";
  if (state === "open") return "info";
  if (state === "draft") return "warning";
  return "muted";
}

function reviewLabel(review: NonNullable<PullRequestStatus["review"]>): string {
  if (review === "CHANGES_REQUESTED") return "Changes requested";
  if (review === "APPROVED") return "Approved";
  return "Unreviewed";
}

function reviewTone(review: NonNullable<PullRequestStatus["review"]>): string {
  if (review === "CHANGES_REQUESTED") return "text-destructive-fg";
  if (review === "APPROVED") return "text-success-fg";
  return "text-muted-foreground";
}

function ciLabel(ci: PullRequestCiStatus): string {
  if (ci === "SUCCESS") return "CI passed";
  if (ci === "FAILURE") return "CI failed";
  if (ci === "PENDING") return "CI pending";
  return "No CI checks";
}

function ciTone(ci: PullRequestCiStatus): string {
  if (ci === "SUCCESS") return "text-success-fg";
  if (ci === "FAILURE") return "text-destructive-fg";
  if (ci === "PENDING") return "text-warning-fg";
  return "text-muted-foreground";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayNumber(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}
