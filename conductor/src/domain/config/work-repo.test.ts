import { afterEach, describe, expect, it } from "@rstest/core";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setupWorkRepository, type WorkRepoCommands } from "./work-repo.js";

const exec = promisify(execFile);
const cleanup: string[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))); });

describe("work repository setup", () => {
  it("creates a missing private remote before cloning it", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "conductor-work-repo-"));
    cleanup.push(parent);
    const calls: string[] = [];
    const commands: WorkRepoCommands = {
      exists: async (repo) => { calls.push(`exists:${repo}`); return false; },
      create: async (repo) => { calls.push(`create:${repo}`); },
      clone: async (repo, target) => {
        calls.push(`clone:${repo}:${target}`);
        await exec("git", ["init", "--initial-branch=main", target]);
        await exec("git", ["-C", target, "remote", "add", "origin", `https://github.com/${repo}.git`]);
      },
    };
    const target = path.join(parent, "app-work");
    const result = await setupWorkRepository({ repo: "owner/app-work", workingDir: target }, commands);
    expect(calls).toEqual([`exists:owner/app-work`, `create:owner/app-work`, `clone:owner/app-work:${target}`]);
    expect(result).toEqual({ ok: true, repo: "owner/app-work", workingDir: target, created: true, cloned: true });
  });

  it("rejects malformed configuration without running GitHub commands", async () => {
    let called = false;
    const commands: WorkRepoCommands = {
      exists: async () => { called = true; return true; },
      create: async () => { called = true; },
      clone: async () => { called = true; },
    };
    expect(await setupWorkRepository({ repo: "bad", workingDir: "relative" }, commands)).toMatchObject({ ok: false, status: 400 });
    expect(called).toBe(false);
  });
});
