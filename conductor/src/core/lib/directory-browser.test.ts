import { afterEach, describe, expect, it } from "@rstest/core";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browseDirectories, DirectoryBrowserError } from "./directory-browser.js";

const cleanups: string[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("directory browser", () => {
  it("returns sorted child directories and directory symlinks only", async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, "zeta"));
    await mkdir(join(root, "Alpha"));
    await writeFile(join(root, "notes.txt"), "not a directory");
    await symlink(join(root, "Alpha"), join(root, "linked"));

    const listing = await browseDirectories(root);

    expect(listing.path).toBe(root);
    expect(listing.parent).toBe(tmpdir());
    expect(listing.entries).toEqual([
      { name: "Alpha", path: join(root, "Alpha") },
      { name: "linked", path: join(root, "linked") },
      { name: "zeta", path: join(root, "zeta") },
    ]);
  });

  it("rejects relative paths and missing directories with useful statuses", async () => {
    await expect(browseDirectories("relative/path")).rejects.toMatchObject<Partial<DirectoryBrowserError>>({ status: 400 });
    await expect(browseDirectories(join(tmpdir(), crypto.randomUUID()))).rejects.toMatchObject<Partial<DirectoryBrowserError>>({ status: 404 });
  });
});

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "conductor-directories-"));
  cleanups.push(path);
  return path;
}
