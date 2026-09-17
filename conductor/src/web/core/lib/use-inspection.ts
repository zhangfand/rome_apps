import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppApi } from "@rome-os/app-web-sdk";
import { responseError } from "./config-api";
import type { WorkspaceInspection } from "./types";

/**
 * Reads the workspace at `workingDir` and re-checks it 500ms after either input
 * changes. A workspace that needs no directory reports nothing to inspect.
 * `refresh` re-runs the check on demand (used after a clone).
 */
export function useInspection(workspace: string, workingDir: string) {
  const [inspection, setInspection] = useState<WorkspaceInspection | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const sequence = useRef(0);

  const inspect = useCallback(async () => {
    const ticket = ++sequence.current;
    if (workspace === "none") {
      setInspection(null);
      setInspectionError(null);
      return;
    }
    if (!workingDir) {
      setInspection(null);
      setInspectionError("Enter an absolute working directory.");
      return;
    }
    if (!workingDir.startsWith("/")) {
      setInspection(null);
      setInspectionError("Working directory must be absolute.");
      return;
    }
    setInspectionError(null);
    try {
      const query = new URLSearchParams({ workspace, workingDir });
      const response = await fetchAppApi(`config/inspect?${query}`);
      if (!response.ok) throw new Error(await responseError(response));
      const next = (await response.json()) as WorkspaceInspection;
      if (ticket === sequence.current) setInspection(next);
    } catch (caught) {
      if (ticket === sequence.current) {
        setInspectionError(caught instanceof Error ? caught.message : "Inspection failed.");
      }
    }
  }, [workspace, workingDir]);

  useEffect(() => {
    const timer = window.setTimeout(() => void inspect(), 500);
    return () => window.clearTimeout(timer);
  }, [inspect]);

  return { inspection, inspectionError, refresh: inspect };
}
