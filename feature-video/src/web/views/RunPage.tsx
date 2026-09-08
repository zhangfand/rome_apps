import { useEffect, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription, AlertTitle } from "@rome-os/ui/alert";
import { Badge } from "@rome-os/ui/badge";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rome-os/ui/table";
import { Spinner } from "@rome-os/ui/spinner";
import { Timestamp } from "@rome-os/ui/timestamp";
import { api, runFileUrl, type RunDto } from "../lib/api";
import { bytes, LATE_MS, seconds } from "../lib/format";
import { RunStatusBadge } from "../components/RunStatusBadge";

/** How often a run that has not finished is re-read. */
const POLL_MS = 2000;

/** The narrated cut is what the run is for; the raw capture is the fallback while muxing is pending. */
function playable(run: RunDto): string | null {
  const narrated = run.files.find((file) => file.name.endsWith("narrated.mp4"));
  const recording = run.files.find((file) => file.name.endsWith(".mp4"));
  return (narrated ?? recording)?.name ?? null;
}

export function RunPage({ id, apiBase }: { id: string; apiBase: string }) {
  const [run, setRun] = useState<RunDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const next = await api.readRun(id);
        if (!live) return;
        setRun(next);
        setError(null);
        if (next.status === "queued" || next.status === "running") {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch (err) {
        if (!live) return;
        setError(err instanceof Error ? err.message : String(err));
        // A read that fails says nothing about the run, so the poll keeps its
        // rhythm and the page keeps showing the run it last read.
        timer = setTimeout(poll, POLL_MS);
      }
    };

    poll();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error && !run) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!run) {
    return (
      <EmptyState>
        <Spinner size="md" label="Loading run" />
      </EmptyState>
    );
  }

  const video = playable(run);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateToApp(`playscripts/${run.playscriptId}`)}
        >
          Back to the playscript
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>The run could not be read</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            Run
            <RunStatusBadge status={run.status} />
            {run.status === "running" || run.status === "queued" ? (
              <Spinner size="sm" label="Recording in progress" />
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-ui text-muted-foreground">
          <p>
            Started <Timestamp value={run.startedAt} />
            {run.finishedAt ? (
              <>
                {" · finished "}
                <Timestamp value={run.finishedAt} />
              </>
            ) : null}
            {run.report ? ` · ${run.report.durationSeconds.toFixed(0)}s of video` : null}
          </p>
          {run.error ? (
            <Alert variant="destructive">
              <AlertTitle>The recording failed</AlertTitle>
              <AlertDescription>{run.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {video ? (
        <Card>
          <CardHeader>
            <CardTitle>{video}</CardTitle>
          </CardHeader>
          <CardContent>
            <video className="w-full rounded-8" controls src={runFileUrl(apiBase, run.id, video)} />
          </CardContent>
        </Card>
      ) : null}

      {run.files.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {run.files.map((file) => (
              <a
                key={file.name}
                href={runFileUrl(apiBase, run.id, file.name)}
                download={file.name}
                className="flex items-center justify-between gap-3 rounded-8 px-3 py-2 text-ui hover:bg-muted"
              >
                <span className="font-mono truncate">{file.name}</span>
                <span className="text-aux text-muted-foreground">{bytes(file.bytes)}</span>
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Cue sheet</CardTitle>
        </CardHeader>
        <CardContent>
          {run.report ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beat</TableHead>
                    <TableHead>Cue</TableHead>
                    <TableHead>Planned</TableHead>
                    <TableHead>Hand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.report.cues.map((cue) =>
                    cue.gestures.map((gesture, index) => {
                      const late = gesture.at - gesture.planned > LATE_MS;
                      return (
                        <TableRow key={`${cue.id}-${gesture.on}-${index}`}>
                          <TableCell>
                            {index === 0 ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-ui">{cue.id}</span>
                                <span className="text-aux text-muted-foreground">{cue.line}</span>
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{gesture.on}</TableCell>
                          <TableCell className="tabular-nums">{seconds(gesture.planned)}</TableCell>
                          <TableCell className="tabular-nums">
                            <span className="flex items-center gap-2">
                              {seconds(gesture.at)}
                              {late ? <Badge variant="warning">LATE</Badge> : null}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    }),
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState>
              <EmptyStateTitle>No cue sheet yet</EmptyStateTitle>
              <EmptyStateDescription>
                The report lands when the recording finishes.
              </EmptyStateDescription>
            </EmptyState>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
