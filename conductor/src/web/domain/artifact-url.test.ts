import { describe, expect, it } from "@rstest/core";
import { githubArtifactUrl } from "./artifact-url";
import { githubWebDomain } from "./github";

const workRepo = { repo: "zhangfand/rome-apps-work" };

describe("githubArtifactUrl", () => {
  it("links every reference shape leads record on a child Task", () => {
    expect(githubArtifactUrl("https://github.com/o/r/blob/main/a.md", workRepo)).toBe("https://github.com/o/r/blob/main/a.md");
    expect(githubArtifactUrl("zhangfand/rome-cloud-work@47a27e8cfaebbfd77a7797b9caf07fbe587ceab1:slack-oauth-setup/technical-spec.md#t1"))
      .toBe("https://github.com/zhangfand/rome-cloud-work/blob/47a27e8cfaebbfd77a7797b9caf07fbe587ceab1/slack-oauth-setup/technical-spec.md#t1");
    expect(githubArtifactUrl("pi-llm-provider/spec.md@0ee9e18e5ac22993c0e4538ef9cfd913b1b6e5e9", workRepo))
      .toBe("https://github.com/zhangfand/rome-apps-work/blob/0ee9e18e5ac22993c0e4538ef9cfd913b1b6e5e9/pi-llm-provider/spec.md");
    expect(githubArtifactUrl("parent-task-children/artifacts/proposal.md", workRepo))
      .toBe("https://github.com/zhangfand/rome-apps-work/blob/HEAD/parent-task-children/artifacts/proposal.md");
  });

  it("needs the project's work repository for a bare or pinned path", () => {
    expect(githubArtifactUrl("pi-llm-provider/spec.md@0ee9e18e")).toBeUndefined();
    expect(githubArtifactUrl("pi-llm-provider/spec.md")).toBeUndefined();
  });

  it("refuses references it cannot turn into a safe repository file link", () => {
    expect(githubArtifactUrl("../secrets.md", workRepo)).toBeUndefined();
    expect(githubArtifactUrl("docs/../../x.md@0ee9e18e", workRepo)).toBeUndefined();
    expect(githubArtifactUrl("javascript:alert(1)", workRepo)).toBeUndefined();
    expect(githubArtifactUrl("the plan in chat", workRepo)).toBeUndefined();
    expect(githubArtifactUrl("docs/spec.md", { repo: "not a repo" })).toBeUndefined();
  });

  it("is the GitHub domain's resolver, reading the Task's work repository", () => {
    const task = {
      id: "t-1", brief: "b", createdBy: "orchestrator", createdAt: "", updatedAt: "", state: "open" as const,
      latest: { seq: 1, id: "f-1", taskId: "t-1", kind: "Created", by: "orchestrator", payload: {}, createdAt: "" },
      decisionsSinceLastPersonFact: 0, factCount: 1, usageSessions: [],
      workRepo: { repo: "zhangfand/rome-apps-work", url: "https://github.com/zhangfand/rome-apps-work" },
    };
    expect(githubWebDomain.artifactUrl?.("a/spec.md", task)).toBe("https://github.com/zhangfand/rome-apps-work/blob/HEAD/a/spec.md");
    expect(githubWebDomain.childTaskRowDetails).toHaveLength(1);
  });
});
