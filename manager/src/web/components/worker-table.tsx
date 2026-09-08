import { useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { WorkerStatusBadge } from "./badges";
import { formatDuration, formatStamp, shortId, truncate, useNow } from "../lib/format";
import type { WorkerSummary } from "../lib/types";

type Scope = "running" | "all";

export function WorkerTable({
  workers,
  showTask = true,
}: {
  workers: WorkerSummary[];
  showTask?: boolean;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const now = useNow();
  const visible = workers.filter((w) => scope === "all" || w.status === "running");

  return (
    <div className="flex flex-col gap-3">
      {showTask ? (
        <div className="flex items-center justify-between gap-3">
          <SegmentedControl
            aria-label="Worker scope"
            size="sm"
            value={scope}
            onValueChange={setScope}
            options={[
              { value: "running", label: "Running" },
              { value: "all", label: "All" },
            ]}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {visible.length} of {workers.length}
          </span>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState className="py-10">
          <EmptyStateTitle>No workers</EmptyStateTitle>
          <EmptyStateDescription>
            {workers.length === 0
              ? "The runtime starts a worker when it takes a task."
              : "Nothing is running right now."}
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Worker</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {showTask ? <TableHead>Task</TableHead> : null}
                <TableHead className="w-[160px]">Started</TableHead>
                <TableHead className="w-[90px] text-right">Duration</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((w) => (
                <TableRow key={w.workerId}>
                  <TableCell className="font-mono text-xs" title={w.workerId}>
                    {shortId(w.workerId)}
                  </TableCell>
                  <TableCell>
                    <WorkerStatusBadge status={w.status} />
                  </TableCell>
                  {showTask ? (
                    <TableCell className="max-w-[320px]">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto max-w-full justify-start truncate px-0 font-normal"
                        onClick={() => navigateToApp(w.taskId)}
                        title={w.taskBrief}
                      >
                        {truncate(w.taskBrief, 80)}
                      </Button>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatStamp(w.startedAt)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatDuration(
                      w.status === "running" ? now - new Date(w.startedAt).getTime() : w.ageMs,
                    )}
                  </TableCell>
                  <TableCell className="max-w-[420px] text-xs text-muted-foreground" title={w.outcome}>
                    {w.outcome ? truncate(w.outcome, 140) : w.status === "running" ? "—" : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
