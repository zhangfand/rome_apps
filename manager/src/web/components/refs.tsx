import { cn } from "@rome-os/ui/cn";
import { ArrowRight, GitPullRequest } from "lucide-react";
import type { Ref, TaskHandle } from "../lib/domain";

/**
 * A task named the way its owner names it: the issue it is about, then the
 * pull requests that came out of it. Links open GitHub; clicks never bubble,
 * so a chip inside a clickable row still goes where it says.
 */
export function RefLink({ r, className }: { r: Ref; className?: string }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      title={`${r.repo} · ${r.kind === "pr" ? "pull request" : "issue"} #${r.number}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-4 font-mono text-ui text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {r.kind === "pr" ? <GitPullRequest className="size-3.5 text-muted-foreground" aria-hidden /> : null}
      {r.label}
    </a>
  );
}

export function TaskName({
  handle,
  rawId,
  size = "ui",
  className,
}: {
  handle: TaskHandle;
  rawId: string;
  size?: "ui" | "section";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)} title={rawId}>
      {handle.issue ? (
        <RefLink r={handle.issue} className={size === "section" ? "text-section" : undefined} />
      ) : (
        <span className={cn("min-w-0 truncate", size === "section" ? "text-section" : "text-ui font-medium")}>
          {handle.name}
        </span>
      )}
      {handle.prs.length > 0 ? (
        <>
          <ArrowRight className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
          {handle.prs.map((pr) => (
            <RefLink key={pr.url} r={pr} className={size === "section" ? "text-section" : undefined} />
          ))}
        </>
      ) : null}
    </span>
  );
}
