import type { Fact } from "./facts.js";

/** Opaque workspace kind registered by an app. */
export type WorkspaceKind = string;

/** A provider-owned stored workspace. `kind` may be absent on legacy facts. */
export interface Workspace {
  kind?: WorkspaceKind;
  [field: string]: unknown;
}

export interface NoWorkspace extends Workspace {
  kind: "none";
}

export interface WorkspaceProject {
  workingDir?: string;
  workspace?: WorkspaceKind;
  [extension: string]: unknown;
}

export interface PrepareWorkspaceInput {
  project: WorkspaceProject;
  taskId: string;
  workerId: string;
  previous?: Workspace;
}

export interface WorkspaceProvider {
  readonly kind: WorkspaceKind;
  prepare(input: PrepareWorkspaceInput): Promise<Workspace>;
  validate(workspace: Workspace): Promise<void>;
  instructions(workspace: Workspace): string;
  note(project?: WorkspaceProject): string;
}

/** Read a stored workspace, using the app's legacy default for pre-kind facts. */
export function workspaceKind(workspace: Workspace, legacyDefault: WorkspaceKind): WorkspaceKind {
  return workspace.kind ?? legacyDefault;
}

/** Read a project workspace, using the app's configured default. */
export function projectWorkspaceKind(project: WorkspaceProject | undefined, defaultKind: WorkspaceKind): WorkspaceKind {
  return project?.workspace ?? defaultKind;
}

export function handedOverWorkspace(facts: readonly Fact[]): Workspace | undefined {
  const ordered = [...facts].sort((a, b) => a.seq - b.seq);
  const previous = ordered.filter((fact) => fact.kind === "Dispatched").at(-1);
  if (!previous || previous.kind !== "Dispatched") return undefined;
  const terminal = ordered.find((fact) => fact.seq > previous.seq &&
    (fact.kind === "Returned" || fact.kind === "Failed" || fact.kind === "Lost") &&
    fact.payload.workerId === previous.payload.workerId);
  return terminal && terminal.kind !== "Lost" ? previous.payload.workspace : undefined;
}
