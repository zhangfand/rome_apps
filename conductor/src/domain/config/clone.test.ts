import { afterEach, describe, expect, it } from "@rstest/core";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cloneRepository } from "./clone.js";

const cleanup: string[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))); });

describe("repository clone", () => {
  it("refuses an existing non-empty target without invoking gh", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "conductor-clone-test-"));
    cleanup.push(root);
    const target = path.join(root, "target");
    await mkdir(target);
    await writeFile(path.join(target, "keep.txt"), "do not replace");
    let called = false;
    const result = await cloneRepository({ repo: "owner/repo", workingDir: target }, async () => { called = true; });
    expect(result).toEqual({ ok: false, error: "The target directory is not empty.", status: 409 });
    expect(called).toBe(false);
  });

  it("rejects a bad repository before touching the target", async () => {
    let called = false;
    const result = await cloneRepository({ repo: "not a repo", workingDir: "/tmp/will-not-exist" }, async () => { called = true; });
    expect(result).toEqual({ ok: false, error: "repo must be an owner/name or github.com URL", status: 400 });
    expect(called).toBe(false);
  });
});
