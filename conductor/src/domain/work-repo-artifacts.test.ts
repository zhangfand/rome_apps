import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "@rstest/core";
import { persistJsonArtifacts } from "./work-repo-artifacts.js";

const exec = promisify(execFile);

describe("work repository JSON artifacts", () => {
  it("commits the exact JSON and returns a commit-pinned digest reference", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "conductor-artifact-test-"));
    const remote = path.join(root, "remote.git");
    const checkout = path.join(root, "checkout");
    const inspect = path.join(root, "inspect");
    try {
      await git(root, "init", "--bare", "--initial-branch=main", remote);
      await git(root, "clone", remote, checkout);
      const refs = await persistJsonArtifacts(
        { repo: "acme/widgets-work", workingDir: checkout },
        [{ path: "_evidence/github/acme/widgets/pulls/12/reviews/42.json", value: { review: { id: 42, body: "full" } } }],
        "archive review",
      );
      const ref = refs.values().next().value!;

      await git(root, "clone", remote, inspect);
      const content = await readFile(path.join(inspect, ref.path), "utf8");
      expect(JSON.parse(content)).toEqual({ review: { id: 42, body: "full" } });
      expect(ref.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(ref.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(ref.url).toContain(`/blob/${ref.commit}/`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function git(cwd: string, ...args: string[]) {
  await exec("git", ["-C", cwd, ...args], { timeout: 60_000 });
}
