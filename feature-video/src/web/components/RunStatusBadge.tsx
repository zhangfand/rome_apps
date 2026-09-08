import { Badge } from "@rome-os/ui/badge";
import type { RunStatus } from "../../lib/types.js";

/** One badge tone per lifecycle state, so a list of runs reads at a glance. */
const TONE = {
  queued: "muted",
  running: "info",
  done: "success",
  failed: "destructive",
} as const;

const LABEL = {
  queued: "Queued",
  running: "Recording",
  done: "Done",
  failed: "Failed",
} as const;

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge variant={TONE[status]}>{LABEL[status]}</Badge>;
}
