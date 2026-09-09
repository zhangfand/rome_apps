import { describe, expect, it } from "@rstest/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttentionPanel } from "./attention";
import { refsIn } from "../lib/domain";

const report = "I moved the changes onto a clean branch. See https://github.com/example/repo/pull/42.\n\nLong evidence and execution logs.";
const props = {
  taskId: "t-test",
  handle: { name: "Give messages their own module", isRef: false, prs: refsIn(report) },
  kind: "Report" as const,
  text: report,
  brief: "A duplicate brief that should not appear on the card",
  evidence: "worker log evidence",
};

describe("AttentionPanel collapsed", () => {
  it("shows the task, decision, PR, primary action, and Details only", () => {
    const html = renderToStaticMarkup(createElement(AttentionPanel, props));
    expect(html).toContain("Give messages their own module");
    expect(html).toContain("Report ready");
    expect(html).not.toContain("Is this task done, or does it need more work?");
    expect(html).not.toContain("Review in chat");
    expect(html).toContain("Open PR");
    expect(html).toContain("Merge PR");
    expect(html).toContain("comments");
    expect(html).toContain("CI unknown");
    expect(html).toContain('data-size="xs"');
    expect(html).toContain('href="https://github.com/example/repo/pull/42"');
    expect(html).toContain("Details");
    expect(html).not.toContain("I moved the changes");
    expect(html).not.toContain(props.brief);
    expect(html).not.toContain(props.evidence);
    expect(html).not.toContain("Open task");
  });
  it("connects the accessible disclosure to an initially hidden region", () => {
    const html = renderToStaticMarkup(createElement(AttentionPanel, props));
    const target = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(target).toBeTruthy();
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`id="${target}" hidden=""`);
  });
  it("shows an actual short question and an answer action", () => {
    const html = renderToStaticMarkup(createElement(AttentionPanel, {
      ...props, kind: "Question", text: "Preserve compatibility or update callers?",
    }));
    expect(html).toContain("Preserve compatibility or update callers?");
    expect(html).toContain("Decision needed");
    expect(html).toContain("Answer in chat");
    expect(html).not.toContain("Review in chat");
  });
  it("does not promote unrelated historical PRs into the collapsed card", () => {
    const html = renderToStaticMarkup(createElement(AttentionPanel, {
      ...props, text: "No PR was produced.",
    }));
    expect(html).not.toContain('href="https://github.com/example/repo/pull/42"');
  });
});
