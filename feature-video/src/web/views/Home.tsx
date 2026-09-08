import { useEffect, useState } from "react";
import { navigateToApp } from "@rome-os/app-web-sdk";
import { Alert, AlertDescription } from "@rome-os/ui/alert";
import { Button } from "@rome-os/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rome-os/ui/card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "@rome-os/ui/empty-state";
import { Spinner } from "@rome-os/ui/spinner";
import { cn } from "@/lib/utils";
import { PEOPLE_PLAYSCRIPT } from "../../lib/people-playscript.js";
import { api, type PlayscriptDto, type ProjectDto } from "../lib/api";
import { ProjectSettingsForm } from "../components/ProjectSettingsForm";

/** Projects and their playscripts on the left, the selected project's stage on the right. */
export function Home() {
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [playscripts, setPlayscripts] = useState<PlayscriptDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((loaded) => {
        setProjects(loaded);
        setSelected((current) => current ?? loaded[0]?.id ?? null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    // The list belongs to the project that was selected, so it goes before the
    // new one loads rather than showing under the wrong project meanwhile.
    setPlayscripts([]);
    api
      .listPlayscripts(selected)
      .then(setPlayscripts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [selected]);

  const project = projects?.find((candidate) => candidate.id === selected) ?? null;

  const saveProject = async (patch: Parameters<typeof api.updateProject>[1]) => {
    if (!project) return;
    const updated = await api.updateProject(project.id, patch);
    setProjects((current) =>
      (current ?? []).map((candidate) => (candidate.id === updated.id ? updated : candidate)),
    );
  };

  // A new playscript starts as the People walkthrough, which is a document the
  // checker passes, so the editor opens on something recordable to edit down.
  const newPlayscript = async () => {
    if (!project) return;
    setCreating(true);
    try {
      const created = await api.createPlayscript({
        projectId: project.id,
        name: `Playscript ${playscripts.length + 1}`,
        startPath: "/people/latest",
        doc: PEOPLE_PLAYSCRIPT,
      });
      setPlayscripts((current) => [...current, created]);
      navigateToApp(`playscripts/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!projects ? (
        <EmptyState>
          <Spinner size="md" label="Loading projects" />
        </EmptyState>
      ) : projects.length === 0 ? (
        <EmptyState>
          <EmptyStateTitle>No projects</EmptyStateTitle>
          <EmptyStateDescription>
            The app seeds a Rome dashboard project to record on. An empty list means that one was
            removed.
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Playscripts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {projects.map((candidate) => (
                <div key={candidate.id} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(candidate.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 rounded-8 border border-border px-3 py-2 text-start",
                      candidate.id === selected && "border-primary bg-accent",
                    )}
                  >
                    <span className="text-ui font-medium">{candidate.name}</span>
                    <span className="text-aux text-muted-foreground truncate">
                      {candidate.baseUrl}
                    </span>
                  </button>
                  {candidate.id === selected ? (
                    <div className="flex flex-col gap-1 ps-3">
                      {playscripts.length === 0 ? (
                        <p className="text-aux text-muted-foreground">No playscripts yet.</p>
                      ) : null}
                      {playscripts.map((playscript) => (
                        <button
                          key={playscript.id}
                          type="button"
                          onClick={() => navigateToApp(`playscripts/${playscript.id}`)}
                          className="flex w-full flex-col items-start rounded-8 px-3 py-2 text-start hover:bg-muted"
                        >
                          <span className="text-ui">{playscript.name}</span>
                          <span className="text-aux text-muted-foreground">
                            {playscript.startPath}
                          </span>
                        </button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        disabled={creating}
                        onClick={() => void newPlayscript()}
                      >
                        New playscript
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            {project ? <ProjectSettingsForm project={project} onSave={saveProject} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
