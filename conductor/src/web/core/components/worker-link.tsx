import { navigateRome } from "@rome-os/app-web-sdk";
import { cn } from "@rome-os/ui/cn";
import { ExternalLink } from "lucide-react";
import type { WorkerSession } from "../lib/workers";

/** A worker label that opens the durable Rome session where it did its work. */
export function WorkerLink({
  workerId,
  session,
  label = "worker",
  className,
  icon = false,
}: {
  workerId: string;
  session?: WorkerSession;
  label?: string;
  className?: string;
  icon?: boolean;
}) {
  if (!session) {
    return <span className={className} title={`${workerId} · session not recorded`}>{label}</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        navigateRome({
          path: "session",
          session: { _romeSessionId: session.id, _type: session.type as never },
        });
      }}
      title={`${workerId} · open its session`}
      className={cn(
        "inline-flex items-center gap-1 rounded-4 text-left underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {label}
      {icon ? <ExternalLink className="size-3 text-muted-foreground" aria-hidden /> : null}
    </button>
  );
}
