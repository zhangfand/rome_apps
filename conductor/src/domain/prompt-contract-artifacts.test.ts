import { describe, expect, it } from "@rstest/core";
import type { TaskView } from "../core/lib/fold.js";
import { createPromptContractProvider } from "./prompt-contract-artifacts.js";
import type { PersistTextArtifacts } from "./work-repo-artifacts.js";

describe("work-repository prompt contracts", () => {
  it("scopes PM defaults and resolves selected contracts to pinned refs", async () => {
    let written: string[] = [];
    const persist: PersistTextArtifacts = async (repo, drafts) => {
      written = drafts.map((draft) => draft.path);
      return new Map(drafts.map((draft, index) => [draft.path, {
        repo: repo.repo,
        path: draft.path,
        commit: String(index + 1).repeat(40),
        sha256: "a".repeat(64),
        bytes: Buffer.byteLength(draft.content.endsWith("\n") ? draft.content : `${draft.content}\n`),
        mediaType: "text/markdown" as const,
        url: `https://example.test/${draft.path}`,
      }]));
    };
    const provider = createPromptContractProvider(persist);
    const task = {
      project: {
        workRepo: { repo: "owner/work", workingDir: "/work" },
      },
    } as TaskView;

    expect(provider.defaultForWorker("conductor:pm")).toEqual([
      "product-spec-format.md",
      "work-repo-contract.md",
    ]);
    expect(provider.defaultForWorker("coding:coding")).toEqual([]);

    const resolved = await provider.resolve(task, ["technical-spec-format.md"]);
    expect(written.sort()).toEqual([
      "_conductor/contracts/product-spec-format.md",
      "_conductor/contracts/technical-spec-format.md",
      "_conductor/contracts/work-repo-contract.md",
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      name: "technical-spec-format.md",
      artifact: { repo: "owner/work", path: "_conductor/contracts/technical-spec-format.md" },
    });
    expect(resolved[0].content).toBeUndefined();
  });

  it("falls back to only the selected inline contract without a work repository", async () => {
    const provider = createPromptContractProvider(async () => {
      throw new Error("should not persist");
    });
    const resolved = await provider.resolve({ project: {} } as TaskView, ["product-spec-format.md"]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe("product-spec-format.md");
    expect(resolved[0].content).toContain("# Product spec format");
  });
});

