import type { WorkspaceInspection } from "./types.js";

/**
 * Pure, framework-agnostic helpers for the settings pages: a sequenced autosave
 * controller, the save-status copy, and the per-project status derivation. None
 * of these touch React, so each is unit-tested on its own.
 */

export type SaveState = "idle" | "saving" | "error";

export interface SaveStatus {
  state: SaveState;
  /** Present only when `state` is `"error"`. */
  reason?: string;
}

export interface SaveQueue<T> {
  /** Queue a value to save. Coalesces to the latest while a save is in flight. */
  enqueue(value: T): void;
  readonly status: SaveStatus;
  /** Notified on every status change. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export interface SaveQueueOptions<T> {
  save(value: T): Promise<void>;
  /** Turns a rejected save into the reason shown to the reader. */
  errorReason?(error: unknown): string;
}

/**
 * A sequenced autosave controller. At most one save runs at a time; while one
 * is in flight, only the latest enqueued value is kept, and it fires when the
 * in-flight save settles. An older value can therefore never land after a newer
 * one — intermediate values are simply dropped.
 */
export function createSaveQueue<T>({
  save,
  errorReason = defaultErrorReason,
}: SaveQueueOptions<T>): SaveQueue<T> {
  let status: SaveStatus = { state: "idle" };
  let inFlight = false;
  let hasPending = false;
  let pending: T;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const setStatus = (next: SaveStatus) => {
    status = next;
    emit();
  };

  const run = (value: T) => {
    inFlight = true;
    setStatus({ state: "saving" });
    void save(value).then(
      () => finish(null),
      (error: unknown) => finish(errorReason(error)),
    );
  };

  // On settle, a newer pending value always supersedes: it fires next, so the
  // queue stays busy and the terminal status is deferred until nothing is left.
  const finish = (reason: string | null) => {
    if (hasPending) {
      hasPending = false;
      run(pending);
      return;
    }
    inFlight = false;
    setStatus(reason === null ? { state: "idle" } : { state: "error", reason });
  };

  return {
    enqueue(value: T) {
      if (inFlight) {
        pending = value;
        hasPending = true;
      } else {
        run(value);
      }
    },
    get status() {
      return status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function defaultErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Please try again.";
}

/** The three save-status strings, exactly as the UI shows them. */
export function saveStatusText(status: SaveStatus): string {
  switch (status.state) {
    case "saving":
      return "Saving…";
    case "error":
      return `Couldn't save — ${status.reason ?? "please try again."}`;
    default:
      return "All changes saved";
  }
}

export type ProjectStatusTone = "ready" | "cloning" | "error";

export interface ProjectStatus {
  tone: ProjectStatusTone;
  label: "Ready" | "Cloning" | "Error";
  /** A human reason for a title tooltip, present only when `tone` is `"error"`. */
  reason?: string;
}

/**
 * The status shown for a project in the list row and the detail status dot.
 * Cloning wins over everything; a project whose workspace needs no directory is
 * always ready; otherwise the inspection has to prove the workspace is usable,
 * and anything unproven (a problem, a missing path, or nothing known yet) reads
 * as an error carrying a reason.
 */
export function deriveProjectStatus(
  inspection: WorkspaceInspection | null,
  inspectionError: string | null,
  cloning: boolean,
  workspaceOptional: boolean,
): ProjectStatus {
  if (cloning) return { tone: "cloning", label: "Cloning" };
  if (workspaceOptional) return { tone: "ready", label: "Ready" };
  if (inspectionError) return { tone: "error", label: "Error", reason: inspectionError };
  if (!inspection) return { tone: "error", label: "Error", reason: "Workspace has not been checked yet." };
  if (inspection.problem) return { tone: "error", label: "Error", reason: inspection.problem };
  if (!inspection.exists) return { tone: "error", label: "Error", reason: "Working directory does not exist." };
  if (!inspection.isRepository) return { tone: "error", label: "Error", reason: "Workspace is not ready to use." };
  return { tone: "ready", label: "Ready" };
}
