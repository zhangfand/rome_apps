import { useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { SegmentedControl } from "@rome-os/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { WorkerStatusBadge } from "./badges";
import { WorkerLink } from "./worker-link";
import { type TaskHandle, type WorkerNames, humanize, plain } from "../lib/domain";
import { formatDuration, formatStamp, truncate, useNow } from "../lib/format";
import type { WorkerSummary } from "../lib/types";

type Scope = "running" | "all";

export function WorkerTable({
  workers,
  names,
  handles,
  showTask = true,
}: {
  workers: WorkerSummary[];
  names: WorkerNames;
  handles?: ReadonlyMap<string, TaskHandle>;
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
          <span className="text-aux text-muted-foreground tabular-nums">
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
        <div className="overflow-hidden rounded-12 border border-border bg-surface">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[96px]">Worker</TableHead>
                <TableHead className="w-[104px]">Status</TableHead>
                {showTask ? <TableHead className="w-[24%]">Task</TableHead> : null}
                <TableHead className="w-[150px]">Started</TableHead>
                <TableHead className="w-[80px] text-right">Ran for</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((w) => {
                const handle = handles?.get(w.taskId);
                return (
                  <TableRow key={w.workerId}>
                    <TableCell className="text-ui">
                      <WorkerLink names={names} workerId={w.workerId} icon />
                    </TableCell>
                    <TableCell>
                      <WorkerStatusBadge status={w.status} />
                    </TableCell>
                    {showTask ? (
                      <TableCell className="truncate">
                        <Button
                          variant="link"
                          size="sm"
                          className={`h-auto max-w-full justify-start px-0 ${handle?.isRef ? "font-mono" : "font-normal"}`}
                          onClick={() => navigateToApp(w.taskId)}
                          title={w.taskBrief}
                        >
                          <span className="truncate">{handle?.name ?? truncate(w.taskBrief, 80)}</span>
                        </Button>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-aux text-muted-foreground tabular-nums">
                      {formatStamp(w.startedAt)}
                    </TableCell>
                    <TableCell className="text-right text-aux tabular-nums">
                      {formatDuration(w.status === "running" ? now - new Date(w.startedAt).getTime() : w.ageMs)}
                    </TableCell>
                    <TableCell className="truncate text-aux text-muted-foreground" title={w.outcome}>
                      {w.outcome ? truncate(humanize(plain(w.outcome), names), 140) : w.status === "running" ? "—" : ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
