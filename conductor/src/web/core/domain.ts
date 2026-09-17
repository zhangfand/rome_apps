import type { ComponentType } from "react";
import type { ConfigJson, FactJson, TaskDetailJson, WorkspaceInspection } from "./lib/types";

/**
 * The contract a domain fills to own a whole settings section on a project's
 * detail page. A slot component renders a complete `Section` — its own heading,
 * actions and rows — not a bare set of fields, so a domain can carry its own
 * status line and controls without core knowing what they mean.
 */
export interface ProjectSettingsSlotProps {
  projectId: string;
  /** The current draft of this project's config value. */
  project: Record<string, unknown>;
  /** The full config, for reading sibling values without an extra fetch. */
  config: ConfigJson;
  /**
   * Merge a partial into THIS project and enqueue an autosave PATCH. Debounced
   * by default (for text inputs); pass `{ immediate: true }` for a toggle or
   * select that must save the instant it changes.
   */
  patch(partial: Record<string, unknown>, options?: { immediate?: boolean }): void;
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
  /** Each renders a whole `Section` for the project detail page. */
  projectSettingsFields: Array<ComponentType<ProjectSettingsSlotProps>>;
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
