import { cn } from "@rome-os/ui/cn";
import type { ProjectStatus, ProjectStatusTone } from "../lib/configuration";

const TONE_TEXT: Record<ProjectStatusTone, string> = {
  ready: "text-success-fg",
  cloning: "text-warning-fg",
  error: "text-destructive-fg",
};

/**
 * A coloured dot for a project's workspace status, with an optional word beside
 * it. The reason rides a `title` so it surfaces as a tooltip without taking a
 * line of its own.
 */
export function ProjectStatusDot({
  status,
  showLabel = false,
  className,
}: {
  status: ProjectStatus;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", TONE_TEXT[status.tone], className)}
      title={status.reason}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full bg-current", status.tone === "cloning" && "animate-pulse")}
      />
      {showLabel && <span className="text-aux">{status.label}</span>}
    </span>
  );
}
