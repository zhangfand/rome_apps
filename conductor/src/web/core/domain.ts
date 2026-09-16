import type { ComponentType } from "react";
import type { FactJson, TaskDetailJson, WorkspaceInspection } from "./lib/types";

export interface ProjectSettingsFieldProps {
  projectId: string;
  project: Record<string, unknown>;
  onChange(project: Record<string, unknown>): void;
  inspection: WorkspaceInspection | null;
  refreshInspection(): void;
  disabled: boolean;
}

export interface WebDomain {
  externalFactLabel: string;
  authorLabel(by: string, kind?: string): string | undefined;
  eventTitle(fact: FactJson): string | undefined;
  legacyOriginSource: string;
  taskDetailPanels: Array<ComponentType<{ taskId: string; task: TaskDetailJson }>>;
  projectSettingsFields: Array<ComponentType<ProjectSettingsFieldProps>>;
}

const genericDomain: WebDomain = {
  externalFactLabel: "source",
  authorLabel(by, kind) {
    if (kind === "Event" && by === "runtime") return "source";
    return by.includes(":") ? "source" : undefined;
  },
  eventTitle: () => undefined,
  legacyOriginSource: "external source",
  taskDetailPanels: [],
  projectSettingsFields: [],
};

let current = genericDomain;

/** Called once by web/App.tsx, the web composition root. */
export function configureWebDomain(domain: WebDomain): void {
  current = domain;
}

export function webDomain(): WebDomain {
  return current;
}
