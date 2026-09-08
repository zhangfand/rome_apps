import { navigateRome } from "@rome-os/app-web-sdk";
import { cn } from "@rome-os/ui/cn";
import { ExternalLink } from "lucide-react";
import type { WorkerNames } from "../lib/domain";

/**
 * A worker's name, and the door to where it works. When the ledger has the
 * worker's Rome session (an Opened fact), the name opens that session in the
 * host; otherwise it is plain text with the raw id on hover. Clicks never
 * bubble, so the link works inside clickable rows.
 */
export function WorkerLink({
  names,
  workerId,
  className,
  icon = false,
}: {
  names: WorkerNames;
  workerId: string;
  className?: string;
  icon?: boolean;
}) {
  const name = names.get(workerId);
  const label = name?.label ?? workerId;
  const session = name?.session;
  if (!session) {
    return (
      <span className={className} title={`${workerId} · session not recorded`}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
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
