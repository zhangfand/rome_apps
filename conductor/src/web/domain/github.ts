import type { WebDomain } from "../core/domain";
import { PullRequestsPanel } from "./pull-requests";
import { GitHubProjectSettings } from "./github-project-settings";

function value(payload: Record<string, unknown>, key: string): string {
  const item = payload[key];
  return item === undefined || item === null ? "" : String(item);
}

export const githubWebDomain: WebDomain = {
  externalFactLabel: "github",
  authorLabel(by, kind) {
    if (kind === "Event" && by === "runtime") return "github";
    return by.startsWith("github:") ? "github" : undefined;
  },
  eventTitle(fact) {
    const titles: Record<string, string> = {
      issue_closed: "The issue closed",
      pr_review: "A review was added",
      pr_review_comment: "A review comment was added",
      pr_comment: "Someone commented on the pull request",
      checks_completed: "Checks finished",
      pr_merged: "The pull request was merged",
      pr_closed: "The pull request was closed",
      pr_opened: "A pull request appeared",
    };
    const type = value(fact.payload, "type");
    return titles[type] ?? (value(fact.payload, "source") === "github" ? "Something changed on GitHub" : undefined);
  },
  legacyOriginSource: "github",
  taskDetailPanels: [PullRequestsPanel],
  projectSettingsFields: [GitHubProjectSettings],
};
