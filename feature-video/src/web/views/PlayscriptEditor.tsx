import { useCallback, useEffect, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { EmptyState } from "@rome-os/ui/empty-state";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@rome-os/ui/field";
import { Input } from "@rome-os/ui/input";
import { Spinner } from "@rome-os/ui/spinner";
import { Textarea } from "@rome-os/ui/textarea";
import { Timestamp } from "@rome-os/ui/timestamp";
import { RunStatusBadge } from "../components/RunStatusBadge";
import { api, type CheckResult, type PlayscriptDto, type RunDto } from "../lib/api";

/** One playscript: its name, where it starts, and the document itself as JSON. */
export function PlayscriptEditor({ id }: { id: string }) {
  const [playscript, setPlayscript] = useState<PlayscriptDto | null>(null);
  const [runs, setRuns] = useState<RunDto[]>([]);
  const [name, setName] = useState("");
  const [startPath, setStartPath] = useState("");
  const [doc, setDoc] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState<"check" | "save" | "record" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    const loaded = await api.readPlayscript(id);
    setPlayscript(loaded);
    setName(loaded.name);
    setStartPath(loaded.startPath);
    setDoc(JSON.stringify(loaded.doc, null, 2));
    setRuns(await api.listRuns(id));
  }, [id]);

  useEffect(() => {
    load().catch((err: unknown) => {
      setLoadFailed(true);
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [load]);

  /** Runs `work`, keeping its failure in the inline error rather than throwing at the page. */
  const run = async (kind: "check" | "save" | "record", work: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  /** The textarea's contents as a document, or the parse error as a rejection. */
  const parseDoc = (): PlayscriptDto["doc"] => {
    try {
      return JSON.parse(doc) as PlayscriptDto["doc"];
    } catch {
      throw new Error("The playscript is not valid JSON.");
    }
  };

  const onSave = () =>
    run("save", async () => {
      const saved = await api.updatePlayscript(id, {
        name,
        startPath,
        doc: parseDoc(),
      });
      setPlayscript(saved);
    });

  // The check reads the stored playscript, so an edited document is saved first.
  const onCheck = () =>
    run("check", async () => {
      const saved = await api.updatePlayscript(id, { name, startPath, doc: parseDoc() });
      setPlayscript(saved);
      setCheck(await api.checkPlayscript(id));
    });

  const onRecord = () =>
    run("record", async () => {
      const started = await api.startRun(id);
      navigateToApp(`runs/${started.id}`);
    });

  if (loadFailed) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!playscript) {
    return (
      <EmptyState>
        <Spinner size="md" label="Loading playscript" />
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigateToApp("")}>
          All playscripts
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{playscript.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fv-playscript-name">Name</FieldLabel>
                <Input
                  id="fv-playscript-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fv-start-path">Start path</FieldLabel>
                <Input
                  id="fv-start-path"
                  value={startPath}
                  autoComplete="off"
                  onChange={(event) => setStartPath(event.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="fv-doc">Playscript</FieldLabel>
              <Textarea
                id="fv-doc"
                className="font-mono"
                rows={24}
                spellCheck={false}
                value={doc}
                onChange={(event) => setDoc(event.target.value)}
              />
              <FieldDescription>
                Named targets, then the beats: one narrated line each, with the gestures cued to the
                words they belong with.
              </FieldDescription>
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button onClick={onCheck} disabled={busy !== null} variant="outline">
                {busy === "check" ? <Spinner size="sm" /> : null}
                Check
              </Button>
              <Button onClick={onSave} disabled={busy !== null} variant="outline">
                {busy === "save" ? <Spinner size="sm" /> : null}
                Save
              </Button>
              <Button onClick={onRecord} disabled={busy !== null}>
                {busy === "record" ? <Spinner size="sm" /> : null}
                Record
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {check ? (
        <Card>
          <CardHeader>
            <CardTitle>{check.problems.length > 0 ? "Problems" : "The script"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {check.problems.length > 0 ? (
              <ul className="flex flex-col gap-1 text-ui text-destructive">
                {check.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-muted-foreground">
                Every cue's phrase is in its line and every gesture points at a target this
                playscript defines.
              </p>
            )}
            <div className="overflow-x-auto">
              <pre className="text-aux font-mono whitespace-pre">{check.script}</pre>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {runs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Runs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {runs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToApp(`runs/${item.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-8 px-3 py-2 text-start hover:bg-muted"
              >
                <Timestamp className="text-ui text-muted-foreground" value={item.startedAt} />
                <RunStatusBadge status={item.status} />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
