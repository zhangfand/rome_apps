import type { ComponentType } from "react";
import type { FactJson } from "./lib/types";
import type { TaskDetailJson } from "./lib/types";

export interface WebDomain {
  externalFactLabel: string;
  authorLabel(by: string, kind?: string): string | undefined;
  eventTitle(fact: FactJson): string | undefined;
  legacyOriginSource: string;
  taskDetailPanels: Array<ComponentType<{ taskId: string; task: TaskDetailJson }>>;
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
};

let current = genericDomain;

/** Called once by web/App.tsx, the web composition root. */
export function configureWebDomain(domain: WebDomain): void {
  current = domain;
}

export function webDomain(): WebDomain {
  return current;
}
