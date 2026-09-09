import { describe, expect, it } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Overview } from "./overview";
import { TaskList } from "./task-list";
import { DashboardScreen, DashboardFreshness, dashboardRoute } from "../App";
import { fixtureTasks, task } from "../lib/test-overview";
import type { DashboardView } from "../lib/types";

const tasks = fixtureTasks();
const view = { now: new Date().toISOString(), configured: true, projects: ["rome", "manager"], tasks,
  workers: [], ledger: [], lock: { held: false, name: "reconcile" },
  config: { workingDir: "/repo", workerAgent: "coding:coding", maxWorkers: 3, startCap: 2, ageCapHours: 3, intervalMinutes: 5 },
  counts: { facts: 999, tasks: { created: 1, taken: 5, completed: 1, cancelled: 1 }, positions: { working: 2, waiting: 1, stuck: 1, reported: 2 }, workers: { running: 1, returned: 0, failed: 0, lost: 0 } },
} satisfies DashboardView;
const screen = (page: Parameters<typeof DashboardScreen>[0]["page"], patch = {}) => renderToStaticMarkup(createElement(DashboardScreen, {
  page, view, projectId: "", onProject: () => {}, loading: false, retry: () => {}, ...patch,
}));

describe("clean overview", () => {
  it("shows one task occurrence, live PR controls, full questions, and collapsed actual results", () => {
    const html = renderToStaticMarkup(createElement(Overview, { tasks, names: new Map(), showProject: true }));
    for (const title of ["Decisions", "Pull requests", "In progress", "Other results", "Found four Git LFS objects.", "Which database should I use?", "Open PR", "Merge PR", "Answer in chat"]) expect(html).toContain(title);
    for (const t of tasks.slice(0, 6)) expect(html.split(`data-task-id="${t.id}"`).length - 1).toBe(1);
    for (const absent of ["Report ready", "No PR linked", "Historical claim", "42 facts", "3 starts", "data-task-id=\"done\"", "data-task-id=\"cancelled\""]) expect(html).not.toContain(absent);
    expect(html).toContain("<details"); expect(html).not.toContain("<details open");
    expect(html).toContain('aria-expanded="false"');
  });
  it("never loses blocking questions without PRs or with long content", () => {
    const question = "Which storage backend? " + "Important detail. ".repeat(40);
    const html = renderToStaticMarkup(createElement(Overview, { tasks: [task("q", { attention: { kind: "Question", text: question } })], names: new Map(), showProject: false }));
    expect(html).toContain(question.trim()); expect(html).toContain("Answer in chat");
  });
  it("hides project badges when filtered and provides an empty state", () => {
    expect(renderToStaticMarkup(createElement(Overview, { tasks: [task("work")], names: new Map(), showProject: false }))).not.toContain(">rome<");
    expect(renderToStaticMarkup(createElement(Overview, { tasks: [], names: new Map(), showProject: false }))).toContain("No open tasks in this project");
  });
});

describe("dashboard navigation and secondary views", () => {
  it("puts navigation before content and keeps technical details off the overview", () => {
    const html = screen("overview");
    expect(html.indexOf('aria-label="Manager navigation"')).toBeLessThan(html.indexOf('aria-label="Task overview"'));
    expect(html).toContain("All tasks"); expect(html).toContain("Board"); expect(html).toContain("More");
    for (const absent of ["coding:coding", "999", "reconciling", "just now", "3h of silence", "Task scope", "Created or Taken"]) expect(html).not.toContain(absent);
  });
  it("renders secondary pages without the attention/overview stack", () => {
    for (const page of ["tasks", "history", "workers", "ledger", "diagnostics"] as const) expect(screen(page)).not.toContain('aria-label="Task overview"');
    expect(screen("history")).toContain('data-task-id="done"'); expect(screen("history")).not.toContain('data-task-id="pr"');
    expect(screen("diagnostics")).toContain("coding:coding"); expect(screen("diagnostics")).toContain("Legacy worker age cap");
  });
  it("keeps existing deep links and makes the root the overview", () => {
    expect(dashboardRoute("")).toEqual({ page: "overview", taskId: null });
    for (const page of ["tasks", "history", "board", "workers", "ledger", "diagnostics"]) expect(dashboardRoute(`/${page}/`).taskId).toBe(null);
    expect(dashboardRoute("t-123")).toEqual({ page: "overview", taskId: "t-123" });
  });
  it("hides the project filter for a single-project installation", () => {
    expect(screen("overview", { view: { ...view, projects: ["rome"] } })).not.toContain('aria-label="Filter by project"');
  });
  it("has quiet idle health, a loading spinner and retry alarm", () => {
    expect(renderToStaticMarkup(createElement(DashboardFreshness, { loading: false, retry() {} }))).toBe("");
    expect(renderToStaticMarkup(createElement(DashboardFreshness, { loading: true, retry() {} }))).toContain("animate-spin");
    expect(renderToStaticMarkup(createElement(DashboardFreshness, { loading: false, warning: "Offline", retry() {} }))).toContain("Retry loading dashboard");
  });
  it("does not show old report claims or execution counters in All tasks", () => {
    const html = renderToStaticMarkup(createElement(TaskList, { tasks }));
    for (const absent of ["Historical claim", "42 facts", "starts since", "Report ·", "Needs you"]) expect(html).not.toContain(absent);
    expect(html).toContain("Result available"); expect(html).toContain('data-task-id="done"');
  });
});
